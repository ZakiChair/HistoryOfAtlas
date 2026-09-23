import assert from 'node:assert/strict';
import { z } from 'zod';
import { QidSchema } from '../../lib/schema';
import { BattleInclusionReviewSchema, type BattleRecord } from '../../lib/battles/schema';
import { entityIds, sourceExclusion, type Entity } from '../normalize';

const InclusionSchema = BattleInclusionReviewSchema.omit({ reviewedAt: true });
export const BattleInclusionsFileSchema = z
  .object({
    version: z.literal(1),
    reviewedAt: z.string().min(1),
    records: z.record(QidSchema, InclusionSchema),
  })
  .strict();
type Inclusions = z.infer<typeof BattleInclusionsFileSchema>;

export function battleCandidateIds(discovered: string[], reviewed: Inclusions): string[] {
  assert.equal(new Set(discovered).size, discovered.length, 'Duplicate discovered candidate IDs');
  return [...new Set([...discovered, ...Object.keys(reviewed.records)])];
}

/** A reviewed event does not make its broad source class eligible for discovery. */
export function reviewedBattleKind(
  entity: Entity,
  review: z.infer<typeof InclusionSchema>,
  taxonomy: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
) {
  const excluded = sourceExclusion(entity);
  assert.equal(excluded, undefined, `${entity.id}: an excluded event cannot be included`);
  const classes = [...new Set(entityIds(entity, 'P31'))];
  const roots = classes.flatMap((id) => [id, ...(taxonomy.get(id) ?? [])]);
  assert(
    !roots.some((id) => ['Q5', 'Q198', 'Q831663', 'Q1361229', 'Q625298'].includes(id)),
    `${entity.id}: source classification is incompatible with a single engagement`,
  );
  assert.deepEqual(
    classes.sort(),
    [...review.expectedInstanceOf].sort(),
    `${entity.id}: reviewed source classification changed`,
  );
  return review.type;
}

/** Offline verification checks the published justification, type and retained citations. */
export function verifyBattleInclusion(record: BattleRecord, reviewed: Inclusions) {
  const review = reviewed.records[record.id];
  assert.deepEqual(
    record.inclusionReview,
    review ? { ...review, reviewedAt: reviewed.reviewedAt } : undefined,
    `${record.id}: inclusion review provenance mismatch`,
  );
  if (!review) return;
  assert.equal(record.type, review.type, `${record.id}: reviewed engagement type mismatch`);
  for (const source of review.sources)
    assert(
      record.sources.some((item) => item.url === source.url),
      `${record.id}: missing inclusion source`,
    );
}
