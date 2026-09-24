'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  Map as MapInstance,
  MapLayerMouseEvent,
  FilterSpecification,
  StyleSpecification,
  VectorTileSource,
} from 'maplibre-gl';
import { useAtlasStore } from '@/lib/store';
import { translateCopy, useI18n } from '@/lib/i18n';
import { getEvent, readJson, type DataManifest } from '@/lib/data-client';
import { selectEventArchive } from '@/lib/event-archives';
import { boundaryFrames, wrapLongitude } from '@/lib/map-boundaries';
import { createPlaybackMapGate } from '@/lib/playback-readiness';
import { publishBattleRenderStatus } from '@/lib/battles/status';
import type { GeographyManifest } from '@/lib/geography';
import { addEventSprites } from './markers';
import { EMPTY_FEATURE_FILTER } from './style-filters';
import { clusterFilterPurpose, eventFilter, selectedEventFilter } from './event-filters';
import { HEAT_COLOR, HEAT_RADIUS } from './heat-style';
import { queryViewportFeatures } from './query-viewport';
import { createRenderQueue } from './render-queue';
import { attachEventClustering, EVENT_QUERY_LAYER, type EventClustering } from './event-clusters';
import { hasResourceAt } from './resource-hit';
import { useResourceStore } from '@/lib/resources/store';
import { hasReligionAt } from './religion-hit';
import { useReligionStore } from '@/lib/religions/store';
import { EVENT_COLOR_EXPRESSION, SELECTION_COLORS } from '@/lib/colors/semantic';
import 'maplibre-gl/dist/maplibre-gl.css';

type AtlasState = ReturnType<typeof useAtlasStore.getState>;
const eventColor = EVENT_COLOR_EXPRESSION;

function makeStyle(
  manifest: GeographyManifest,
  dark: boolean,
  projection: 'globe' | 'mercator',
): StyleSpecification {
  return {
    version: 8,
    'font-faces': { 'Atlas Serif': '/fonts/cormorant.woff2', 'Atlas UI': '/fonts/manrope.woff2' },
    projection: { type: projection },
    sources: {
      physical: { type: 'vector', url: `pmtiles://${location.origin}${manifest.basemap.url}` },
    },
    layers: [
      {
        id: 'ocean',
        type: 'background',
        paint: { 'background-color': dark ? '#0b2636' : '#c9d9db' },
      },
      {
        id: 'land',
        type: 'fill',
        source: 'physical',
        'source-layer': 'land',
        paint: { 'fill-color': dark ? '#34494d' : '#d8d4b9' },
      },
      {
        id: 'coastline',
        type: 'line',
        source: 'physical',
        'source-layer': 'coastline',
        paint: {
          'line-color': dark ? '#668184' : '#9aa799',
          'line-width': 0.5,
          'line-opacity': 0.45,
        },
      },
      {
        id: 'rivers',
        type: 'line',
        source: 'physical',
        'source-layer': 'rivers',
        minzoom: 2,
        paint: {
          'line-color': dark ? '#749da8' : '#86a7af',
          'line-width': 0.65,
          'line-opacity': 0.25,
        },
      },
      {
        id: 'relief',
        type: 'fill',
        source: 'physical',
        'source-layer': 'relief',
        paint: { 'fill-color': dark ? '#152e35' : '#b8b89b', 'fill-opacity': 0.12 },
      },
      {
        id: 'modern-borders',
        type: 'line',
        source: 'physical',
        'source-layer': 'current_borders',
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#a5b4ad',
          'line-width': 0.7,
          'line-dasharray': [3, 3],
          'line-opacity': 0.4,
        },
      },
    ],
  };
}

/** Hidden description of the canvas: purpose and keyboard shortcuts. */
const MAP_DESCRIPTION_ID = 'atlas-map-description';

