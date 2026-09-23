import { z } from 'zod';
import { BattleEquipmentIdentitySchema, type BattleRecord } from '../../lib/battles/schema';

const EvidenceSchema = z.object({ title: z.string().min(1), url: z.string().url() }).strict();
export const BattleEquipmentRecordSchema = z
  .object({
    // This profile belongs only to the anonymous event illustration. It never
    // propagates to identified participants, especially in ship/shore actions.
    profileId: z.string().min(1).optional(),
    participants: z
      .array(
        z
          .object({
            id: z.string().min(1),
            // A reviewed source may identify an unknown participant as a force. This
            // never supplies an opposing camp, strength or losses.
            kind: z.enum(['polity', 'military-unit']).optional(),
            medium: z.enum(['land', 'naval', 'air']).optional(),
            profileId: z.string().min(1).optional(),
            equipmentIdentity: BattleEquipmentIdentitySchema.optional(),
          })
          .strict()
          .superRefine((assignment, context) => {
            if (assignment.equipmentIdentity && !assignment.profileId)
              context.addIssue({
                code: 'custom',
                message: 'Equipment identity requires an explicit profile',
              });
          }),
      )
      .optional(),
    note: z.string().min(1),
    sources: z.array(EvidenceSchema).min(1),
  })
  .strict()
  .superRefine((record, context) => {
    const ids = record.participants?.map((participant) => participant.id) ?? [];
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: 'custom', message: 'Duplicate equipment participant' });
  });
export const BattleEquipmentFileSchema = z
  .object({
    version: z.literal(1),
    reviewedAt: z.string().min(1),
    policy: z.string().min(1),
    records: z.record(z.string().regex(/^Q\d+$/), BattleEquipmentRecordSchema),
  })
  .strict();
export type BattleEquipmentRecord = z.infer<typeof BattleEquipmentRecordSchema>;

export function applyBattleEquipment(battle: BattleRecord, input: BattleEquipmentRecord) {
  const patch = BattleEquipmentRecordSchema.parse(input);
  for (const assignment of patch.participants ?? []) {
    const participant = battle.participants.find((item) => item.id === assignment.id);
    if (!participant)
      throw new Error(`Equipment participant ${assignment.id} absent from ${battle.id}`);
    if (participant.kind === 'person')
      throw new Error(`Equipment cannot turn person ${assignment.id} into a military force`);
    if (assignment.equipmentIdentity && (assignment.kind ?? participant.kind) !== 'military-unit')
      throw new Error(`Equipment identity requires a reviewed military unit: ${assignment.id}`);
  }
  const sources = [
    ...patch.sources.map(({ title, url }) => ({ label: title, url })),
    ...(patch.participants ?? []).flatMap(
      (assignment) => assignment.equipmentIdentity?.sources ?? [],
    ),
  ];
  const merge = (existing: BattleRecord['sources']) =>
    [...existing, ...sources].filter(
      (source, index, list) => list.findIndex((item) => item.url === source.url) === index,
    );
  if (patch.profileId) battle.profileId = patch.profileId;
  for (const assignment of patch.participants ?? []) {
    const participant = battle.participants.find((item) => item.id === assignment.id)!;
    if (assignment.kind) participant.kind = assignment.kind;
    if (assignment.profileId) participant.profileId = assignment.profileId;
    if (assignment.equipmentIdentity) participant.equipmentIdentity = assignment.equipmentIdentity;
    if (assignment.medium) participant.medium = assignment.medium;
    participant.sources = merge(participant.sources);
  }
  battle.note = [battle.note, patch.note].filter(Boolean).join('\n\n');
  battle.sources = merge(battle.sources);
}
