import { describe, expect, it } from 'vitest';
import {
  ReligionCoverageDatasetSchema,
  religionCoverageAt,
  religionCoverageClasses,
  type ReligionCoverageDataset,
} from '../../lib/religions/coverage';

import { coverageFixture } from '../fixtures/religion-coverage';

describe('religious coverage evidence', () => {
  it('keeps a last known snapshot dated, never before its date or over ten years old', () => {
    const data = coverageFixture();
    data.observations.push({
      ...data.observations[0],
      id: 'new',
      time: { kind: 'snapshot', year: 2005 },
    });
    expect(religionCoverageAt(data, 1999)).toEqual([]);
    expect(religionCoverageAt(data, 2004).map((x) => x.id)).toEqual(['old']);
    expect(religionCoverageAt(data, 2015).map((x) => x.id)).toEqual(['new']);
    expect(religionCoverageAt(data, 2016)).toEqual([]);
    expect(religionCoverageAt(data, 1900, [2005, 2000])[0].time).toEqual({
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
    expect(religionCoverageAt(data, -201)).toEqual([]);
    expect(religionCoverageAt(data, -200)).toHaveLength(1);
    expect(religionCoverageAt(data, -100, null, 'b')).toHaveLength(1);
    expect(religionCoverageAt(data, -99)).toEqual([]);
    expect(religionCoverageAt(data, -150, null, 'missing')).toEqual([]);
  });
  it('uses strict majority and inclusive substantial thresholds without inferring a remainder', () => {
    const data = coverageFixture(),
      observation = data.observations[0];
    observation.shares = [
      { traditionId: 'a', share: 0.5 },
      { traditionId: 'b', share: 0.2 },
    ];
    expect(religionCoverageClasses(data, observation)).toEqual({
      majority: null,
      substantial: observation.shares,
    });
    observation.shares = [
      { traditionId: 'a', share: 0.5001 },
      { traditionId: 'b', share: 0.1999 },
    ];
    expect(religionCoverageClasses(data, observation)).toEqual({
      majority: observation.shares[0],
      substantial: [],
    });
    expect(observation.shares).toHaveLength(2);
  });
  it('filters by a documented substantial presence rather than any nonzero share', () => {
    const data = coverageFixture();
    data.observations[0].shares[1].share = 0.19;
    expect(religionCoverageAt(data, 2000, null, 'b')).toEqual([]);
    data.observations[0].shares[1].share = 0.2;
    expect(religionCoverageAt(data, 2000, null, 'b')).toHaveLength(1);
  });
  it('distinguishes qualitative classifications and never calls unaffiliated a religious majority', () => {
    const data = coverageFixture(),
      observation = data.observations[0];
    observation.shares = [
      { traditionId: 'a', prevalence: 'majority' },
      { traditionId: 'b', prevalence: 'presence' },
    ];
    expect(religionCoverageClasses(data, observation)).toEqual({
      majority: observation.shares[0],
      substantial: [],
    });
    observation.shares = [
      { traditionId: 'none', share: 0.7 },
      { traditionId: 'a', share: 0.3 },
    ];
    expect(religionCoverageClasses(data, observation)).toEqual({
      majority: null,
      substantial: [observation.shares[1]],
    });
  });
  it('omits conflicting observations for one region instead of depending on source order', () => {
    const data = coverageFixture();
    data.observations.push({ ...data.observations[0], id: 'rival' });
    expect(religionCoverageAt(data, 2000)).toEqual([]);
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
