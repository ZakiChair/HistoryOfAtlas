import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  NetworkDatasetSchema,
  NetworkRecordSchema,
  networkFeatureCollection,
  networksAtYear,
  networksInPeriod,
} from '../../lib/context/networks';

const published = JSON.parse(
  readFileSync(new URL('../../public/data/context/networks.json', import.meta.url), 'utf8'),
);
const dataset = NetworkDatasetSchema.parse(published);

describe('documented historical networks', () => {
  it('publishes sourced examples with declared limits and schematic editorial anchors', () => {
    expect(dataset.networks.length).toBeGreaterThanOrEqual(14);
    expect(new Set(dataset.networks.map((network) => network.kind))).toEqual(
      new Set(['trade', 'migration', 'forced-migration']),
    );
    for (const network of dataset.networks) {
      expect(network.geometry).toBe('schematic');
      expect(network.sources.length).toBeGreaterThan(0);
      expect(network.waypoints.every((point) => point.basis === 'editorial-anchor')).toBe(true);
      expect(network.limits.fr.length).toBeGreaterThan(40);
      expect(network.limits.en.length).toBeGreaterThan(40);
      expect(network.temporalBasis.fr.length).toBeGreaterThan(40);
    }
  });

  it('rejects reversed dates, unlocated anchors and degenerate lines', () => {
    const example = dataset.networks[0];
    expect(NetworkRecordSchema.safeParse({ ...example, toYear: -3500 }).success).toBe(false);
    expect(
      NetworkRecordSchema.safeParse({
        ...example,
        coordinates: [
          [181, 0],
          [1, 1],
        ],
      }).success,
    ).toBe(false);
    expect(
      NetworkRecordSchema.safeParse({
        ...example,
        coordinates: [
          [0, 0],
          [0, 0],
        ],
      }).success,
    ).toBe(false);
    expect(
      NetworkRecordSchema.safeParse({ ...example, waypoints: example.waypoints.slice(1) }).success,
    ).toBe(false);
  });

  it('rejects duplicate records and unsupported quantitative claims', () => {
    expect(
      NetworkDatasetSchema.safeParse({
        ...dataset,
        networks: [...dataset.networks, dataset.networks[0]],
      }).success,
    ).toBe(false);
    expect(
      NetworkRecordSchema.safeParse({ ...dataset.networks[0], volume: 1_000_000 }).success,
    ).toBe(false);
    expect(NetworkRecordSchema.safeParse({ ...dataset.networks[0], sources: [] }).success).toBe(
      false,
    );
  });

  it('keeps both date endpoints and never extrapolates outside the documented window', () => {
    const migration = dataset.networks.find((network) => network.id === 'great-migration-us')!;
    expect(networksAtYear([migration], 1909)).toEqual([]);
    expect(networksAtYear([migration], 1910)).toEqual([migration]);
    expect(networksAtYear([migration], 1970)).toEqual([migration]);
    expect(networksAtYear([migration], 1971)).toEqual([]);
    expect(networksAtYear(dataset.networks, Number.NaN)).toEqual([]);
    expect(networksAtYear(dataset.networks, 1300).map((network) => network.id)).toEqual([
      'silk-roads-changan-tianshan',
      'trans-saharan-gold-salt',
      'kilwa-indian-ocean',
      'grand-canal-yuan',
    ]);
  });

  it('exports only schematic lines with stable IDs, localized names and no volume styling', () => {
    const record = dataset.networks[0];
    const collection = networkFeatureCollection([record], 'fr');
    const feature = collection.features[0];
    expect(feature.id).toBe(record.id);
    expect(feature.geometry.type).toBe('LineString');
    expect(feature.geometry.coordinates).toEqual(record.coordinates);
    expect(feature.properties.title).toBe(record.title.fr);
    expect(feature.properties.schematic).toBe(true);
    expect(feature.properties.direction).toBe('both');
    expect(feature.properties).not.toHaveProperty('weight');
    expect(feature.properties).not.toHaveProperty('volume');
    feature.geometry.coordinates[0][0] = 0;
    expect(record.coordinates[0][0]).not.toBe(0);
    expect(networkFeatureCollection([record], 'ar').features[0].properties.title).toBe(
      record.title.en,
    );
  });

  it('uses the period filter for any overlapping network without extrapolating beyond it', () => {
    const migration = dataset.networks.find((network) => network.id === 'great-migration-us')!;
    expect(networksInPeriod([migration], 1800, [1900, 1910])).toEqual([migration]);
    expect(networksInPeriod([migration], 1800, [1970, 1980])).toEqual([migration]);
    expect(networksInPeriod([migration], 1950, [1800, 1909])).toEqual([]);
    expect(networksInPeriod([migration], 1800, [1980, 1970])).toEqual([migration]);
    expect(networksInPeriod([migration], 1950, [Number.NaN, 2000])).toEqual([]);
  });

  it('declares reciprocal trade separately from directional movement', () => {
    const migration = dataset.networks.find((network) => network.kind === 'forced-migration')!;
    expect(migration.direction).toBe('forward');
    expect(NetworkRecordSchema.safeParse({ ...migration, direction: 'both' }).success).toBe(false);
    expect(networkFeatureCollection([migration], 'en').features[0].properties.direction).toBe(
      'forward',
    );
  });
});
