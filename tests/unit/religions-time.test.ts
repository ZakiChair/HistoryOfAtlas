import { describe, expect, it } from 'vitest';
import { religionFixture } from '../fixtures/religions';
import { religionMilestonesAt } from '../../lib/religions/time';
import { ReligionDatasetSchema } from '../../lib/religions/types';

describe('cumulative religious history', () => {
  it('excludes future stages and admits a stage exactly at its date, including BCE', () => {
    expect(religionMilestonesAt(religionFixture, -601)).toHaveLength(0);
    expect(religionMilestonesAt(religionFixture, -500).map((item) => item.id)).toEqual([
      'judaism-origin',
      'buddhism-origin',
    ]);
    expect(religionMilestonesAt(religionFixture, -251, null, 'buddhism')).toHaveLength(1);
    expect(religionMilestonesAt(religionFixture, -250, null, 'buddhism')).toHaveLength(2);
  });
  it('uses the end of a range and keeps older attestations as historical evidence', () => {
    expect(religionMilestonesAt(religionFixture, -3500, [-200, 100], 'buddhism')).toHaveLength(3);
    expect(religionMilestonesAt(religionFixture, 2026)).toHaveLength(4);
    expect(religionMilestonesAt(religionFixture, 2026, null, 'unknown')).toHaveLength(0);
  });
  it('validates references, chronological links and closed geographic regions', () => {
    expect(ReligionDatasetSchema.safeParse(religionFixture).success).toBe(true);
    for (const change of [
      { fromId: 'buddhism-china' },
      { fromId: 'judaism-origin' },
      { sourceIds: ['unknown'] },
      { traditionId: 'unknown' },
      {
        area: {
          label: { en: 'Area', fr: 'Zone' },
          ring: [
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5],
          ],
        },
      },
    ]) {
      const copy = structuredClone(religionFixture);
      Object.assign(copy.milestones[1], change);
      expect(ReligionDatasetSchema.safeParse(copy).success).toBe(false);
    }
  });
});
