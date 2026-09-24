import { MapboxOverlay } from '@deck.gl/mapbox';
import { TripsLayer } from '@deck.gl/geo-layers';
import { IconLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Map } from 'maplibre-gl';
import { getCampaigns, readJson } from '@/lib/data-client';
import type { HistoricalEvent } from '@/lib/schema';
import type { useAtlasStore } from '@/lib/store';
import { hexToRgb, SELECTION_COLORS } from '@/lib/colors/semantic';
import {
  buildWarTracks,
  warTrackColor,
  warTrackSegments,
  type WarTrackArrow,
  type WarTrackLeg,
  type WarTrackPoint,
  type WarTrackSegment,
  type WarTracks,
} from '@/lib/war-tracks';

type State = ReturnType<typeof useAtlasStore.getState>;

// A right-pointing chevron, tinted per arrow by the chronological ramp (mask icon).
const WAR_ARROW_ICON = {
  id: 'war-track-arrow',
  url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M8 8 L42 24 L8 40 L17 24 Z" fill="#fff"/></svg>',
  )}`,
  width: 48,
  height: 48,
  mask: true,
};

/** Thin legs per theatre, direction chevrons, ramp-coloured points; numbers for short wars. */
function warTrackLayers(tracks: WarTracks) {
  return [
    new PathLayer<WarTrackLeg>({
      id: 'war-leg-casing',
      data: tracks.legs,
      getPath: (leg) => leg.path,
      getColor: [12, 33, 44, 150],
      getWidth: 3.5,
      widthUnits: 'pixels',
      jointRounded: true,
      capRounded: true,
    }),
    // One constant colour per segment: the globe re-tessellates paths (see warTrackSegments).
    new PathLayer<WarTrackSegment>({
      id: 'war-legs',
      data: warTrackSegments(tracks.legs),
      getPath: (segment) => segment.path,
      getColor: (segment) => warTrackColor(segment.ramp, 225),
      getWidth: 1.5,
      widthUnits: 'pixels',
      jointRounded: true,
      capRounded: true,
    }),
    new IconLayer<WarTrackArrow>({
      id: 'war-directions',
      data: tracks.arrows,
      getPosition: (arrow) => arrow.position,
      getIcon: () => WAR_ARROW_ICON,
      getAngle: (arrow) => arrow.angle,
      getColor: (arrow) => warTrackColor(arrow.ramp),
      // Lying on the map, a chevron follows its segment at any bearing and shrinks with it.
      billboard: false,
      sizeUnits: 'meters',
      getSize: (arrow) => Math.min(arrow.lengthKm * 350, 90_000),
      sizeMinPixels: 0,
      sizeMaxPixels: 11,
    }),
    new ScatterplotLayer<WarTrackPoint>({
      id: 'war-points',
      data: tracks.points,
      getPosition: (point) => point.coords,
      getRadius: 4,
      radiusUnits: 'pixels',
      getFillColor: (point) => warTrackColor(point.ramp),
      stroked: true,
      getLineColor: [35, 51, 57],
      getLineWidth: 1.25,
      lineWidthUnits: 'pixels',
    }),
    ...(tracks.numbered
      ? [
          new TextLayer<WarTrackPoint>({
            id: 'war-numbers',
            data: tracks.points,
            getPosition: (point) => point.coords,
            getText: (point) => String(point.order),
            getSize: 11,
            getColor: [255, 248, 222],
            getPixelOffset: [0, -14],
            fontFamily: 'Arial',
            outlineWidth: 2,
            outlineColor: [12, 33, 44],
          }),
        ]
      : []),
  ];
}

/** A campaign owns one GPU context; stepping only replaces its layer data. */
export function startCampaignOverlay(map: Map, reduced: boolean) {
  let overlay: MapboxOverlay | undefined;
  let frame = 0;
  let generation = 0;
  let disposed = false;

  const clear = () => {
    cancelAnimationFrame(frame);
    if (overlay && map.hasControl(overlay)) map.removeControl(overlay);
    overlay = undefined;
  };

  const update = async (state: State) => {
    if (disposed) return;
    const token = ++generation;
    cancelAnimationFrame(frame);
    if (!state.campaignId && !state.selectedWar) {
      clear();
      return;
    }
    const campaign = state.campaignId
      ? (await getCampaigns()).find((item) => item.id === state.campaignId)
      : null;
    const war =
      !campaign && state.selectedWar
        ? await readJson<HistoricalEvent[]>(`/data/wars/${state.selectedWar}.json`).catch(() => [])
        : [];
    // Curated campaign steps keep their animated chronology; a whole war is split by theatre.
    const tracks = campaign ? null : buildWarTracks(war);
    const steps = campaign?.steps ?? [];
    if (disposed || token !== generation) return;
    if (!steps.length && !tracks?.points.length) {
      clear();
      return;
    }
    if (!overlay) {
      overlay = new MapboxOverlay({ interleaved: false, layers: [] });
      map.addControl(overlay);
    }
    if (tracks) {
      overlay.setProps({ layers: warTrackLayers(tracks) });
      return;
    }
    const current = Math.min(state.campaignStep, steps.length - 1);
    const visibleSteps = steps.slice(0, current + 1);
    const path = visibleSteps.map((step) => step.coords);
    const data = [{ path, timestamps: path.map((_, index) => index) }];
    const started = performance.now();
    const render = () => {
      if (disposed || token !== generation || !overlay) return;
      const progress = reduced
        ? current
        : Math.min(current, Math.max(0, current - 1) + (performance.now() - started) / 1200);
      overlay.setProps({
        layers: [
          new TripsLayer({
            id: 'campaign-chronology',
            data,
            getPath: (item) => item.path,
            getTimestamps: (item) => item.timestamps,
            getColor: hexToRgb(SELECTION_COLORS.campaignRoute),
            widthMinPixels: 2.5,
            trailLength: steps.length + 1,
            currentTime: progress,
            opacity: 0.9,
          }),
          new ScatterplotLayer({
            id: 'campaign-steps',
            data: visibleSteps,
            getPosition: (item) => item.coords,
            getRadius: 5,
            radiusUnits: 'pixels',
            getFillColor: hexToRgb(SELECTION_COLORS.campaignStep),
            stroked: true,
            getLineColor: [35, 51, 57],
            getLineWidth: 2,
            lineWidthUnits: 'pixels',
          }),
          new TextLayer({
            id: 'campaign-numbers',
            data: visibleSteps,
            getPosition: (item) => item.coords,
            getText: (_, { index }) => String(index + 1),
            getSize: 11,
            getColor: [255, 248, 222],
            getPixelOffset: [0, -16],
            fontFamily: 'Arial',
            outlineWidth: 2,
            outlineColor: [12, 33, 44],
          }),
        ],
      });
      if (progress < current) frame = requestAnimationFrame(render);
    };
    render();
  };
  return {
    update,
    dispose() {
      disposed = true;
      generation++;
      clear();
    },
  };
}
