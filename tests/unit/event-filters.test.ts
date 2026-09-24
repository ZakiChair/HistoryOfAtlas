import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { createInitialAtlasState } from '../../lib/store';
import {
  clusterCountsThinned,
  clusterFilterPurpose,
  eventFilter,
  MAX_DENSITY_CLUSTER_SPAN,
  minimumEventImportance,
} from '../../components/map/event-filters';

const require = createRequire(import.meta.url);
const mapRequire = createRequire(require.resolve('maplibre-gl/package.json'));
const { featureFilter } = mapRequire('@maplibre/maplibre-gl-style-spec') as {
  featureFilter: (
    filter: unknown,
    rootKey: string,
  ) => {
    filter: (
      globals: { zoom: number },
      feature: { type: string; properties: Record<string, unknown> },
    ) => boolean;
  };
};

const initial = createInitialAtlasState();
const worldView = {
  ...initial,
  year: 1942,
  battlesVisible: true,
  camera: { ...initial.camera, zoom: 1.8 },
};
const minor = {
  id: 'Q1',
  type: 'battle',
  start: 1942,
  end: 1942,
  importance: 12,
  era: 'world-wars',
  region: 'europe',
};
const matches = (filter: ReturnType<typeof eventFilter>, properties: Record<string, unknown>) =>
  featureFilter(filter, 'layers[0].filter').filter({ zoom: 1.8 }, { type: 'Point', properties });

describe('event filter purposes', () => {
  it('thins minor markers on the world view but keeps them in the density aggregate', () => {
    // 75 − 1.8 × 10 = 57: markers keep only major events at the default camera.
    expect(minimumEventImportance(worldView)).toBe(57);
    expect(matches(eventFilter(worldView), minor)).toBe(false);
    expect(minimumEventImportance(worldView, 'density')).toBe(0);
    expect(matches(eventFilter(worldView, 'density'), minor)).toBe(true);
  });

  it('still honours the reader’s own importance threshold for density', () => {
    const state = { ...worldView, filters: { ...worldView.filters, minImportance: 30 } };
    expect(minimumEventImportance(state, 'density')).toBe(30);
    expect(matches(eventFilter(state, 'density'), minor)).toBe(false);
    expect(matches(eventFilter(state, 'density'), { ...minor, importance: 30 })).toBe(true);
  });

  it('does not depend on the zoom, so camera moves never rewrite the density filter', () => {
    const zoomed = { ...worldView, camera: { ...worldView.camera, zoom: 6 } };
    expect(eventFilter(zoomed, 'density')).toEqual(eventFilter(worldView, 'density'));
    expect(eventFilter(zoomed)).not.toEqual(eventFilter(worldView));
  });

  it('keeps time, visibility and category filters in the density aggregate', () => {
    const state = {
      ...worldView,
      battlesVisible: false,
      filters: { ...worldView.filters, types: ['battle', 'treaty'] as const },
    };
    const density = eventFilter(state, 'density');
    expect(matches(density, minor)).toBe(false);
    expect(matches(density, { ...minor, type: 'treaty' })).toBe(true);
    expect(matches(density, { ...minor, type: 'war' })).toBe(false);
    expect(matches(density, { ...minor, type: 'treaty', start: 1800, end: 1800 })).toBe(false);
  });
});

describe('cluster count scope', () => {
  const period = (from: number, to: number) => ({
    ...worldView,
    range: [from, to] as [number, number],
  });

  it('counts every event on the default view and on periods up to the cap', () => {
    expect(clusterFilterPurpose(worldView)).toBe('density');
    expect(clusterCountsThinned(worldView)).toBe(false);
    // The timeline's period toggle spans year ± 50.
    const toggle = period(1892, 1892 + MAX_DENSITY_CLUSTER_SPAN);
    expect(clusterFilterPurpose(toggle)).toBe('density');
    expect(matches(eventFilter(toggle, clusterFilterPurpose(toggle)), minor)).toBe(true);
    expect(clusterCountsThinned(toggle)).toBe(false);
  });

  it('bounds the idle query on wider periods and says the counts are thinned', () => {
    const wide = period(1700, 2000);
    expect(clusterFilterPurpose(period(1892, 1893 + MAX_DENSITY_CLUSTER_SPAN))).toBe('markers');
    expect(clusterFilterPurpose(wide)).toBe('markers');
    // The same filter as the markers: the idle query holds no more features than they do.
    expect(eventFilter(wide, clusterFilterPurpose(wide))).toEqual(eventFilter(wide));
    expect(matches(eventFilter(wide, clusterFilterPurpose(wide)), minor)).toBe(false);
    expect(clusterCountsThinned(wide)).toBe(true);
  });

  it('does not call counts thinned when the markers already keep every matching event', () => {
    const wide = period(1700, 2000);
    expect(clusterCountsThinned({ ...wide, selectedWar: 'Q362' })).toBe(false);
    expect(clusterCountsThinned({ ...wide, filters: { ...wide.filters, minImportance: 60 } })).toBe(
      false,
    );
  });
});
