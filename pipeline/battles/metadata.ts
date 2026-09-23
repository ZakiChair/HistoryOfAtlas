import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import {
  BattleMetadataBeforeSchema,
  BattleRecordSchema,
  type BattleRecord,
} from '../../lib/battles/schema';
import { CoordinatesSchema, HistDateSchema, QidSchema, SourceSchema } from '../../lib/schema';
import { classifyEra, MIN_YEAR, MAX_YEAR } from '../../lib/eras';
import { classifyRegion } from '../normalize/region';
import { isNearLand, validateChronology } from '../validate';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';

export const BattleMetadataRecordSchema = z
  .object({
    expected: BattleMetadataBeforeSchema,
    reviewedAt: z.iso.date().optional(),
    start: HistDateSchema.optional(),
    end: HistDateSchema.optional(),
    coords: CoordinatesSchema.nullable().optional(),
    note: z.string().min(1),
    sources: z.array(SourceSchema).min(1),
    coordinateBasis: z.string().min(1).optional(),
    coordinateSourceUrl: z.string().url().optional(),
  })
  .strict()
  .superRefine((patch, context) => {
    if (!patch.start && !patch.end && patch.coords === undefined)
      context.addIssue({
        code: 'custom',
        message: 'Metadata review must change a date or location',
      });
    if (
      patch.coords !== undefined &&
      (!patch.coordinateBasis ||
        !patch.sources.some((source) => source.url === patch.coordinateSourceUrl))
    )
      context.addIssue({
        code: 'custom',
        message: 'Coordinates require a documented basis and a cited source URL',
      });
    if (patch.coords === undefined && (patch.coordinateBasis || patch.coordinateSourceUrl))
      context.addIssue({
        code: 'custom',
        message: 'Coordinate evidence requires reviewed coordinates',
      });
  });
export const BattleMetadataFileSchema = z
  .object({
    version: z.literal(1),
    reviewedAt: z.string().min(1),
    records: z.record(QidSchema, BattleMetadataRecordSchema),
  })
  .strict();
export type BattleMetadataRecord = z.infer<typeof BattleMetadataRecordSchema>;

export function applyBattleMetadata(
  battle: BattleRecord,
  input: BattleMetadataRecord,
  reviewedAt: string,
  land: FeatureCollection<Polygon | MultiPolygon>,
) {
  const patch = BattleMetadataRecordSchema.parse(input);
  for (const field of ['start', 'end', 'coords'] as const)
    if (!isDeepStrictEqual(battle[field] ?? null, patch.expected[field]))
      throw new Error(
        `${battle.id}: reviewed source ${field} changed; metadata needs a new review`,
      );
  const next = structuredClone(battle);
  const fields = (['start', 'end', 'coords'] as const).filter(
    (field) => patch[field] !== undefined,
  );
  if (fields.every((field) => isDeepStrictEqual(patch[field], battle[field] ?? null)))
    throw new Error(`${battle.id}: metadata review makes no change`);
  if (patch.start) {
    next.start = patch.start;
    next.era = classifyEra(patch.start.year);
  }
  if (patch.end) next.end = patch.end;
  if (next.start && (next.start.year < MIN_YEAR || next.start.year > MAX_YEAR))
    throw new Error(`${battle.id}: reviewed start is outside the atlas period`);
  if (next.start && validateChronology(next.start, next.end).length)
    throw new Error(`${battle.id}: reviewed chronology is impossible`);
  if (patch.coords === null) {
    delete next.coords;
    delete next.coordinateSource;
    delete next.region;
    next.missing = [...new Set([...(next.missing ?? []), 'missing-coordinates'])];
  } else if (patch.coords) {
    if (next.medium === 'land' && !isNearLand(patch.coords, land))
      throw new Error(`${battle.id}: reviewed land location is in open ocean`);
    next.coords = patch.coords;
    next.region = classifyRegion(patch.coords);
    const source = patch.sources.find((source) => source.url === patch.coordinateSourceUrl)!;
    next.coordinateSource = {
      kind: 'reviewed',
      entityId: battle.id,
      url: source.url,
      label: source.label,
    };
  }
  const resolved = new Set<string>();
  if (patch.start)
    for (const reason of [
      'missing-date',
      'invalid-date',
      'invalid-start-year',
      'outside-atlas-period',
    ])
      resolved.add(reason);
  if ((patch.start || patch.end) && next.start) resolved.add('end-before-start');
  if (patch.coords)
    for (const reason of [
      'missing-coordinates',
      'invalid-coordinate',
      'non-earth-coordinate',
      'broad-place-coordinate',
      'land-event-in-open-ocean',
    ])
      resolved.add(reason);
  if (next.missing) next.missing = next.missing.filter((reason) => !resolved.has(reason));
  next.note = [next.note, patch.note].filter(Boolean).join('\n\n');
  next.sources = [...next.sources, ...patch.sources].filter(
    (source, index, list) => list.findIndex((item) => item.url === source.url) === index,
  );
  next.metadataReview = {
    reviewedAt: patch.reviewedAt ?? reviewedAt,
    fields,
    before: patch.expected,
    note: patch.note,
    sources: patch.sources,
    ...(patch.coordinateBasis ? { coordinateBasis: patch.coordinateBasis } : {}),
  };
  // Commit only after every precondition and the final public schema pass.
  const validated = BattleRecordSchema.parse(next);
  if (patch.coords === null) {
    delete battle.coords;
    delete battle.coordinateSource;
    delete battle.region;
  }
  Object.assign(battle, validated);
}
