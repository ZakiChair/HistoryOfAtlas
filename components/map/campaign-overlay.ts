import { MapboxOverlay } from '@deck.gl/mapbox';
import { TripsLayer } from '@deck.gl/geo-layers';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Map } from 'maplibre-gl';
import { getCampaigns, readJson } from '@/lib/data-client';
import type { HistoricalEvent } from '@/lib/schema';
import type { useAtlasStore } from '@/lib/store';

type State = ReturnType<typeof useAtlasStore.getState>;

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
    const steps =
      campaign?.steps ??
      war
        .filter((event) => event.coords)
        .map((event) => ({
          coords: event.coords!,
          label: event.name[state.locale] ?? event.name.en,
          date: event.start,
        }));
    if (disposed || token !== generation) return;
    if (!steps.length) {
      clear();
      return;
    }
    const current = campaign ? Math.min(state.campaignStep, steps.length - 1) : steps.length - 1;
    const visibleSteps = steps.slice(0, current + 1);
    const path = visibleSteps.map((step) => step.coords);
    const data = [{ path, timestamps: path.map((_, index) => index) }];
    if (!overlay) {
      overlay = new MapboxOverlay({ interleaved: false, layers: [] });
      map.addControl(overlay);
    }
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
            getColor: [229, 196, 135],
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
            getFillColor: [240, 217, 170],
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
