import { describe, expect, it } from 'vitest';
import * as builder from '../../scripts/build-context-coverage';
import { summarizeCoverage } from '@/lib/context/coverage';

const manifest = {
  temporal: { range: [-2, 20] },
  snapshots: [{ year: -2 }, { year: 10 }],
  sources: [
    { label: 'Cliopatria · test', url: 'https://example.org/clio', licence: 'CC-BY-4.0' },
    { label: 'Historical Basemaps · test', url: 'https://example.org/hb', licence: 'GPL-3.0-only' },
  ],
};
const polities = [
  {
    id: 'clio-a',
    center: [10, 45],
    observations: [
      { fromYear: -2, toYear: 0 },
      { fromYear: 5, toYear: 19 },
      { fromYear: 20, toYear: 20 },
    ],
  },
];
const snapshots = [{ id: 'hb-a', center: [10, 0], observations: [{ year: -2 }, { year: 10 }] }];

describe('offline coverage publication', () => {
  it('retains repeated source intervals even when a geometry-change log could omit them', () => {
    expect(builder.createCoverageDataset).toBeTypeOf('function');
    const data = builder.createCoverageDataset(manifest, polities, snapshots);
    expect(data.polities.find((polity) => polity.id === 'clio-a')?.intervals).toEqual([
      [-2, 0],
      [5, 19],
      [20, 20],
    ]);
    expect(
      summarizeCoverage(data, { sourceId: 'cliopatria', fromYear: 20, toYear: 20 }),
    ).toMatchObject({ entities: 1, observations: 1 });
    expect(data.polities.find((polity) => polity.id === 'clio-a')?.region).toBe('europe');
    expect(data.polities.find((polity) => polity.id === 'hb-a')?.region).toBe('africa');
  });

  it('sorts independently of input ordering and never invents missing centres or interval endpoints', () => {
    const shuffled = structuredClone(polities);
    shuffled[0].observations.reverse();
    expect(builder.createCoverageDataset(manifest, shuffled, snapshots)).toEqual(
      builder.createCoverageDataset(manifest, polities, snapshots),
    );
    expect(() =>
      builder.createCoverageDataset(
        manifest,
        [{ id: 'clio-b', observations: [{ fromYear: 1, toYear: 2 }] }],
        snapshots,
      ),
    ).toThrow();
    expect(() =>
      builder.createCoverageDataset(
        manifest,
        [{ id: 'clio-b', center: [0, 0], observations: [{ fromYear: 1 }] }],
        snapshots,
      ),
    ).toThrow();
  });
});
