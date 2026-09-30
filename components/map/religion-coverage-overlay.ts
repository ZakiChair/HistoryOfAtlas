import type { FeatureCollection } from 'geojson';
import type { ExpressionSpecification, Map as MapInstance, MapLayerMouseEvent } from 'maplibre-gl';
import type { AtlasState } from '@/lib/store';
import { getReligionCoverageIndex } from '@/lib/religions/coverage-client';
import {
  religionCoverageAt,
  religionCoverageClasses,
  type ReligionCoverageEntry,
  type ReligionCoverageIndex,
} from '@/lib/religions/coverage';
import { publishReligionCoverage, useReligionCoverageStore } from '@/lib/religions/coverage-store';
import { useReligionStore } from '@/lib/religions/store';
import { useReligionPolityStore } from '@/lib/religions/polities-store';
import { RELIGION_COVERAGE_AREAS, RELIGION_COVERAGE_SOURCE } from './religion-hit';
import { raiseThematicLayers } from './thematic-stack';

const OUTLINE = 'religion-coverage-outlines';
const SELECTION = 'religion-coverage-selection';
const HATCH = 'religion-coverage-hatch-';
const idsFilter = (ids: string[]): ExpressionSpecification => [
  'in',
  ['get', 'id'],
  ['literal', ids],
];

const hatchId = (traditions: string[]) =>
  `${HATCH}${[...traditions].sort().map(encodeURIComponent).join('+')}`;

/** Disjoint coloured bands represent every minority, without one texture covering another. */
function hatchImage(colors: string[]) {
  // MapLibre fill-pattern textures must tile at power-of-two dimensions.
  const width = 2 ** Math.ceil(Math.log2(8 * colors.length)),
    data = new Uint8Array(width * width * 4);
  const channels = colors.map((color) =>
    [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16)),
  );
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      const stripe = (x + width - y) % width;
      const index = Math.floor((stripe * colors.length) / width);
      const start = Math.ceil((index * width) / colors.length);
      if (stripe - start >= 2) continue;
      const offset = (y * width + x) * 4;
      data.set([...channels[index], 230], offset);
    }
  return { width, height: width, data };
}

