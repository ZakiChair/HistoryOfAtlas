import { z } from 'zod';
import {
  CoordinatesSchema,
  EraIdSchema,
  HistDateSchema,
  LocalizedNameSchema,
  QidSchema,
  RegionIdSchema,
  SourceSchema,
} from '../schema';

export const BattleQuantitySchema = z
  .object({
    value: z.number().int().safe().nonnegative(),
    min: z.number().int().safe().nonnegative().optional(),
    max: z.number().int().safe().nonnegative().optional(),
    approximate: z.boolean().optional(),
    counts: z.enum(['people', 'soldiers', 'ships', 'aircraft', 'groups', 'unknown']),
    scope: z.enum(['total', 'participant', 'subset', 'unknown']),
    participantIds: z.array(z.string()).optional(),
    renderable: z.boolean(),
    statementId: z.string().optional(),
    property: z.string().optional(),
    rawUnit: z.string().optional(),
    qualifiers: z.record(z.string(), z.unknown()).optional(),
    note: z.string().optional(),
    sources: z.array(SourceSchema).min(1),
  })
  .superRefine((quantity, context) => {
    if (
      (quantity.min !== undefined && quantity.min > quantity.value) ||
      (quantity.max !== undefined && quantity.max < quantity.value)
    )
      context.addIssue({ code: 'custom', message: 'Quantity is outside its documented bounds' });
    if (quantity.renderable && !['soldiers', 'ships', 'aircraft'].includes(quantity.counts))
      context.addIssue({
        code: 'custom',
        message: 'Only reviewed military quantities may scale armies',
      });
    if (quantity.renderable && !['total', 'participant'].includes(quantity.scope))
      context.addIssue({
        code: 'custom',
        message: 'Only whole-force quantities may scale armies',
      });
  });
export type SourcedQuantity = z.infer<typeof BattleQuantitySchema>;
export const BattleEquipmentIdentitySchema = z
  .object({
    polityId: QidSchema,
    note: z.string().min(1),
    sources: z.array(SourceSchema).min(1),
  })
  .strict();
export const BattleParticipantSchema = z
  .object({
    id: z.string().min(1),
    name: LocalizedNameSchema,
    kind: z.enum(['polity', 'military-unit', 'person', 'unknown']),
    sideId: z.string().optional(),
    medium: z.enum(['land', 'naval', 'air']).optional(),
    profileId: z.string().optional(),
    equipmentIdentity: BattleEquipmentIdentitySchema.optional(),
    strength: z.array(BattleQuantitySchema),
    deaths: z.array(BattleQuantitySchema),
    casualties: z.array(BattleQuantitySchema),
    sources: z.array(SourceSchema).min(1),
  })
  .superRefine((participant, context) => {
    if (
      participant.equipmentIdentity &&
      (participant.kind !== 'military-unit' || !participant.profileId)
    )
      context.addIssue({
        code: 'custom',
        message: 'Equipment identity requires a military unit and an explicit profile',
      });
    if (
      !['polity', 'military-unit'].includes(participant.kind) &&
      [...participant.strength, ...participant.deaths, ...participant.casualties].some(
        (quantity) => quantity.renderable,
      )
    )
      context.addIssue({
        code: 'custom',
        message: 'A person or unidentified participant cannot supply military quantities',
      });
  });
export type BattleParticipant = z.infer<typeof BattleParticipantSchema>;
export const BattleMetadataBeforeSchema = z
  .object({
    start: HistDateSchema.nullable(),
    end: HistDateSchema.nullable(),
    coords: CoordinatesSchema.nullable(),
  })
  .strict();
export const BattleMetadataReviewSchema = z
  .object({
    reviewedAt: z.string().min(1),
    fields: z.array(z.enum(['start', 'end', 'coords'])).min(1),
    before: BattleMetadataBeforeSchema,
    note: z.string().min(1),
    sources: z.array(SourceSchema).min(1),
    coordinateBasis: z.string().min(1).optional(),
  })
  .strict();
export const BattleInclusionReviewSchema = z
  .object({
    reviewedAt: z.string().min(1),
    type: z.enum(['battle', 'siege', 'naval']),
    expectedInstanceOf: z.array(QidSchema).refine((ids) => new Set(ids).size === ids.length, {
      message: 'Duplicate expected classifications',
    }),
    note: z.string().min(1),
    sources: z.array(SourceSchema).min(1),
  })
  .strict();
const BattleCore = {
  id: QidSchema,
  name: LocalizedNameSchema,
  nameLanguage: z.string().optional(),
  type: z.enum(['battle', 'siege', 'naval']),
  start: HistDateSchema.optional(),
  end: HistDateSchema.optional(),
  coords: CoordinatesSchema.optional(),
  region: RegionIdSchema.optional(),
  era: EraIdSchema.optional(),
  medium: z.enum(['land', 'naval', 'air']),
};
export const BattleRecordSchema = z.object({
  ...BattleCore,
  profileId: z.string().optional(),
  coordinateSource: z
    .object({
      kind: z.enum(['event', 'place', 'reviewed']),
      entityId: QidSchema,
      url: z.string().url(),
      label: z.string().min(1).optional(),
    })
    .optional(),
  metadataReview: BattleMetadataReviewSchema.optional(),
  inclusionReview: BattleInclusionReviewSchema.optional(),
  participants: z.array(BattleParticipantSchema),
  totals: z.object({
    strength: z.array(BattleQuantitySchema),
    deaths: z.array(BattleQuantitySchema),
    casualties: z.array(BattleQuantitySchema),
  }),
  unassigned: z
    .object({
      strength: z.array(BattleQuantitySchema),
      deaths: z.array(BattleQuantitySchema),
      casualties: z.array(BattleQuantitySchema),
    })
    .optional(),
  sources: z.array(SourceSchema).min(1),
  missing: z.array(z.string()).optional(),
  note: z.string().optional(),
});
export type BattleRecord = z.infer<typeof BattleRecordSchema>;
export const BattleIndexEntrySchema = z.object({ ...BattleCore, documented: z.boolean() });
export type BattleIndexEntry = z.infer<typeof BattleIndexEntrySchema>;
export const BattleIndexSchema = z.object({
  version: z.literal(1),
  counts: z.object({
    total: z.number().int(),
    mappable: z.number().int(),
    documented: z.number().int(),
    unmapped: z.number().int(),
  }),
  battles: z.array(BattleIndexEntrySchema),
  unmapped: z.number().int(),
});
export type BattleIndex = z.infer<typeof BattleIndexSchema>;