export default function WorldMap() {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  // Each attempt mounts a fresh map, playback gate and overlays, as a remount would.
  const [attempt, setAttempt] = useState(0);
  const mapLabel = t('Carte historique interactive', 'Interactive historical map');

  // MapLibre names its canvas only when it is created; follow later language changes.
  useEffect(() => {
    mapRef.current?.getCanvas().setAttribute('aria-label', mapLabel);
  }, [mapLabel, ready]);

  useEffect(() => {
    let disposed = false;
    let initializeFrame = 0;
    let cleanup: (() => void) | undefined;
    const playbackGate = createPlaybackMapGate();
    playbackGate.wait();
    const initialize = async () => {
      try {
        const [maplibre, { Protocol }, geo] = await Promise.all([
          import('maplibre-gl'),
          import('pmtiles'),
          readJson<GeographyManifest>('/geo/manifest.json'),
        ]);
        if (disposed || !container.current) return;
        maplibre.setWorkerUrl(`/vendor/maplibre/${maplibre.getVersion()}/maplibre-gl-worker.mjs`);
        const protocol = new Protocol();
        maplibre.addProtocol('pmtiles', protocol.tile);
        const initial = useAtlasStore.getState();
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const map = new maplibre.Map({
          container: container.current,
          style: makeStyle(geo, initial.theme === 'dark', initial.projection),
          center: [initial.camera.lon, initial.camera.lat],
          zoom: initial.camera.zoom,
          bearing: initial.camera.bearing,
          pitch: initial.camera.pitch,
          minZoom: 0,
          maxZoom: 18,
          maxPitch: 85,
          attributionControl: false,
          canvasContextAttributes: { antialias: true },
          fadeDuration: reduced ? 0 : 350,
          // The focusable canvas is the map's only landmark; name it in the reader's language.
          locale: {
            'Map.Title': translateCopy(
              initial.locale,
              'Carte historique interactive',
              'Interactive historical map',
            ),
          },
        });
        map.getCanvas().setAttribute('aria-describedby', MAP_DESCRIPTION_ID);
        mapRef.current = map;
        let currentBoundarySources: string[] = [];
        let lastYear = initial.year;
        let eventsReady = false;
        let eventClustering: EventClustering | undefined;
        let eventManifest: DataManifest | undefined;
        let eventArchive: string | undefined;
        let styleReady = false;
        let movingFromStore = false;
        let reconcilingInitialState = false;
        let campaignOverlay:
          ReturnType<(typeof import('./campaign-overlay'))['startCampaignOverlay']> | undefined;
        let battleOverlay:
          ReturnType<(typeof import('./battle-overlay'))['startBattleOverlay']> | undefined;
        let battleOverlayLoading = false;
        let resourceOverlay:
          ReturnType<(typeof import('./resource-overlay'))['startResourceOverlay']> | undefined;
        let resourceOverlayLoading = false;
        let religionOverlay:
          ReturnType<(typeof import('./religion-overlay'))['startReligionOverlay']> | undefined;
        let religionOverlayLoading = false;
        let adjustingBattlePadding = false;
        const frameBattlefield = (state: AtlasState) => {
          const focused = state.battlesVisible && state.battleMode && Boolean(state.selectedEvent);
          const narrow = map.getContainer().clientWidth <= 580;
          const padding = focused
            ? narrow
              ? {
                  top: 20,
                  right: 0,
                  bottom: Math.min(360, window.innerHeight * 0.44) + 20,
                  left: 0,
                }
              : {
                  top: 20,
                  right: 60,
                  bottom: 20,
                  left: Math.min(370, map.getContainer().clientWidth * 0.3),
                }
            : { top: 0, right: 0, bottom: 0, left: 0 };
          const previous = map.getPadding();
          if (
            Object.entries(padding).every(
              ([key, value]) => previous[key as keyof typeof padding] === value,
            )
          )
            return;
          // Padding moves the screen centre without changing the historical coordinate in shared URLs.
          adjustingBattlePadding = true;
          try {
            map.setPadding(padding);
          } finally {
            adjustingBattlePadding = false;
          }
        };
        map.on('resize', () => frameBattlefield(useAtlasStore.getState()));
        let overlayToken = 0;
        let boundaryUse = 0;
        let ghostToken = 0;
        let ghostLayer: string | null = null;
        let ghostReady: (() => void) | null = null;
        let retiringTerritories = false;

        const selectMapEvent = (id: string) => {
          useAtlasStore.getState().patchState({
            selectedEvent: id,
            selectedEntity: null,
            selectedPerson: null,
            playing: false,
          });
          void getEvent(id)
            .then((item) => {
              if (!disposed && useAtlasStore.getState().selectedEvent === id && item.coords)
                map.easeTo({ center: item.coords, duration: reduced ? 0 : 650 });
            })
            .catch(() => {});
        };
        const boundaryResources = new Map<
          string,
          {
            detach: () => void;
            lastUsed: number;
            retirement: ReturnType<typeof setTimeout> | null;
          }
        >();

        const cancelGhost = () => {
          ghostToken += 1;
          if (ghostReady) map.off('idle', ghostReady);
          ghostReady = null;
          if (!disposed && ghostLayer && map.getLayer(ghostLayer)) {
            map.setPaintProperty(ghostLayer, 'fill-opacity-transition', { duration: 0 });
            map.setPaintProperty(ghostLayer, 'fill-opacity', 0);
          }
          ghostLayer = null;
        };

        const showPreviousTerritory = (id: string, year: number) => {
          if (reduced || useAtlasStore.getState().playing) return;
          cancelGhost();
          const token = ghostToken;
          const layer = `${id}-ghost`;
          ghostLayer = layer;
          map.setFilter(layer, [
            'all',
            ['<=', ['get', 'fromYear'], year],
            ['>=', ['get', 'toYear'], year],
          ]);
          // Establish a visible frame immediately, without interpolating up from zero.
          map.setPaintProperty(layer, 'fill-opacity-transition', { duration: 0 });
          map.setPaintProperty(layer, 'fill-opacity', 0.13);
          const fade = () => {
            if (disposed || token !== ghostToken) return;
            if (useAtlasStore.getState().playing || !map.getLayer(layer)) {
              cancelGhost();
              return;
            }
            if (!map.getSource(id) || !map.isSourceLoaded(id)) return;
            map.off('idle', fade);
            ghostReady = null;
            // Idle follows a rendered frame with the required source tiles available.
            map.setPaintProperty(layer, 'fill-opacity-transition', { duration: 550 });
            map.setPaintProperty(layer, 'fill-opacity', 0);
          };
          ghostReady = fade;
          map.on('idle', fade);
          map.triggerRepaint();
        };

        const removeTerritorySource = (id: string) => {
          if (ghostLayer === `${id}-ghost`) cancelGhost();
          const resource = boundaryResources.get(id);
          // Source removal emits synchronous data events. Detach bookkeeping first.
          boundaryResources.delete(id);
          if (resource?.retirement) clearTimeout(resource.retirement);
          resource?.detach();
          for (const suffix of ['ghost', 'fill', 'border', 'label']) {
            if (map.getLayer(`${id}-${suffix}`)) map.removeLayer(`${id}-${suffix}`);
          }
          if (map.getSource(id)) map.removeSource(id);
        };

        const territoriesLoaded = () =>
          currentBoundarySources.every((id) => map.getSource(id) && map.isSourceLoaded(id));

        const retirePreviousTerritories = () => {
          if (
            disposed ||
            retiringTerritories ||
            !currentBoundarySources.length ||
            !territoriesLoaded()
          )
            return;
          retiringTerritories = true;
          try {
            for (const [id, resource] of boundaryResources) {
              if (currentBoundarySources.includes(id) || resource.retirement !== null) continue;
              map.setPaintProperty(`${id}-ghost`, 'fill-opacity', 0);
              map.setPaintProperty(`${id}-fill`, 'fill-opacity', 0);
              map.setPaintProperty(`${id}-border`, 'line-opacity', 0);
              if (reduced) removeTerritorySource(id);
              else
                resource.retirement = setTimeout(() => {
                  if (!disposed && !currentBoundarySources.includes(id)) removeTerritorySource(id);
                }, 450);
            }
          } finally {
            retiringTerritories = false;
          }
        };
        map.on('sourcedata', retirePreviousTerritories);

        const addTerritoryLayers = (
          id: string,
          url: string,
          sourceLayer: string,
          labelLayer: string,
          temporal: boolean,
        ) => {
          const existing = boundaryResources.get(id);
          if (existing) {
            existing.lastUsed = ++boundaryUse;
            if (existing.retirement !== null) clearTimeout(existing.retirement);
            existing.retirement = null;
            return;
          }
          // Retain the most recent loaded predecessor while bounding fast-scrub memory.
          while (boundaryResources.size >= 4) {
            const candidates = [...boundaryResources].filter(
              ([key]) => !currentBoundarySources.includes(key),
            );
            candidates.sort(
              ([a, left], [b, right]) =>
                Number(map.isSourceLoaded(a)) - Number(map.isSourceLoaded(b)) ||
                left.lastUsed - right.lastUsed,
            );
            if (!candidates.length) break;
            removeTerritorySource(candidates[0][0]);
          }
          const dark = useAtlasStore.getState().theme === 'dark';
          map.addSource(id, { type: 'vector', url: `pmtiles://${location.origin}${url}` });
          map.addLayer(
            {
              id: `${id}-ghost`,
              type: 'fill',
              source: id,
              'source-layer': sourceLayer,
              paint: {
                'fill-color': ['get', 'color'],
                'fill-opacity': 0,
                'fill-opacity-transition': { duration: reduced ? 0 : 550 },
              },
            },
            eventsReady ? 'event-halo' : undefined,
          );
          map.addLayer(
            {
              id: `${id}-fill`,
              type: 'fill',
              source: id,
              'source-layer': sourceLayer,
              paint: {
                'fill-color': ['get', 'color'],
                'fill-opacity': 0,
                'fill-opacity-transition': { duration: reduced ? 0 : 450 },
              },
            },
            eventsReady ? 'event-halo' : undefined,
          );
          map.addLayer(
            {
              id: `${id}-border`,
              type: 'line',
              source: id,
              'source-layer': sourceLayer,
              paint: {
                'line-color': ['get', 'color'],
                'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.55, 6, 1.3],
                'line-opacity': 0,
                'line-opacity-transition': { duration: reduced ? 0 : 450 },
                'line-dasharray': [5, 2],
              },
            },
            eventsReady ? 'event-halo' : undefined,
          );
          map.addLayer({
            id: `${id}-label`,
            type: 'symbol',
            source: id,
            'source-layer': labelLayer,
            minzoom: 1.5,
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['Atlas Serif'],
              'text-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                1.5,
                [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['get', 'areaKm2'], 0],
                  0,
                  10,
                  1_000_000,
                  12,
                  10_000_000,
                  16,
                ],
                5,
                [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['get', 'areaKm2'], 0],
                  0,
                  12,
                  1_000_000,
                  18,
                  10_000_000,
                  24,
                ],
              ],
              'text-max-width': 8,
              'text-letter-spacing': 0.05,
              'text-padding': 22,
              'symbol-sort-key': ['-', ['get', 'areaKm2']],
            },
            paint: {
              'text-color': dark ? '#e9e3cb' : '#243b3f',
              'text-halo-color': dark ? '#203940' : '#eeead8',
              'text-halo-width': 1.5,
              'text-opacity': 0,
              'text-opacity-transition': { duration: reduced ? 0 : 450 },
            },
          });
          const click = (event: MapLayerMouseEvent) => {
            if (hasResourceAt(map, event.point) || hasReligionAt(map, event.point)) return;
            if (useAtlasStore.getState().battleMode) return;
            if (!currentBoundarySources.includes(id)) return;
            if (eventClustering?.hasFeatureAt(event.point)) return;
            if (
              map.queryRenderedFeatures(event.point, {
                layers: eventsReady ? ['event-points'] : [],
              }).length
            )
              return;
            const entityId = event.features?.[0]?.properties?.entityId;
            if (entityId)
              useAtlasStore.getState().patchState({
                selectedEntity: String(entityId),
                selectedEvent: null,
                selectedPerson: null,
              });
          };
          const enter = () => {
            if (!currentBoundarySources.includes(id)) return;
            map.getCanvas().style.cursor = 'pointer';
          };
          const leave = () => {
            map.getCanvas().style.cursor = '';
          };
          map.on('click', `${id}-fill`, click);
          map.on('mouseenter', `${id}-fill`, enter);
          map.on('mouseleave', `${id}-fill`, leave);
          boundaryResources.set(id, {
            lastUsed: ++boundaryUse,
            retirement: null,
            detach: () => {
              map.off('click', `${id}-fill`, click);
              map.off('mouseenter', `${id}-fill`, enter);
              map.off('mouseleave', `${id}-fill`, leave);
            },
          });
          if (!temporal) map.setFilter(`${id}-ghost`, EMPTY_FEATURE_FILTER);
        };

        const updateTerritories = (state: AtlasState) => {
          cancelGhost();
          const frames = boundaryFrames(geo, state.year, state.boundarySource);
          currentBoundarySources = frames.map((frame) => frame.id);
          for (const frame of frames) {
            const { id } = frame;
            const temporal = frame.year !== undefined;
            addTerritoryLayers(id, frame.url, frame.sourceLayer, frame.labelLayer, temporal);
            for (const suffix of ['ghost', 'fill', 'border', 'label'])
              map.setLayoutProperty(`${id}-${suffix}`, 'visibility', 'visible');
            map.setPaintProperty(`${id}-ghost`, 'fill-opacity', 0);
            map.setPaintProperty(
              `${id}-fill`,
              'fill-opacity',
              (temporal ? (state.theme === 'dark' ? 0.44 : 0.32) : 0.42) * frame.weight,
            );
            map.setPaintProperty(
              `${id}-border`,
              'line-opacity',
              (temporal ? 0.8 : 0.65) * frame.weight,
            );
            map.setPaintProperty(`${id}-label`, 'text-opacity', 0.82 * frame.weight);
            if (!temporal) continue;
            const filter: FilterSpecification = [
              'all',
              ['<=', ['get', 'fromYear'], frame.year!],
              ['>=', ['get', 'toYear'], frame.year!],
            ];
            for (const suffix of ['fill', 'border', 'label'])
              map.setFilter(`${id}-${suffix}`, filter);
            if (lastYear !== state.year && !state.playing && !reduced)
              showPreviousTerritory(id, lastYear);
          }
          for (const id of boundaryResources.keys()) {
            if (currentBoundarySources.includes(id)) continue;
            // A retained outline is only a loading transition, never a current political label.
            map.setLayoutProperty(`${id}-label`, 'visibility', 'none');
            map.setPaintProperty(`${id}-label`, 'text-opacity', 0);
          }
          retirePreviousTerritories();
          lastYear = state.year;
          const modern = state.year >= 2024;
          map.setLayoutProperty('modern-borders', 'visibility', modern ? 'visible' : 'none');
        };

        const apply = (state: AtlasState, previous?: AtlasState) => {
          if (!styleReady) return;
          frameBattlefield(state);
          if (state.playing && !previous?.playing) cancelGhost();
          if (
            !previous ||
            state.year !== previous.year ||
            state.theme !== previous.theme ||
            state.boundarySource !== previous.boundarySource
          )
            updateTerritories(state);
          if (eventsReady) {
            const nextArchive =
              eventManifest && selectEventArchive(eventManifest, state, eventArchive);
            if (nextArchive && nextArchive !== eventArchive) {
              eventClustering?.invalidate();
              eventArchive = nextArchive;
              (map.getSource('events') as VectorTileSource).setUrl(
                `pmtiles://${location.origin}${nextArchive}`,
              );
            }
            if (
              !previous ||
              state.year !== previous.year ||
              state.camera !== previous.camera ||
              state.filters !== previous.filters ||
              state.range !== previous.range ||
              state.selectedWar !== previous.selectedWar ||
              state.speed !== previous.speed ||
              state.playing !== previous.playing ||
              state.mode !== previous.mode ||
              state.battleMode !== previous.battleMode ||
              state.battlesVisible !== previous.battlesVisible ||
              state.projection !== previous.projection
            )
              eventClustering?.invalidate();
            const filter = eventFilter(state);
            for (const id of ['event-halo', 'event-points', 'event-icons', 'event-symbols'])
              map.setFilter(id, filter);
            // Heat aggregates every event above the reader's threshold; cluster counts do too
            // unless the period is too wide to query at every idle (clusterFilterPurpose).
            map.setFilter('event-heat', eventFilter(state, 'density'));
            map.setFilter(EVENT_QUERY_LAYER, eventFilter(state, clusterFilterPurpose(state)));
            map.setLayoutProperty(
              'event-heat',
              'visibility',
              state.mode === 'heatmap' && !state.battleMode ? 'visible' : 'none',
            );
            for (const id of ['event-halo', 'event-points', 'event-icons', 'event-symbols'])
              map.setLayoutProperty(
                id,
                'visibility',
                state.battleMode || state.mode === 'heatmap' || eventClustering?.isActive()
                  ? 'none'
                  : 'visible',
              );
            map.setLayoutProperty(
              'event-trails',
              'visibility',
              state.trails && !state.battleMode ? 'visible' : 'none',
            );
            map.setLayoutProperty(
              'event-selected',
              'visibility',
              state.battleMode ? 'none' : 'visible',
            );
            map.setFilter(
              'event-trails',
              eventFilter({ ...state, range: [state.year - 100, state.year - 1] }),
            );
            map.setFilter('event-selected', selectedEventFilter(state));
            if (!previous || state.locale !== previous.locale)
              map.setLayoutProperty('event-icons', 'text-field', [
                'coalesce',
                ['get', `name_${state.locale}`],
                ['get', 'name_en'],
              ]);
          }
          if (!previous || state.projection !== previous.projection)
            map.setProjection({ type: state.projection });
          if (state.battlesVisible && state.battleMode && !battleOverlay && !battleOverlayLoading) {
            battleOverlayLoading = true;
            void import('./battle-overlay')
              .then(({ startBattleOverlay }) => {
                if (disposed) return;
                battleOverlay = startBattleOverlay(map, useAtlasStore.getState, reduced);
                battleOverlay.update(appliedState ?? state);
              })
              .catch((cause) => {
                if (disposed) return;
                console.warn('Battle reconstruction could not be loaded', cause);
                const current = useAtlasStore.getState();
                publishBattleRenderStatus({
                  status: 'error',
                  eventId: current.selectedEvent ?? undefined,
                  progress: current.battleProgress,
                  models: 0,
                  error: String(cause),
                });
              })
              .finally(() => {
                battleOverlayLoading = false;
              });
          }
          battleOverlay?.update(state);
          if (state.resourcesVisible && !resourceOverlay && !resourceOverlayLoading) {
            resourceOverlayLoading = true;
            useResourceStore.setState({ status: 'loading', error: null });
            void import('./resource-overlay')
              .then(({ startResourceOverlay }) => {
                if (disposed) return;
                resourceOverlay = startResourceOverlay(map, reduced);
                const current = useAtlasStore.getState();
                resourceOverlay.update(current.resourcesVisible, current.year, current.range);
              })
              .catch((cause) => {
                if (!disposed) useResourceStore.setState({ status: 'error', error: String(cause) });
              })
              .finally(() => {
                resourceOverlayLoading = false;
              });
          }
          resourceOverlay?.update(state.resourcesVisible, state.year, state.range);
          if (state.religionsVisible && !religionOverlay && !religionOverlayLoading) {
            religionOverlayLoading = true;
            useReligionStore.setState({ status: 'loading', error: null });
            void import('./religion-overlay')
              .then(({ startReligionOverlay }) => {
                if (disposed) return;
                religionOverlay = startReligionOverlay(map);
                religionOverlay.update(useAtlasStore.getState());
              })
              .catch((cause) => {
                if (!disposed) useReligionStore.setState({ status: 'error', error: String(cause) });
              })
              .finally(() => {
                religionOverlayLoading = false;
              });
          }
          religionOverlay?.update(state);
          if (!previous || state.theme !== previous.theme) {
            const dark = state.theme === 'dark';
            map.setPaintProperty('ocean', 'background-color', dark ? '#0b2636' : '#c9d9db');
            map.setPaintProperty('land', 'fill-color', dark ? '#34494d' : '#d8d4b9');
            map.setPaintProperty('coastline', 'line-color', dark ? '#668184' : '#9aa799');
            map.setPaintProperty('rivers', 'line-color', dark ? '#749da8' : '#86a7af');
            map.setPaintProperty('relief', 'fill-color', dark ? '#152e35' : '#b8b89b');
            for (const id of boundaryResources.keys()) {
              map.setPaintProperty(`${id}-label`, 'text-color', dark ? '#e9e3cb' : '#243b3f');
              map.setPaintProperty(`${id}-label`, 'text-halo-color', dark ? '#203940' : '#eeead8');
            }
          }
          if (
            (reconcilingInitialState || (previous && state.camera !== previous.camera)) &&
            !movingFromStore
          ) {
            const center = map.getCenter();
            if (
              reconcilingInitialState ||
              Math.abs(wrapLongitude(center.lng) - state.camera.lon) > 0.001 ||
              Math.abs(center.lat - state.camera.lat) > 0.001 ||
              Math.abs(map.getZoom() - state.camera.zoom) > 0.001 ||
              Math.abs(map.getBearing() - state.camera.bearing) > 0.001 ||
              Math.abs(map.getPitch() - state.camera.pitch) > 0.001
            ) {
              const camera = {
                center: [state.camera.lon, state.camera.lat],
                zoom: state.camera.zoom,
                bearing: state.camera.bearing,
                pitch: state.camera.pitch,
              } as const;
              if (!previous) map.jumpTo({ ...camera, center: [...camera.center] });
              else
                map.flyTo({
                  ...camera,
                  center: [...camera.center],
                  duration: reduced ? 0 : 1000,
                  essential: false,
                });
            }
          }
          if (
            (!previous && (state.campaignId || state.selectedWar)) ||
            (previous &&
              (state.campaignId !== previous.campaignId ||
                state.campaignStep !== previous.campaignStep ||
                state.selectedWar !== previous.selectedWar))
          ) {
            const token = ++overlayToken;
            void import('./campaign-overlay')
              .then(({ startCampaignOverlay }) => {
                if (disposed || token !== overlayToken) return;
                campaignOverlay ??= startCampaignOverlay(map, reduced);
                return campaignOverlay.update(state);
              })
              .catch((cause) => console.warn('Campaign could not be loaded', cause));
          }
        };

        let appliedState: AtlasState | undefined;
        const renderQueue = createRenderQueue<AtlasState>({
          apply: (state) => {
            playbackGate.wait();
            apply(state, appliedState);
            appliedState = state;
          },
          isReady: () => {
            const loaded =
              territoriesLoaded() &&
              (!eventsReady || map.isSourceLoaded('events')) &&
              (resourceOverlay?.isReady() ?? true) &&
              (religionOverlay?.isReady() ?? true);
            if (loaded) playbackGate.ready();
            return loaded;
          },
          requestRender: () => map.triggerRepaint(),
        });

        map.on('load', () => {
          if (disposed) return;
          styleReady = true;
          reconcilingInitialState = true;
          renderQueue.submit(useAtlasStore.getState(), true);
          reconcilingInitialState = false;
          setReady(true);
          window.dispatchEvent(new Event('atlas:ready'));
          void readJson<DataManifest>('/data/manifest.json')
            .then((data) => {
              const archive = selectEventArchive(data, useAtlasStore.getState());
              if (disposed || !archive) return;
              eventManifest = data;
              eventArchive = archive;
              map.addSource('events', {
                type: 'vector',
                url: `pmtiles://${location.origin}${archive}`,
              });
              addEventSprites(map);
              map.addLayer({
                id: 'event-trails',
                type: 'circle',
                source: 'events',
                'source-layer': 'events',
                paint: { 'circle-radius': 2, 'circle-color': '#b9b29c', 'circle-opacity': 0.2 },
              });
              map.addLayer({
                id: 'event-heat',
                type: 'heatmap',
                source: 'events',
                'source-layer': 'events',
                paint: {
                  'heatmap-weight': ['/', ['get', 'importance'], 100],
                  'heatmap-intensity': 1.6,
                  'heatmap-radius': HEAT_RADIUS,
                  'heatmap-opacity': 0.75,
                  'heatmap-color': HEAT_COLOR,
                },
              });
              map.addLayer({
                id: 'event-halo',
                type: 'circle',
                source: 'events',
                'source-layer': 'events',
                paint: {
                  'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['get', 'importance'],
                    0,
                    7,
                    100,
                    17,
                  ],
                  'circle-color': eventColor as never,
                  'circle-opacity': 0.12,
                  'circle-blur': 0.3,
                },
              });
              map.addLayer({
                id: 'event-points',
                type: 'circle',
                source: 'events',
                'source-layer': 'events',
                paint: {
                  'circle-radius': ['interpolate', ['linear'], ['get', 'importance'], 0, 3, 100, 6],
                  'circle-color': eventColor as never,
                  'circle-stroke-width': 1.4,
                  'circle-stroke-color': '#fff0c8',
                  'circle-stroke-opacity': 0.7,
                },
              });
              map.addLayer({
                id: 'event-symbols',
                type: 'symbol',
                source: 'events',
                'source-layer': 'events',
                minzoom: 3.5,
                layout: {
                  'icon-image': ['concat', 'event-', ['get', 'type']],
                  'icon-size': ['interpolate', ['linear'], ['get', 'importance'], 0, 0.65, 100, 1],
                  'icon-padding': 8,
                  'symbol-sort-key': ['-', ['get', 'importance']],
                },
              });
              map.addLayer({
                id: 'event-icons',
                type: 'symbol',
                source: 'events',
                'source-layer': 'events',
                minzoom: 4.5,
                layout: {
                  'text-field': ['coalesce', ['get', `name_${initial.locale}`], ['get', 'name_en']],
                  'text-font': ['Atlas UI'],
                  'text-size': 11,
                  'text-offset': [0, 1.5],
                  'text-anchor': 'top',
                },
                paint: {
                  'text-color': '#f5e8cf',
                  'text-halo-color': '#102a37',
                  'text-halo-width': 1.7,
                },
              });
              map.addLayer({
                id: 'event-selected',
                type: 'circle',
                source: 'events',
                'source-layer': 'events',
                paint: {
                  'circle-radius': 12,
                  'circle-color': 'transparent',
                  'circle-stroke-width': 2,
                  'circle-stroke-color': SELECTION_COLORS.event,
                },
              });
              eventsReady = true;
              eventClustering = attachEventClustering(map, {
                getState: () => {
                  const state = useAtlasStore.getState();
                  return {
                    playing: state.playing,
                    mode: state.battleMode ? 'heatmap' : state.mode,
                  };
                },
                selectEvent: selectMapEvent,
                reducedMotion: reduced,
              });
              appliedState = undefined;
              renderQueue.submit(useAtlasStore.getState(), true);
              map.on('click', 'event-points', (event) => {
                if (hasResourceAt(map, event.point) || hasReligionAt(map, event.point)) return;
                const id = event.features?.[0]?.properties?.id;
                if (!id) return;
                selectMapEvent(String(id));
              });
              map.on('mouseenter', 'event-points', () => {
                map.getCanvas().style.cursor = 'pointer';
              });
              map.on('mouseleave', 'event-points', () => {
                map.getCanvas().style.cursor = '';
              });
            })
            .catch(() => {
              /* Geography remains available when the event corpus is unavailable. */
            });
        });
        map.on('moveend', () => {
          if (!styleReady || reconcilingInitialState || adjustingBattlePadding) return;
          const center = map.getCenter();
          movingFromStore = true;
          useAtlasStore.setState({
            camera: {
              lon: wrapLongitude(center.lng),
              lat: center.lat,
              zoom: map.getZoom(),
              bearing: map.getBearing(),
              pitch: map.getPitch(),
            },
          });
          movingFromStore = false;
        });
        let previousTerritories = '';
        let lastTerritoryPublication = -Infinity;
        const publishTerritories = (force = false) => {
          const now = performance.now();
          if (!territoriesLoaded() || (!force && now - lastTerritoryPublication < 250)) return;
          lastTerritoryPublication = now;
          const layers = currentBoundarySources
            .map((id) => `${id}-fill`)
            .filter((id) => map.getLayer(id));
          if (!layers.length) return;
          const features = queryViewportFeatures(map, layers);
          const territories = [
            ...new Map(
              features.map((feature) => [
                feature.properties.entityId,
                {
                  id: String(feature.properties.entityId),
                  name: String(feature.properties.name),
                  color: String(feature.properties.color),
                  areaKm2: Number(feature.properties.areaKm2),
                },
              ]),
            ).values(),
          ].sort((a, b) => b.areaKm2 - a.areaKm2);
          const key = JSON.stringify(territories);
          if (key !== previousTerritories) {
            previousTerritories = key;
            window.dispatchEvent(new CustomEvent('atlas:territories', { detail: territories }));
          }
        };
        map.on('render', () => {
          if (!styleReady || disposed) return;
          // Present the completed year before allowing another worker reparse.
          retirePreviousTerritories();
          publishTerritories();
          renderQueue.rendered();
        });
        map.on('idle', () => publishTerritories(true));
        map.on('error', (event) => {
          console.warn('Atlas cartography:', event.error.message);
          if (/WebGL|context lost/i.test(event.error.message)) {
            playbackGate.dispose();
            setError(true);
          }
          // A failed source can become settled without emitting another data event.
          if (!disposed) map.triggerRepaint();
        });
        const unsubscribe = useAtlasStore.subscribe((state, previous) => {
          if (!styleReady) return;
          // Playback may coalesce years, but direct interactions always take effect now.
          const interrupt =
            !state.playing ||
            (Object.keys(state) as (keyof AtlasState)[]).some(
              (key) => key !== 'year' && state[key] !== previous[key],
            );
          renderQueue.submit(state, interrupt);
        });
        const unsubscribeResources = useResourceStore.subscribe((state, previous) => {
          if (state.revision !== previous.revision && !resourceOverlay && styleReady)
            renderQueue.submit(useAtlasStore.getState(), true);
        });
        const unsubscribeReligions = useReligionStore.subscribe((state, previous) => {
          if (state.revision !== previous.revision && !religionOverlay && styleReady)
            renderQueue.submit(useAtlasStore.getState(), true);
        });
        cleanup = () => {
          unsubscribe();
          unsubscribeResources();
          unsubscribeReligions();
          renderQueue.dispose();
          campaignOverlay?.dispose();
          battleOverlay?.dispose();
          resourceOverlay?.dispose();
          religionOverlay?.dispose();
          eventClustering?.destroy();
          cancelGhost();
          map.off('sourcedata', retirePreviousTerritories);
          for (const resource of boundaryResources.values()) {
            if (resource.retirement !== null) clearTimeout(resource.retirement);
            resource.detach();
          }
          boundaryResources.clear();
          map.remove();
          mapRef.current = null;
          maplibre.removeProtocol('pmtiles');
        };
      } catch (cause) {
        console.error(cause);
        playbackGate.ready();
        if (!disposed) setError(true);
      }
    };
    // Let the shell paint before creating the WebGL context and compiling map shaders.
    initializeFrame = requestAnimationFrame(() => {
      initializeFrame = requestAnimationFrame(() => {
        if (!disposed) void initialize();
      });
    });
    return () => {
      disposed = true;
      playbackGate.dispose();
      cancelAnimationFrame(initializeFrame);
      if (cleanup) cleanup();
      else {
        // A setup that failed after creating the map must still release its WebGL context.
        mapRef.current?.remove();
        mapRef.current = null;
      }
    };
  }, [attempt]);

  return (
    <div className="world-map-wrap" data-ready={ready}>
      {/* MapLibre's focusable canvas is the named region; a second one here was redundant. */}
      <div ref={container} className="world-map" />
      <p id={MAP_DESCRIPTION_ID} hidden>
        {t('mapDescription')}{' '}
        {t(
          'Sur la carte : flèches pour se déplacer, + et − pour zoomer, Espace pour lancer ou arrêter la chronologie.',
          'On the map: arrow keys to pan, + and − to zoom, Space to play or pause the timeline.',
        )}
      </p>
      {!ready && !error && (
        <div className="map-loading">
          <span className="loading-globe" />
          <span>{t('Le monde prend forme…', 'The world is taking shape…')}</span>
        </div>
      )}
      {error && (
        <div className="map-error">
          <h2>{t('La carte n’a pas pu être chargée', 'The map could not be loaded')}</h2>
          <p>
            {t(
              'Vous pouvez explorer les événements dans la vue liste.',
              'Explore events using the list view.',
            )}
          </p>
          <div className="map-error-actions">
            <button
              type="button"
              data-testid="map-retry"
              onClick={() => {
                setError(false);
                setReady(false);
                setAttempt((value) => value + 1);
              }}
            >
              {t('Réessayer', 'Try again')}
            </button>
            <button onClick={() => useAtlasStore.setState({ mode: 'list' })}>
              {t('Ouvrir la liste', 'Open list')}
            </button>
          </div>
        </div>
      )}
      <div className="map-vignette" aria-hidden="true" />
    </div>
  );
}