/** One immutable geometry source; time and filters only change style expressions. */
export function startReligionCoverageOverlay(map: MapInstance) {
  let state: AtlasState | undefined;
  let dataset: ReligionCoverageIndex | undefined;
  let installed = false,
    loading = false,
    disposed = false;
  let renderKey = '';
  const layerIds: string[] = [],
    images: string[] = [];
  let byGeometry = new Map<string, ReligionCoverageEntry>();
  const active = () => Boolean(state?.religionsVisible && state.religionView === 'dominant');
  const selection = () => {
    if (installed)
      map.setFilter(
        SELECTION,
        idsFilter(
          useReligionCoverageStore.getState().selected
            ? [useReligionCoverageStore.getState().selected!.geometryId]
            : [],
        ),
      );
  };
  const refresh = () => {
    if (!installed || !dataset || !state) return;
    for (const id of layerIds)
      map.setLayoutProperty(id, 'visibility', active() ? 'visible' : 'none');
    if (!active()) return;
    raiseThematicLayers(map);
    const key = `${state.range ? Math.max(...state.range) : state.year}:${state.religionFilter ?? ''}:${state.theme}`;
    if (key === renderKey) return;
    renderKey = key;
    const candidates = religionCoverageAt(dataset, state.year, state.range, state.religionFilter);
    const counts = new Map<string, number>();
    for (const row of candidates) counts.set(row.geometryId, (counts.get(row.geometryId) ?? 0) + 1);
    const visible = candidates.filter((row) => counts.get(row.geometryId) === 1);
    byGeometry = new Map(visible.map((row) => [row.geometryId, row]));
    publishReligionCoverage(dataset, visible);
    const color: unknown[] = ['match', ['get', 'id']];
    const opacity: unknown[] = ['match', ['get', 'id']];
    const traditions = new Map(dataset.traditions.map((item) => [item.id, item]));
    const hatches = new Map<string, string[]>();
    const filter = state.religionFilter;
    for (const row of visible) {
      const classification = religionCoverageClasses(dataset, row);
      const majority =
        classification.majority &&
        (!state.religionFilter || classification.majority === state.religionFilter)
          ? classification.majority
          : null;
      color.push(row.geometryId, majority ? traditions.get(majority)!.color : '#879196');
      opacity.push(row.geometryId, majority ? (state.theme === 'light' ? 0.48 : 0.55) : 0.2);
      const minorities = classification.substantial.filter((id) => !filter || id === filter);
      if (minorities.length) {
        const pattern = hatchId(minorities);
        const ids = hatches.get(pattern) ?? [];
        ids.push(row.geometryId);
        hatches.set(pattern, ids);
      }
    }
    map.setFilter(RELIGION_COVERAGE_AREAS, idsFilter([...byGeometry.keys()]));
    map.setFilter(OUTLINE, idsFilter([...byGeometry.keys()]));
    map.setPaintProperty(
      RELIGION_COVERAGE_AREAS,
      'fill-color',
      visible.length ? ([...color, '#879196'] as ExpressionSpecification) : '#879196',
    );
    map.setPaintProperty(
      RELIGION_COVERAGE_AREAS,
      'fill-opacity',
      visible.length ? ([...opacity, 0] as ExpressionSpecification) : 0,
    );
    map.setPaintProperty(OUTLINE, 'line-color', state.theme === 'light' ? '#3f565b' : '#d6e3e4');
    map.setPaintProperty(SELECTION, 'line-color', state.theme === 'light' ? '#172f37' : '#ffffff');
    for (const id of layerIds.filter((id) => id.startsWith(HATCH)))
      map.setFilter(id, idsFilter(hatches.get(id) ?? []));
    selection();
  };
  const clear = () => {
    installed = false;
    renderKey = '';
    byGeometry.clear();
    for (const id of [...layerIds].reverse()) if (map.getLayer(id)) map.removeLayer(id);
    layerIds.length = 0;
    if (map.getSource(RELIGION_COVERAGE_SOURCE)) map.removeSource(RELIGION_COVERAGE_SOURCE);
    for (const id of images) if (map.hasImage(id)) map.removeImage(id);
    images.length = 0;
  };
  const load = async () => {
    if (loading || installed || disposed || !active()) return;
    loading = true;
    useReligionCoverageStore.setState({ status: 'loading', error: null });
    try {
      dataset = await getReligionCoverageIndex();
      if (disposed) return;
      const data: FeatureCollection = {
        type: 'FeatureCollection',
        features: dataset.geometries.map((row) => ({
          type: 'Feature',
          id: row.id,
          properties: { id: row.id },
          geometry: row.geometry,
        })),
      };
      map.addSource(RELIGION_COVERAGE_SOURCE, { type: 'geojson', data });
      map.addLayer({
        id: RELIGION_COVERAGE_AREAS,
        type: 'fill',
        source: RELIGION_COVERAGE_SOURCE,
        filter: idsFilter([]),
        paint: {
          'fill-color': '#879196',
          'fill-opacity': 0,
          'fill-opacity-transition': { duration: 0 },
          'fill-color-transition': { duration: 0 },
        },
      });
      layerIds.push(RELIGION_COVERAGE_AREAS);
      const traditions = new Map(dataset.traditions.map((row) => [row.id, row]));
      const patterns = new Map<string, string[]>();
      for (const observation of dataset.observations) {
        const minorities = religionCoverageClasses(dataset, observation).substantial.sort();
        if (minorities.length) patterns.set(hatchId(minorities), minorities);
        // Filtering a tradition displays just its own bands, with no source rewrite.
        for (const id of minorities) patterns.set(hatchId([id]), [id]);
      }
      patterns.forEach((ids, id) => {
        if (!map.hasImage(id)) {
          map.addImage(id, hatchImage(ids.map((id) => traditions.get(id)!.color)));
          images.push(id);
        }
        map.addLayer({
          id,
          type: 'fill',
          source: RELIGION_COVERAGE_SOURCE,
          filter: idsFilter([]),
          paint: {
            'fill-pattern': id,
            'fill-opacity': 0.8,
            'fill-opacity-transition': { duration: 0 },
          },
        });
        layerIds.push(id);
      });
      map.addLayer({
        id: OUTLINE,
        type: 'line',
        source: RELIGION_COVERAGE_SOURCE,
        filter: idsFilter([]),
        paint: { 'line-color': '#d6e3e4', 'line-width': 0.7, 'line-opacity': 0.5 },
      });
      layerIds.push(OUTLINE);
      map.addLayer({
        id: SELECTION,
        type: 'line',
        source: RELIGION_COVERAGE_SOURCE,
        filter: idsFilter([]),
        paint: { 'line-color': '#ffffff', 'line-width': 2.2, 'line-opacity': 0.95 },
      });
      layerIds.push(SELECTION);
      installed = true;
      refresh();
      if (!active()) publishReligionCoverage(dataset, []);
      map.triggerRepaint();
    } catch (error) {
      if (!disposed) {
        clear();
        useReligionCoverageStore.setState({ status: 'error', error: String(error) });
      }
    } finally {
      loading = false;
    }
  };
  const hasForeground = (event: MapLayerMouseEvent) =>
    map.queryRenderedFeatures(event.point).some((feature) => {
      const id = feature.layer.id;
      return (
        id.startsWith('resource-') ||
        id === 'event-points' ||
        id.startsWith('event-cluster') ||
        id === 'religion-milestones' ||
        id === 'epidemic-milestones'
      );
    });
  const select = (event: MapLayerMouseEvent) => {
    if (!active() || !installed || disposed || event.defaultPrevented || hasForeground(event))
      return;
    const row = byGeometry.get(String(event.features?.[0]?.properties?.id ?? ''));
    if (row) {
      event.preventDefault();
      useReligionPolityStore.getState().select(null);
      useReligionCoverageStore.getState().select(row);
    }
  };
  const enter = () => {
    if (active()) map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
  };
  map.on('click', RELIGION_COVERAGE_AREAS, select);
  map.on('mouseenter', RELIGION_COVERAGE_AREAS, enter);
  map.on('mouseleave', RELIGION_COVERAGE_AREAS, leave);
  const unsubscribe = useReligionCoverageStore.subscribe((next, previous) => {
    if (next.selected !== previous.selected) selection();
    if (next.revision !== previous.revision) void load();
  });
  const unsubscribePanel = useReligionStore.subscribe((next, previous) => {
    if (!next.panelOpen && previous.panelOpen) useReligionCoverageStore.getState().select(null);
  });
  return {
    update(next: AtlasState) {
      const wasActive = active();
      state = next;
      if (!active() && wasActive) {
        useReligionCoverageStore.setState({
          selected: null,
          visibleObservations: [],
          detail: null,
          detailStatus: 'idle',
        });
        if (!next.religionsVisible) useReligionStore.getState().setPanelOpen(false);
        leave();
        renderKey = '';
      }
      refresh();
      if (active() && !wasActive) void load();
    },
    isReady: () => !active() || !installed || map.isSourceLoaded(RELIGION_COVERAGE_SOURCE),
    dispose() {
      disposed = true;
      unsubscribe();
      unsubscribePanel();
      map.off('click', RELIGION_COVERAGE_AREAS, select);
      map.off('mouseenter', RELIGION_COVERAGE_AREAS, enter);
      map.off('mouseleave', RELIGION_COVERAGE_AREAS, leave);
      clear();
      useReligionCoverageStore.setState({
        status: 'idle',
        selected: null,
        visibleObservations: [],
        detail: null,
        detailStatus: 'idle',
      });
    },
  };
}
