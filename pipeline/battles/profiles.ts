import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { BattleRecordSchema } from '../../lib/battles/schema';
import { QidSchema } from '../../lib/schema';

const ProfileSchema = BattleRecordSchema.pick({
  participants: true,
  totals: true,
  unassigned: true,
}).extend({ totals: BattleRecordSchema.shape.totals.optional(), note: z.string().min(1) });

const ProfileFileSchema = z.object({
  version: z.literal(1),
  records: z.record(QidSchema, ProfileSchema),
});

export function mergeBattleProfiles(imported: unknown, manual: unknown) {
  return {
    records: {
      ...ProfileFileSchema.parse(imported).records,
      ...ProfileFileSchema.parse(manual).records,
    },
  };
}

export async function loadBattleProfiles(root: string) {
  const [imported, manual] = await Promise.all(
    ['battle-cdb90-profiles.json', 'battle-profiles.json'].map(async (file) =>
      JSON.parse(await readFile(join(root, 'data/curated', file), 'utf8')),
    ),
  );
  return mergeBattleProfiles(imported, manual);
}
