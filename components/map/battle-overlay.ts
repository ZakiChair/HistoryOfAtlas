import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import {
  type Map as MapInstance,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type FilterSpecification,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { getBattle, getBattleIndex } from '@/lib/battles/client';
import { battleAnchorIsVisible, battleProjectionMatrix } from '@/lib/battles/projection';
import type { BattleIndexEntry, BattleRecord } from '@/lib/battles/schema';
import {
  battleOccursInYear,
  buildBattleSimulation,
  formationPositions,
  unitAdvanceDistance,
  unitLossState,
  type BattleSimulation,
  type FormationUnit,
  type SimulationArmy,
} from '@/lib/battles/simulation';
import { resolveUnitProfile, type ResolvedUnitProfile } from '@/lib/battles/units';
import { focusBattle } from '@/lib/battles/navigation';
import { publishBattleRenderStatus, type BattleRenderStatus } from '@/lib/battles/status';
import { isPlaybackMapReady } from '@/lib/playback-readiness';
import { temporalWindow } from '@/lib/map-time';
import type { useAtlasStore } from '@/lib/store';
import { queryViewportFeatures } from './query-viewport';
import { hasResourceAt } from './resource-hit';

type State = ReturnType<typeof useAtlasStore.getState>;
const SOURCE = 'battle-catalogue';
const POINTS = 'battle-catalogue-points';
const SELECTED = 'battle-catalogue-selected';
const LAYER = 'battle-reconstructions';
const DURATION_MS = 40_000;
const SIDE_COLORS = [0x74a5c2, 0xc58d69, 0xb6ac7b, 0xaaa0ca];

type ModelInstance = {
  object: THREE.Group;
  mixer: THREE.AnimationMixer;
  march?: THREE.AnimationAction;
  engage?: THREE.AnimationAction;
  formation: FormationUnit;
  army: SimulationArmy;
  primitiveNodes: THREE.Mesh[];
};
type ArmyBatch = {
  models: ModelInstance[];
  primitives: THREE.InstancedMesh[];
  shadows: THREE.InstancedMesh;
  bases: THREE.InstancedMesh;
};
type BattleScene = {
  record: BattleRecord;
  simulation: BattleSimulation;
  scene: THREE.Scene;
  models: ModelInstance[];
  batches: ArmyBatch[];
  focused: boolean;
  disposables: { dispose(): void }[];
  profiles: Map<string, ResolvedUnitProfile>;
};

/** A bounded, lazy map layer. The optional illustration never holds the historical map gate. */
export function startBattleOverlay(
  map: MapInstance,
  getCurrentState: () => State,
  initialReduced: boolean,
) {
  let disposed = false;
  let applied = getCurrentState();
  let reduced = initialReduced;
  let active = false;
  let generation = 0;
  let focusedId: string | null = null;
  let revision = applied.battleRevision;
  let progress = applied.battleProgress;
  let previousTime: number | null = null;
  let repaintTimer: ReturnType<typeof setTimeout> | undefined;
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  let overviewTimer: ReturnType<typeof setTimeout> | undefined;
  let lastStatus = -Infinity;
  let lastOverview = -Infinity;
  let renderer: THREE.WebGLRenderer | undefined;
  let catalogueLoading = false;
  const camera = new THREE.Camera();
  const loader = new GLTFLoader();
  const models = new Map<string, Promise<GLTF>>();
  const scenes = new Map<string, BattleScene>();
  const pending = new Set<string>();
  let desiredSceneIds = new Set<string>();
  const catalogue = new Map<string, BattleIndexEntry>();
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let status: BattleRenderStatus['status'] = 'loading';

  const emit = (force = false, error?: string, rendered = false) => {
    if (disposed) return;
    const now = performance.now();
    if (!force && now - lastStatus < 150) return;
    lastStatus = now;
    const focus = focusedId ? scenes.get(focusedId) : undefined;
    const armies = focus?.simulation.armies.map((army) => {
      const renderedModels = focus.models.filter((model) => model.army.id === army.id);
      const losses = { activeModels: 0, withdrawnModels: 0, deadModels: 0 };
      for (const model of renderedModels) {
        const loss = unitLossState(army, model.formation.index, progress);
        if (loss === 'dead') losses.deadModels++;
        else if (loss === 'withdrawn') losses.withdrawnModels++;
        else losses.activeModels++;
      }
      return {
        id: army.id,
        label: army.name[applied.locale] ?? army.name.en,
        models: renderedModels.length,
        ...losses,
        counts:
          army.medium === 'naval'
            ? ('ships' as const)
            : army.medium === 'air'
              ? ('aircraft' as const)
              : ('soldiers' as const),
        strength: army.strength,
        casualties: army.casualties,
        deaths: army.deaths,
        soldiersPerModel: army.soldiersPerModel,
        symbolic: army.symbolic,
        profileLabel: focus?.profiles.get(army.id)?.label,
        profileEvidence: focus?.profiles.get(army.id)?.evidence,
        profileSources: focus?.profiles.get(army.id)?.sources,
      };
    });
    const detail: BattleRenderStatus & { rendered: boolean } = {
      status,
      eventId: focusedId ?? undefined,
      progress,
      models:
        focus?.models.length ??
        [...scenes.values()].reduce((sum, scene) => sum + scene.models.length, 0),
      scale: armies?.find((army) => army.soldiersPerModel !== undefined)?.soldiersPerModel,
      armycounts: armies,
      error,
      rendered,
    };
    publishBattleRenderStatus(detail);
    const container = map.getContainer();
    container.dataset.battleStatus = status;
    container.dataset.battleModels = String(detail.models);
    container.dataset.battleEvent = detail.eventId ?? '';
    container.dataset.battleProgress = progress.toFixed(3);
    if (rendered) container.dataset.battleRendered = 'true';
  };

  const freeScene = (scene: BattleScene) => {
    for (const model of scene.models) model.mixer.stopAllAction();
    for (const resource of scene.disposables) resource.dispose();
    scene.scene.clear();
  };
  const removeScenes = () => {
    for (const scene of scenes.values()) freeScene(scene);
    scenes.clear();
    pending.clear();
    desiredSceneIds.clear();
    map.getContainer().dataset.battleRendered = 'false';
  };
  const readModel = (path: string) => {
    let promise = models.get(path);
    if (!promise) {
      promise = loader.loadAsync(path).catch((error) => {
        models.delete(path);
        throw error;
      });
      models.set(path, promise);
    }
    return promise;
  };

  const buildScene = async (record: BattleRecord, focused: boolean): Promise<BattleScene> => {
    const simulation = buildBattleSimulation(record, focused ? (mobile ? 36 : 80) : mobile ? 4 : 8);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xddeafb, 0x604b36, 2.5));
    const light = new THREE.DirectionalLight(0xffedcf, 3.8);
    light.position.set(-12, 25, 18);
    scene.add(light);
    const resources: BattleScene['disposables'] = [];
    const formations = formationPositions(simulation.armies, record.medium);
    const profiles = new Map<string, ResolvedUnitProfile>();
    const instances: ModelInstance[] = [];
    const batches: ArmyBatch[] = [];
    const bySide = [...new Set(simulation.armies.map((army) => army.sideId ?? army.id))];
    const shadowGeometry = new THREE.CircleGeometry(1, 20);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x151914,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    resources.push(shadowGeometry, shadowMaterial);
    const ringGeometry = new THREE.RingGeometry(6, 6.08, 72);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xd5b66f,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    resources.push(ringGeometry, ringMaterial);
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    ring.scale.setScalar(focused ? 5 : 2);
    scene.add(ring);

    const builds = await Promise.allSettled(
      simulation.armies.map(async (army) => {
        const profile = resolveUnitProfile({
          profileId: army.profileId,
          participantId: army.participantId,
          equipmentPolityId: army.equipmentPolityId,
          year: record.start?.year ?? applied.year,
          medium: army.medium,
        });
        const year = record.start!.year;
        if (
          !profile.dateCompatible ||
          year < profile.dateRange[0] ||
          year > profile.dateRange[1] ||
          army.models === 0
        )
          return;
        profiles.set(army.id, profile);
        const gltf = await readModel(profile.modelUrl);
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        const size = bounds.getSize(new THREE.Vector3());
        const normalization =
          army.medium === 'naval'
            ? 5 / Math.max(size.x, size.z, 0.1)
            : army.medium === 'air'
              ? 4.5 / Math.max(size.x, size.z, 0.1)
              : 1;
        const color = SIDE_COLORS[bySide.indexOf(army.sideId ?? army.id) % SIDE_COLORS.length];
        const baseMaterial = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const baseGeometry = new THREE.RingGeometry(0.72, 0.83, 18);
        resources.push(baseGeometry, baseMaterial);
        const armyInstances: ModelInstance[] = [];
        for (const formation of formations.filter((entry) => entry.armyId === army.id)) {
          const object = gltf.scene.clone(true);
          object.position.set(formation.x, 0, formation.z);
          object.rotation.y = formation.heading;
          object.scale.setScalar(normalization);
          // The named, rigid articulated GLB hierarchy safely shares immutable geometry/materials.
          const mixer = new THREE.AnimationMixer(object);
          const marchClip = gltf.animations.find((clip) => clip.name === profile.animations.march);
          const engageClip = gltf.animations.find(
            (clip) => clip.name === profile.animations.engage,
          );
          const march = marchClip ? mixer.clipAction(marchClip).play() : undefined;
          const engage = engageClip ? mixer.clipAction(engageClip).play() : undefined;
          if (engage) engage.setEffectiveWeight(0);
          mixer.setTime(formation.phase);
          const primitiveNodes: THREE.Mesh[] = [];
          object.traverse((node) => {
            if (node instanceof THREE.Mesh) primitiveNodes.push(node);
          });
          const instance = { object, mixer, march, engage, formation, army, primitiveNodes };
          instances.push(instance);
          armyInstances.push(instance);
        }
        const primitives = (armyInstances[0]?.primitiveNodes ?? []).map(
          (mesh) => new THREE.InstancedMesh(mesh.geometry, mesh.material, army.models),
        );
        const shadows = new THREE.InstancedMesh(shadowGeometry, shadowMaterial, army.models);
        const bases = new THREE.InstancedMesh(baseGeometry, baseMaterial, army.models);
        for (const mesh of [...primitives, shadows, bases]) {
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          mesh.frustumCulled = false;
          scene.add(mesh);
          resources.push(mesh);
        }
        batches.push({ models: armyInstances, primitives, shadows, bases });
      }),
    );
    const failed = builds.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') {
      for (const model of instances) model.mixer.stopAllAction();
      for (const resource of resources) resource.dispose();
      scene.clear();
      throw failed.reason;
    }
    return {
      record,
      simulation,
      scene,
      models: instances,
      batches,
      focused,
      disposables: resources,
      profiles,
    };
  };

  const requestScene = async (id: string, focused: boolean, token: number) => {
    if (pending.has(id) || scenes.has(id)) return;
    pending.add(id);
    try {
      const record = await getBattle(id);
      if (disposed || token !== generation || !active || (!focused && !desiredSceneIds.has(id)))
        return;
      if (!battleOccursInYear(record, focused ? applied.year : (record.start?.year ?? NaN))) {
        if (focused) {
          status = 'empty';
          emit(true);
        }
        return;
      }
      const scene = await buildScene(record, focused);
      if (disposed || token !== generation || !active || (!focused && !desiredSceneIds.has(id))) {
        freeScene(scene);
        return;
      }
      scenes.set(id, scene);
      status = scene.models.length ? 'ready' : 'empty';
      previousTime = null;
      emit(true);
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => emit(true), 180);
      map.triggerRepaint();
    } catch (error) {
      if (!disposed && token === generation) {
        status = focused ? 'error' : scenes.size ? 'ready' : 'empty';
        emit(true, error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (token === generation) pending.delete(id);
    }
  };

  const updateOverview = () => {
    if (!active || disposed || focusedId || !map.getLayer(POINTS) || map.isMoving()) return;
    if (performance.now() - lastOverview < 450) {
      if (overviewTimer === undefined)
        overviewTimer = setTimeout(() => {
          overviewTimer = undefined;
          updateOverview();
        }, 450);
      return;
    }
    lastOverview = performance.now();
    const visible = queryViewportFeatures(map, [POINTS]);
    const ids = [...new Set(visible.map((feature) => String(feature.properties.id)))]
      .sort(
        (a, b) =>
          Number(catalogue.get(b)?.documented) - Number(catalogue.get(a)?.documented) ||
          a.localeCompare(b),
      )
      .slice(0, mobile ? 2 : 4);
    desiredSceneIds = new Set(ids);
    const changed = [...scenes.keys()].some((id) => !ids.includes(id));
    if (changed) {
      for (const [id, scene] of scenes)
        if (!ids.includes(id)) {
          freeScene(scene);
          scenes.delete(id);
        }
    }
    for (const id of ids) void requestScene(id, false, generation);
    if (!ids.length && !pending.size) {
      status = 'empty';
      emit(true);
    }
  };

  const scheduleFrame = () => {
    if (
      repaintTimer !== undefined ||
      disposed ||
      !active ||
      document.hidden ||
      !applied.battlePlaying ||
      !focusedId
    )
      return;
    repaintTimer = setTimeout(() => {
      repaintTimer = undefined;
      if (!disposed && active) map.triggerRepaint();
    }, 32);
  };

  const renderScenes = (_gl: WebGL2RenderingContext, args: CustomRenderMethodInput) => {
    if (!renderer || disposed || !active || !scenes.size) return;
    const now = performance.now();
    const playing =
      applied.battlePlaying && Boolean(focusedId) && !document.hidden && isPlaybackMapReady();
    if (playing && previousTime !== null)
      progress = Math.min(
        1,
        progress +
          (Math.min(100, Math.max(0, now - previousTime)) * applied.battleSpeed) / DURATION_MS,
      );
    previousTime = playing ? now : null;
    renderer.resetState();
    // MapLibre owns canvas dimensions and device pixel ratio; only match its current viewport.
    renderer.setViewport(0, 0, map.getCanvas().width, map.getCanvas().height);
    map.getContainer().dataset.battleProjection =
      args.defaultProjectionData.projectionTransition > 0 ? 'globe' : 'mercator';
    let renderedModels = 0;
    for (const scene of scenes.values()) {
      if (
        !scene.record.coords ||
        !scene.record.start ||
        !scene.models.length ||
        !battleAnchorIsVisible(scene.record.coords, args.defaultProjectionData) ||
        (scene.focused && !battleOccursInYear(scene.record, applied.year))
      )
        continue;
      const phase = scene.focused ? progress : 0;
      for (const unit of scene.models) {
        const loss = unitLossState(unit.army, unit.formation.index, phase);
        const advance = unitAdvanceDistance(
          unit.army.medium,
          scene.profiles.get(unit.army.id)?.role,
          phase,
          scene.simulation.hasOpposingSides,
        );
        unit.object.position.x = unit.formation.x - unit.formation.side * advance;
        unit.object.position.z = unit.formation.z;
        unit.object.position.y =
          unit.army.medium === 'air'
            ? 4 + (reduced ? 0 : Math.sin(phase * 6 + unit.formation.phase) * 0.15)
            : 0;
        unit.object.rotation.set(0, unit.formation.heading, 0);
        unit.object.visible = loss !== 'withdrawn';
        if (loss === 'dead') {
          unit.march?.setEffectiveWeight(0);
          unit.engage?.setEffectiveWeight(0);
          unit.mixer.setTime(0);
          unit.object.rotation.z = Math.PI / 2;
          unit.object.position.y = 0.28;
        } else {
          const engaging = scene.simulation.hasOpposingSides && phase >= 0.3;
          unit.march?.setEffectiveWeight(engaging ? 0 : 1);
          unit.engage?.setEffectiveWeight(engaging ? 1 : 0);
          unit.mixer.setTime(reduced ? 0 : (phase * DURATION_MS) / 1000 + unit.formation.phase);
        }
        unit.object.updateMatrixWorld(true);
      }
      const groundMatrix = new THREE.Matrix4();
      const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
      for (const batch of scene.batches) {
        for (let index = 0; index < batch.models.length; index++) {
          const unit = batch.models[index];
          for (let primitive = 0; primitive < batch.primitives.length; primitive++) {
            batch.primitives[primitive].setMatrixAt(
              index,
              unit.object.visible ? unit.primitiveNodes[primitive].matrixWorld : hiddenMatrix,
            );
          }
          groundMatrix
            .makeTranslation(unit.object.position.x, 0.025, unit.object.position.z)
            .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
          batch.bases.setMatrixAt(index, unit.object.visible ? groundMatrix : hiddenMatrix);
          groundMatrix.scale(
            new THREE.Vector3(
              unit.army.medium === 'land' ? 0.85 : 2.3,
              unit.army.medium === 'land' ? 0.55 : 1.2,
              1,
            ),
          );
          batch.shadows.setMatrixAt(index, unit.object.visible ? groundMatrix : hiddenMatrix);
        }
        for (const mesh of [...batch.primitives, batch.shadows, batch.bases])
          mesh.instanceMatrix.needsUpdate = true;
      }
      const metersPerPixel =
        (156543.03392 * Math.max(0.1, Math.cos((scene.record.coords[1] * Math.PI) / 180))) /
        2 ** map.getZoom();
      const scale = scene.focused ? 7 : Math.max(7, metersPerPixel * 4);
      camera.projectionMatrix.copy(
        battleProjectionMatrix(
          scene.record.coords,
          args.defaultProjectionData,
          scale,
          map.getCenter().lng,
        ),
      );
      renderer.render(scene.scene, camera);
      renderedModels += scene.models.length;
    }
    map.getContainer().dataset.battleRendered = String(renderedModels > 0);
    emit(false, undefined, renderedModels > 0);
    if (playing && progress >= 1) {
      Promise.resolve().then(() => {
        if (disposed || !active || !getCurrentState().battlePlaying) return;
        getCurrentState().setBattleProgress(1);
        getCurrentState().setBattlePlaying(false);
      });
    } else scheduleFrame();
  };

  const customLayer: CustomLayerInterface = {
    id: LAYER,
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    },
    render: renderScenes,
    onRemove() {
      renderer?.dispose();
      renderer = undefined;
    },
  };

  const catalogueFilter = (state: State): FilterSpecification => {
    const window = temporalWindow(state.speed, state.playing);
    const from = state.range?.[0] ?? state.year - window;
    const to = state.range?.[1] ?? state.year + window;
    const parts: unknown[] = ['all', ['<=', ['get', 'start'], to], ['>=', ['get', 'end'], from]];
    if (state.filters.types.length)
      parts.push(['in', ['get', 'type'], ['literal', state.filters.types]]);
    if (state.filters.regions.length)
      parts.push(['in', ['get', 'region'], ['literal', state.filters.regions]]);
    if (state.filters.eras.length)
      parts.push(['in', ['get', 'era'], ['literal', state.filters.eras]]);
    return parts as FilterSpecification;
  };

  const select = (event: MapLayerMouseEvent) => {
    if (hasResourceAt(map, event.point)) return;
    if (!active) return;
    const id = String(event.features?.[0]?.properties.id ?? '');
    const battle = catalogue.get(id);
    if (!battle?.coords) return;
    event.preventDefault();
    focusBattle(battle);
  };
  const enter = () => {
    if (active) map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
  };
  const onVisibility = () => {
    previousTime = null;
    clearTimeout(repaintTimer);
    repaintTimer = undefined;
    if (active && !document.hidden) map.triggerRepaint();
  };
  const onMotion = (event: MediaQueryListEvent) => {
    reduced = event.matches;
    if (active) map.triggerRepaint();
  };
  map.on('idle', updateOverview);
  map.on('moveend', updateOverview);
  document.addEventListener('visibilitychange', onVisibility);
  media.addEventListener('change', onMotion);

  const update = (state: State) => {
    if (disposed) return;
    const previous = applied;
    applied = state;
    const wasActive = active;
    active = state.battlesVisible && state.battleMode;
    if (map.getLayer(POINTS)) {
      map.setLayoutProperty(POINTS, 'visibility', active ? 'visible' : 'none');
      map.setLayoutProperty(SELECTED, 'visibility', active ? 'visible' : 'none');
      map.setFilter(POINTS, catalogueFilter(state));
      map.setFilter(SELECTED, ['==', ['get', 'id'], state.selectedEvent ?? '']);
    }
    if (!active) {
      if (wasActive) {
        generation++;
        removeScenes();
        focusedId = null;
        previousTime = null;
        clearTimeout(repaintTimer);
        repaintTimer = undefined;
        status = 'empty';
        emit(true);
        map.triggerRepaint();
      }
      return;
    }
    const seekChanged = state.battleRevision !== revision;
    if (seekChanged) {
      revision = state.battleRevision;
      progress = state.battleProgress;
      previousTime = null;
    }
    if (!wasActive || state.selectedEvent !== focusedId) {
      generation++;
      removeScenes();
      focusedId = state.selectedEvent;
      progress = state.battleProgress;
      previousTime = null;
      status = 'loading';
      emit(true);
      if (focusedId) void requestScene(focusedId, true, generation);
      else {
        lastOverview = -Infinity;
        updateOverview();
      }
    } else if (focusedId && previous.year !== state.year) {
      generation++;
      removeScenes();
      status = 'loading';
      emit(true);
      void requestScene(focusedId, true, generation);
    } else if (
      !focusedId &&
      (previous.year !== state.year ||
        previous.filters !== state.filters ||
        previous.range !== state.range)
    ) {
      generation++;
      removeScenes();
      lastOverview = -Infinity;
    }
    if (seekChanged && focusedId && !scenes.has(focusedId) && !pending.has(focusedId)) {
      status = 'loading';
      emit(true);
      void requestScene(focusedId, true, generation);
    }
    if (!map.getLayer(POINTS)) loadCatalogue();
    if (!state.battlePlaying) previousTime = null;
    if (focusedId && scenes.has(focusedId)) emit(true);
    map.triggerRepaint();
  };

  const loadCatalogue = () => {
    if (disposed || catalogueLoading || map.getLayer(POINTS)) return;
    catalogueLoading = true;
    void getBattleIndex()
      .then((index) => {
        if (disposed) return;
        const features: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };
        for (const entry of index.battles) {
          catalogue.set(entry.id, entry);
          if (!entry.coords || !entry.start) continue;
          features.features.push({
            type: 'Feature',
            id: entry.id,
            geometry: { type: 'Point', coordinates: entry.coords },
            properties: {
              id: entry.id,
              type: entry.type,
              region: entry.region ?? '',
              era: entry.era ?? '',
              start: entry.start.year,
              end: entry.end?.year ?? entry.start.year,
              documented: entry.documented,
            },
          });
        }
        map.addSource(SOURCE, { type: 'geojson', data: features, maxzoom: 8, tolerance: 0 });
        map.addLayer({
          id: POINTS,
          type: 'circle',
          source: SOURCE,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2.5, 6, 5, 14, 7],
            'circle-color': ['case', ['get', 'documented'], '#e8c784', '#aebcbc'],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#172c35',
            'circle-opacity': 0.9,
          },
        });
        map.addLayer({
          id: SELECTED,
          type: 'circle',
          source: SOURCE,
          filter: ['==', ['get', 'id'], ''],
          paint: {
            'circle-radius': 11,
            'circle-color': 'transparent',
            'circle-stroke-color': '#ffe2a3',
            'circle-stroke-width': 2,
          },
        });
        map.addLayer(customLayer);
        map.on('click', POINTS, select);
        map.on('mouseenter', POINTS, enter);
        map.on('mouseleave', POINTS, leave);
        if (scenes.size)
          status = [...scenes.values()].some((scene) => scene.models.length) ? 'ready' : 'empty';
        update(applied);
        map.triggerRepaint();
      })
      .catch((error) => {
        if (!disposed) {
          status = 'error';
          emit(true, String(error));
        }
      })
      .finally(() => {
        catalogueLoading = false;
      });
  };

  loadCatalogue();
  update(applied);
  return {
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      clearTimeout(repaintTimer);
      clearTimeout(statusTimer);
      clearTimeout(overviewTimer);
      removeScenes();
      map.off('idle', updateOverview);
      map.off('moveend', updateOverview);
      map.off('click', POINTS, select);
      map.off('mouseenter', POINTS, enter);
      map.off('mouseleave', POINTS, leave);
      document.removeEventListener('visibilitychange', onVisibility);
      media.removeEventListener('change', onMotion);
      for (const id of [LAYER, SELECTED, POINTS]) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      for (const promise of models.values())
        void promise
          .then((gltf) => {
            const geometries = new Set<THREE.BufferGeometry>();
            const materials = new Set<THREE.Material>();
            const textures = new Set<THREE.Texture>();
            gltf.scene.traverse((object) => {
              if (!(object instanceof THREE.Mesh)) return;
              geometries.add(object.geometry);
              for (const material of Array.isArray(object.material)
                ? object.material
                : [object.material]) {
                materials.add(material);
                for (const value of Object.values(material))
                  if (value instanceof THREE.Texture) textures.add(value);
              }
            });
            for (const resource of [...geometries, ...materials, ...textures]) resource.dispose();
          })
          .catch(() => {});
      models.clear();
    },
  };
}
