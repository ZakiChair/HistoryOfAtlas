import { describe, expect, it } from 'vitest';
import {
  ReligionCoverageDatasetSchema,
  ReligionCoverageIndexSchema,
  religionCoverageAt,
  religionCoverageClasses,
  splitReligionCoverage,
  type ReligionCoverageDataset,
} from '../../lib/religions/coverage';

import { coverageFixture, coverageIndexFixture } from '../fixtures/religion-coverage';

describe('religious coverage evidence', () => {
  it('keeps a last known snapshot dated, never before its date or over ten years old', () => {
    const data = coverageFixture();
    data.observations.push({
      ...data.observations[0],
      id: 'new',
      time: { kind: 'snapshot', year: 2005 },
    });
    const index = splitReligionCoverage(data).index;
    expect(religionCoverageAt(index, 1999)).toEqual([]);
    expect(religionCoverageAt(index, 2004).map((x) => x.id)).toEqual(['old']);
    expect(religionCoverageAt(index, 2015).map((x) => x.id)).toEqual(['new']);
    expect(religionCoverageAt(index, 2016)).toEqual([]);
    expect(religionCoverageAt(index, 1900, [2005, 2000])[0].time).toEqual({
      kind: 'snapshot',
      year: 2005,
    });
  });
  it('limits qualitative evidence to its explicit interval including BCE boundaries', () => {
    const data = coverageFixture();
    data.observations[0].time = { kind: 'interval', fromYear: -200, toYear: -100 };
    data.observations[0].shares = [
      { traditionId: 'a', prevalence: 'majority' },
      { traditionId: 'b', prevalence: 'substantial' },
    ];
    const index = splitReligionCoverage(data).index;
    expect(religionCoverageAt(index, -201)).toEqual([]);
    expect(religionCoverageAt(index, -200)).toHaveLength(1);
    expect(religionCoverageAt(index, -100, null, 'b')).toHaveLength(1);
    expect(religionCoverageAt(index, -99)).toEqual([]);
    expect(religionCoverageAt(index, -150, null, 'missing')).toEqual([]);
  });
  it('uses strict majority and inclusive substantial thresholds without inferring a remainder', () => {
    const data = coverageFixture();
    data.observations[0].shares = [
      { traditionId: 'a', share: 0.5 },
      { traditionId: 'b', share: 0.2 },
    ];
    let index = splitReligionCoverage(data).index;
    expect(religionCoverageClasses(index, index.observations[0])).toEqual({
      majority: null,
      substantial: ['a', 'b'],
    });
    data.observations[0].shares = [
      { traditionId: 'a', share: 0.5001 },
      { traditionId: 'b', share: 0.1999 },
    ];
    index = splitReligionCoverage(data).index;
    expect(religionCoverageClasses(index, index.observations[0])).toEqual({
      majority: 'a',
      substantial: [],
    });
  });
  it('filters by a documented substantial presence rather than any nonzero share', () => {
    const data = coverageFixture();
    data.observations[0].shares[1].share = 0.19;
    expect(religionCoverageAt(splitReligionCoverage(data).index, 2000, null, 'b')).toEqual([]);
    data.observations[0].shares[1].share = 0.2;
    expect(religionCoverageAt(splitReligionCoverage(data).index, 2000, null, 'b')).toHaveLength(1);
  });
  it('distinguishes qualitative classifications and never calls unaffiliated a religious majority', () => {
    const data = coverageFixture();
    data.observations[0].shares = [
      { traditionId: 'a', prevalence: 'majority' },
      { traditionId: 'b', prevalence: 'presence' },
    ];
    let index = splitReligionCoverage(data).index;
    expect(religionCoverageClasses(index, index.observations[0])).toEqual({
      majority: 'a',
      substantial: [],
    });
    data.observations[0].shares = [
      { traditionId: 'none', share: 0.7 },
      { traditionId: 'a', share: 0.3 },
    ];
    index = splitReligionCoverage(data).index;
    expect(religionCoverageClasses(index, index.observations[0])).toEqual({
      majority: null,
      substantial: ['a'],
    });
  });
  it('omits conflicting observations for one region instead of depending on source order', () => {
    const index = structuredClone(coverageIndexFixture());
    index.observations.push({ ...index.observations[0], id: 'rival' });
    expect(religionCoverageAt(index, 2000)).toEqual([]);
    expect(ReligionCoverageIndexSchema.safeParse(index).success).toBe(false);
    const data = coverageFixture();
    data.observations.push({ ...data.observations[0], id: 'rival' });
    expect(ReligionCoverageDatasetSchema.safeParse(data).success).toBe(false);
  });
  it('validates evidence, identities, shares and geometry references', () => {
    expect(ReligionCoverageDatasetSchema.safeParse(coverageFixture()).success).toBe(true);
    const mutations = [
      (d: ReligionCoverageDataset) => {
        d.observations[0].shares[0].prevalence = 'majority';
      },
      (d: ReligionCoverageDataset) => {
        d.observations[0].shares[0].share = 1.1;
      },
      (d: ReligionCoverageDataset) => {
        d.observations[0].shares[1].share = 0.6;
      },
      (d: ReligionCoverageDataset) => {
        d.observations[0].shares[1].traditionId = 'a';
      },
      (d: ReligionCoverageDataset) => {
        d.observations[0].geometryId = 'missing';
      },
      (d: ReligionCoverageDataset) => {
        d.observations[0].sourceIds = ['missing'];
      },
      (d: ReligionCoverageDataset) => {
        d.observations[0].shares[0].sourceIds = ['missing'];
      },
      (d: ReligionCoverageDataset) => {
        d.sources[0].url = 'javascript:alert(1)';
      },
      (d: ReligionCoverageDataset) => {
        d.geometries[0].geometry.coordinates = [];
      },
      (d: ReligionCoverageDataset) => {
        d.observations[0].time = { kind: 'interval', fromYear: 2, toYear: 1 };
      },
      (d: ReligionCoverageDataset) => {
        d.observations[0].shares = [{ traditionId: 'a', prevalence: 'majority' }];
      },
    ];
    for (const mutate of mutations) {
      const data = coverageFixture();
      mutate(data);
      expect(ReligionCoverageDatasetSchema.safeParse(data).success).toBe(false);
    }
  });
});

