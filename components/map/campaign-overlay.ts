import { MapboxOverlay } from '@deck.gl/mapbox';
import { TripsLayer } from '@deck.gl/geo-layers';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Map } from 'maplibre-gl';
import { getCampaigns, readJson } from '@/lib/data-client';
import type { HistoricalEvent } from '@/lib/schema';
import type { useAtlasStore } from '@/lib/store';

type State = ReturnType<typeof useAtlasStore.getState>;
export async function attachCampaignOverlay(
  map: Map,
  state: State,
  reduced: boolean,
  isCurrent: () => boolean = () => true,
) {
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
  if (!isCurrent() || !steps.length) return () => {};
  const current = campaign ? Math.min(state.campaignStep, steps.length - 1) : steps.length - 1;
  const path = steps.slice(0, current + 1).map((step) => step.coords);
  const data = [{ path, timestamps: path.map((_, index) => index) }];
  const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
  map.addControl(overlay);
  let frame = 0;
  const started = performance.now();
  const render = () => {
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
          data: steps.slice(0, current + 1),
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
          data: steps.slice(0, current + 1),
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
  return () => {
    cancelAnimationFrame(frame);
    if (map.hasControl(overlay)) map.removeControl(overlay);
  };
}
