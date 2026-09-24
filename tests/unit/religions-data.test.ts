import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { ReligionDatasetSchema } from '../../lib/religions/types';
import { RELIGION_SYMBOLS } from '../../lib/religions/icons';

it('publishes a sourced worldwide chronology with closed regions and valid identifying emblems', () => {
  const data = ReligionDatasetSchema.parse(
    JSON.parse(
      readFileSync(new URL('../../public/data/religions/history.json', import.meta.url), 'utf8'),
    ),
  );
  for (const tradition of data.traditions) {
    expect(RELIGION_SYMBOLS[tradition.symbol], tradition.id).toBeDefined();
    const stages = data.milestones.filter((item) => item.traditionId === tradition.id);
    expect(
      stages.some((item) => item.kind === 'origin'),
      tradition.id,
    ).toBe(true);
    expect(
      stages.some((item) => item.kind === 'spread'),
      tradition.id,
    ).toBe(true);
  }
  expect(data.milestones.some((item) => item.area)).toBe(true);
  expect(data.milestones.some((item) => item.fromId)).toBe(true);
  expect(data.milestones.some((item) => item.coordinates[0] < -30)).toBe(true);
  expect(data.milestones.some((item) => item.coordinates[0] > 100)).toBe(true);
  expect(data.milestones.some((item) => item.coordinates[1] < 0)).toBe(true);
});
