import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createInitialAtlasState } from '@/lib/store';
import { contextFeatures } from '@/lib/context/map';
import { ChangesDatasetSchema } from '@/lib/context/changes';
import { NetworkDatasetSchema } from '@/lib/context/networks';
import { CitiesDatasetSchema } from '@/lib/context/cities';
const read = (view: string) => JSON.parse(readFileSync(`public/data/context/${view}.json`, 'utf8'));

describe('historical context map data', () => {
  it('hides stale tabs, closed views and battle reconstructions', () => {
    const loaded = {
      view: 'changes' as const,
      dataset: ChangesDatasetSchema.parse(read('changes')),
    };
    const state = { ...createInitialAtlasState(), contextView: 'changes' as const };
    expect(contextFeatures(loaded, state).features.length).toBeGreaterThan(0);
    for (const patch of [
      { contextView: null },
      { contextView: 'networks' as const },
      { battleMode: true },
    ])
      expect(contextFeatures(loaded, { ...state, ...patch }).features).toEqual([]);
  });

  it('draws only the networks overlapping the chosen period without inferred traffic weights', () => {
    const dataset = NetworkDatasetSchema.parse(read('networks'));
    const state = { ...createInitialAtlasState(), contextView: 'networks' as const, year: 2026 };
    expect(contextFeatures({ view: 'networks', dataset }, state).features).toEqual([]);
    const feature = contextFeatures({ view: 'networks', dataset }, { ...state, year: 1200 })
      .features[0];
    expect(feature?.geometry.type).toBe('LineString');
    expect(feature?.properties).not.toHaveProperty('weight');
    expect(feature?.properties?.schematic).toBe(true);
  });

  it('never assigns territorial populations to city markers', () => {
    const dataset = CitiesDatasetSchema.parse(read('cities'));
    const data = contextFeatures(
      { view: 'cities', dataset },
      { ...createInitialAtlasState(), contextView: 'cities', range: [-3500, 2026] },
    );
    expect(data.features.length).toBeGreaterThan(0);
    for (const feature of data.features) {
      expect(feature.geometry.type).toBe('Point');
      expect(feature.properties).not.toHaveProperty('population');
      expect(feature.properties).not.toHaveProperty('value');
    }
  });
});
