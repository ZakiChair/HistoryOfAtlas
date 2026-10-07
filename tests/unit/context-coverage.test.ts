import { describe, expect, it } from 'vitest';
import * as coverage from '@/lib/context/coverage';

// Structural fixtures only: these intervals make no historical claims.
const dataset = {
  version: 1,
  method: 'reference-point-regions-v1',
  centerBasis: 'first-source-label-anchor',
  sources: [
    {
      id: 'cliopatria',
      label: 'Interval source',
      url: 'https://example.org/intervals',
      license: 'CC-BY-4.0',
      range: [-2, 20],
      kind: 'intervals',
      approximate: true,
    },
    {
      id: 'historical-basemaps',
      label: 'Snapshot source',
      url: 'https://example.org/snapshots',
      license: 'GPL-3.0-only',
      range: [-2, 10],
      kind: 'snapshots',
      approximate: true,
      snapshotYears: [-2, 10],
    },
  ],
  polities: [
    {
      id: 'clio-a',
      sourceId: 'cliopatria',
      region: 'europe',
      center: [10, 45],
      intervals: [
        [-2, 0],
        [5, 9],
        [10, 20],
      ],
    },
    {
      id: 'clio-b',
      sourceId: 'cliopatria',
      region: 'africa',
      center: [10, 0],
      intervals: [[0, 4]],
    },
    {
      id: 'hb-a',
      sourceId: 'historical-basemaps',
      region: 'europe',
      center: [10, 45],
      intervals: [
        [-2, -2],
        [10, 10],
      ],
    },
  ],
};

describe('territorial source inventory', () => {
  it('counts source entries once but keeps each overlapping observation, including year zero', () => {
    expect(coverage.summarizeCoverage).toBeTypeOf('function');
    const parsed = coverage.CoverageDatasetSchema.parse(dataset);
    const summary = coverage.summarizeCoverage(parsed, {
      sourceId: 'cliopatria',
      fromYear: 0,
      toYear: 10,
    });
    expect(summary.entities).toBe(2);
    expect(summary.observations).toBe(4);
    expect(summary.regions.find((row) => row.id === 'europe')).toMatchObject({
      entities: 1,
      observations: 3,
    });
    expect(summary.regions.find((row) => row.id === 'africa')).toMatchObject({
      entities: 1,
      observations: 1,
    });
  });

  it('does not bridge evidence gaps or carry a source beyond its actual range', () => {
    const parsed = coverage.CoverageDatasetSchema.parse(dataset);
    const gap = coverage.summarizeCoverage(parsed, {
      sourceId: 'cliopatria',
      fromYear: 3,
      toYear: 3,
    });
    expect(gap.regions.find((row) => row.id === 'europe')?.entities).toBe(0);
    expect(gap.entities).toBe(1);
    expect(
      coverage.summarizeCoverage(parsed, { sourceId: 'cliopatria', fromYear: 21, toYear: 21 }),
    ).toMatchObject({ entities: 0, observations: 0, outsideSourceRange: true });
  });

  it('treats reference snapshots as dated observations, never continuous annual presence', () => {
    const parsed = coverage.CoverageDatasetSchema.parse(dataset);
    expect(
      coverage.summarizeCoverage(parsed, {
        sourceId: 'historical-basemaps',
        fromYear: 0,
        toYear: 0,
      }),
    ).toMatchObject({ entities: 0, observations: 0, outsideSourceRange: false });
    expect(coverage.snapshotNeighbours(parsed, 'historical-basemaps', 0)).toEqual({
      exact: false,
      previous: -2,
      next: 10,
    });
    expect(
      coverage.summarizeCoverage(parsed, {
        sourceId: 'historical-basemaps',
        fromYear: -2,
        toYear: 10,
      }),
    ).toMatchObject({ entities: 1, observations: 2 });
  });

  it('distinguishes documented anchors from other catalogue entries without moving coordinates', () => {
    const parsed = coverage.CoverageDatasetSchema.parse(dataset);
    const features = coverage.coverageFeatureCollection(
      parsed,
      3,
      null,
      'cliopatria',
      null,
    ).features;
    expect(features).toHaveLength(2);
    expect(features.find((feature) => feature.id === 'clio-a')).toMatchObject({
      geometry: { type: 'Point', coordinates: [10, 45] },
      properties: {
        id: 'europe',
        entityId: 'clio-a',
        regionId: 'europe',
        documented: false,
        observations: 0,
      },
    });
    expect(features.find((feature) => feature.id === 'clio-b')?.properties.documented).toBe(true);
    const filtered = coverage.coverageFeatureCollection(parsed, 3, [0, 3], 'cliopatria', 'europe');
    expect(filtered.features.map((feature) => feature.id)).toEqual(['clio-a']);
    expect(filtered.features[0].properties.documented).toBe(true);
  });

  it('rejects malformed intervals, duplicate identities and invented continuous snapshot ranges', () => {
    for (const change of [
      (value: typeof dataset) => {
        value.polities[0].intervals[0] = [1, -2];
      },
      (value: typeof dataset) => {
        value.polities[1].id = value.polities[0].id;
      },
      (value: typeof dataset) => {
        value.polities[2].intervals[0] = [-2, 10];
      },
      (value: typeof dataset) => {
        value.polities[0].intervals[0] = [-5, 0];
      },
    ]) {
      const invalid = structuredClone(dataset);
      change(invalid);
      expect(coverage.CoverageDatasetSchema.safeParse(invalid).success).toBe(false);
    }
  });
});