describe('coverage index and region files', () => {
  it('rounds coordinates to 1e-4 degrees and keeps rings closed and non-degenerate', () => {
    const data = coverageFixture();
    data.geometries[0].geometry.coordinates[0][1] = [0.123456, 0];
    const { index } = splitReligionCoverage(data);
    const ring = index.geometries[0].geometry.coordinates[0] as [number, number][];
    expect(ring[1][0]).toBe(0.1235);
    expect(ring[0]).toEqual(ring.at(-1)!);
  });
  it('summarises numeric and qualitative shares the way the map thresholds do', () => {
    const data = coverageFixture();
    const shares = data.observations[0].shares;
    const summarize = () => splitReligionCoverage(data).index.observations[0];
    shares[0].share = 0.5;
    shares[1].share = 0.19;
    expect(summarize()).toMatchObject({ majority: null, present: ['a'] });
    shares[1].share = 0.2;
    expect(summarize()).toMatchObject({ majority: null, present: ['a', 'b'] });
    shares[1].prevalence = 'presence';
    delete shares[1].share;
    expect(summarize()).toMatchObject({ majority: null, present: ['a'] });
    shares[0].prevalence = 'majority';
    delete shares[0].share;
    expect(summarize()).toMatchObject({ majority: 'a', present: ['a'] });
  });
  it('keeps the untouched full observations in the region file', () => {
    const data = coverageFixture();
    const { regions } = splitReligionCoverage(data);
    expect(regions).toHaveLength(1);
    expect(regions[0].regionId).toBe('r');
    expect(regions[0].observations[0]).toEqual(data.observations[0]);
  });
  it('refuses two names for one region and unsafe region ids', () => {
    const data = coverageFixture();
    data.observations.push({
      ...data.observations[0],
      id: 'other',
      name: { fr: 'Autre', en: 'Other' },
    });
    expect(() => splitReligionCoverage(data)).toThrow(/Conflicting region names: r/);
    const unsafe = coverageFixture();
    unsafe.observations[0].regionId = '../escape';
    expect(() => splitReligionCoverage(unsafe)).toThrow(/Unsafe region id/);
  });
  it('rejects an inconsistent index', () => {
    expect(ReligionCoverageIndexSchema.safeParse(coverageIndexFixture()).success).toBe(true);
    const absent = structuredClone(coverageIndexFixture());
    absent.observations[0].majority = 'none';
    expect(ReligionCoverageIndexSchema.safeParse(absent).success).toBe(false);
    const unknownRegion = structuredClone(coverageIndexFixture());
    unknownRegion.observations[0].regionId = 'missing';
    expect(ReligionCoverageIndexSchema.safeParse(unknownRegion).success).toBe(false);
    const unknownTradition = structuredClone(coverageIndexFixture());
    unknownTradition.observations[0].present.push('missing');
    expect(ReligionCoverageIndexSchema.safeParse(unknownTradition).success).toBe(false);
  });
});
