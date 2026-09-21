import { z } from 'zod';
import { compareHistDates, isChronologicallyPossible, isValidHistDate } from './histdate';
import { ERA_IDS, EVENT_TYPES, REGION_IDS } from './types';

export const QidSchema = z.string().regex(/^Q[1-9]\d*$/, 'Expected a Wikidata QID');
const HttpUrlSchema = z
  .string()
  .url()
  .refine((url) => /^https?:\/\//i.test(url), 'Only HTTP(S) source URLs are allowed');
export const SourceSchema = z.object({
  label: z.string().min(1),
  url: HttpUrlSchema,
  license: z.string().optional(),
});
export const LocalizedNameSchema = z.object({
  fr: z.string().min(1).optional(),
  en: z.string().min(1),
  de: z.string().min(1).optional(),
  es: z.string().min(1).optional(),
  zh: z.string().min(1).optional(),
  ru: z.string().min(1).optional(),
});
export const CoordinatesSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
export const CalendarSchema = z.enum(['julian', 'gregorian', 'unknown']);
export const DatePrecisionSchema = z.enum(['day', 'month', 'year', 'decade', 'century']);
export const EventTypeSchema = z.enum(EVENT_TYPES);
export const EraIdSchema = z.enum(ERA_IDS);
export const RegionIdSchema = z.enum(REGION_IDS);

export const HistDateSchema = z
  .object({
    year: z.number().int().safe(),
    month: z.number().int().min(1).max(12).optional(),
    day: z.number().int().min(1).max(31).optional(),
  })
  .refine((date) => isValidHistDate(date), 'Invalid historical date');

const LocalizedTextSchema = z.object({
  en: z.string().optional(),
  fr: z.string().optional(),
  de: z.string().optional(),
  es: z.string().optional(),
  zh: z.string().optional(),
  ru: z.string().optional(),
});
const WikidataPropertySchema = z.string().regex(/^P[1-9]\d*$/);
const NamedEntitySchema = z.object({ id: QidSchema, name: LocalizedNameSchema });
const StatementEvidenceShape = {
  statementId: z.string().min(1),
  sourceEntityId: QidSchema,
  sources: z.array(SourceSchema).min(1),
};

export const SourcedDateSchema = z
  .object({
    date: HistDateSchema,
    precision: DatePrecisionSchema,
    calendar: CalendarSchema,
    approximate: z.boolean().optional(),
    property: WikidataPropertySchema,
    ...StatementEvidenceShape,
  })
  .superRefine((value, context) => {
    if (!isValidHistDate(value.date, value.calendar))
      context.addIssue({
        code: 'custom',
        path: ['date'],
        message: 'Date is invalid in its source calendar',
      });
    if (
      (value.precision === 'day' && value.date.day === undefined) ||
      (value.precision === 'month' && value.date.month === undefined)
    )
      context.addIssue({
        code: 'custom',
        path: ['precision'],
        message: 'Date precision requires its corresponding date components',
      });
  });

const MilitaryParticipationShape = {
  role: z.enum(['commander', 'participant']),
  property: z.enum(['P4791', 'P710', 'P1344', 'P607']),
  participantId: QidSchema.optional(),
  ...StatementEvidenceShape,
};

export const EventPersonLinkSchema = z
  .object({
    personId: QidSchema,
    name: LocalizedNameSchema,
    ...MilitaryParticipationShape,
  })
  .refine(
    (value) => value.role !== 'commander' || value.property === 'P4791',
    'Command requires an explicit command statement',
  );

export const PersonEventLinkSchema = z
  .object({
    eventId: QidSchema,
    name: LocalizedNameSchema,
    type: EventTypeSchema,
    start: HistDateSchema.optional(),
    end: HistDateSchema.optional(),
    coords: CoordinatesSchema.optional(),
    ...MilitaryParticipationShape,
  })
  .refine(
    (value) => value.role !== 'commander' || value.property === 'P4791',
    'Command requires an explicit command statement',
  );

export const PersonTenureSchema = z
  .object({
    id: z.string().min(1),
    personId: QidSchema,
    name: LocalizedNameSchema,
    polity: NamedEntitySchema.optional(),
    office: NamedEntitySchema.optional(),
    role: z.enum(['head-of-state', 'head-of-government', 'office-holder']),
    start: z.array(SourcedDateSchema).optional(),
    end: z.array(SourcedDateSchema).optional(),
    property: z.enum(['P35', 'P6', 'P39']),
    ...StatementEvidenceShape,
  })
  .refine(
    (value) => Boolean(value.polity || value.office),
    'A tenure must identify its polity or office',
  )
  .superRefine((value, context) => {
    if (value.property === 'P39') {
      if (!value.office)
        context.addIssue({
          code: 'custom',
          path: ['office'],
          message: 'An office-held statement must identify its office',
        });
      if (value.sourceEntityId !== value.personId)
        context.addIssue({
          code: 'custom',
          path: ['sourceEntityId'],
          message: 'An office-held statement belongs to the named person',
        });
      return;
    }
    if (!value.polity || value.sourceEntityId !== value.polity.id)
      context.addIssue({
        code: 'custom',
        path: ['sourceEntityId'],
        message: 'A head-of-state or government statement belongs to the named polity',
      });
    const expectedRole = value.property === 'P35' ? 'head-of-state' : 'head-of-government';
    if (value.role !== expectedRole)
      context.addIssue({
        code: 'custom',
        path: ['role'],
        message: 'Political role does not match the cited property',
      });
  });

export const PolityLeadersSchema = z.object({
  polityId: QidSchema,
  leaders: z.array(PersonTenureSchema),
});

export const PersonSchema = z.object({
  id: QidSchema,
  name: LocalizedNameSchema,
  nameLanguage: z.string().min(1).max(40).optional(),
  description: LocalizedTextSchema.optional(),
  summary: LocalizedTextSchema.optional(),
  wikipedia: LocalizedTextSchema.optional(),
  image: HttpUrlSchema.optional(),
  birth: z.array(SourcedDateSchema).optional(),
  death: z.array(SourcedDateSchema).optional(),
  tenures: z.array(PersonTenureSchema),
  events: z.array(PersonEventLinkSchema),
  sources: z.array(SourceSchema).min(1),
});

export const HistoricalEventSchema = z
  .object({
    id: QidSchema,
    type: EventTypeSchema,
    name: LocalizedNameSchema,
    nameLanguage: z.string().min(1).max(40).optional(),
    description: LocalizedTextSchema.optional(),
    people: z.array(EventPersonLinkSchema).optional(),
    start: HistDateSchema,
    end: HistDateSchema.optional(),
    coords: CoordinatesSchema.optional(),
    coordinateSource: z
      .object({ kind: z.enum(['event', 'place']), entityId: QidSchema, url: HttpUrlSchema })
      .optional(),
    parentWar: QidSchema.optional(),
    belligerents: z.array(
      z.object({ side: z.enum(['A', 'B', 'other']), entityId: QidSchema, name: z.string().min(1) }),
    ),
    outcome: z.string().optional(),
    victor: z.string().optional(),
    importance: z.number().finite().min(0).max(100),
    era: EraIdSchema,
    region: RegionIdSchema,
    summary: LocalizedTextSchema.optional(),
    image: HttpUrlSchema.optional(),
    sources: z.array(SourceSchema).min(1, 'Every event must retain provenance'),
    datePrecision: DatePrecisionSchema,
    disputed: z.boolean().optional(),
    calendar: CalendarSchema.optional(),
    dateApproximate: z.boolean().optional(),
    wikipedia: LocalizedTextSchema.optional(),
    place: z.object({ id: QidSchema.optional(), name: z.string() }).optional(),
    sitelinks: z.number().int().nonnegative().optional(),
    strength: z.number().nonnegative().optional(),
    casualties: z.number().nonnegative().optional(),
    deaths: z.number().nonnegative().optional(),
    territorialContext: z
      .object({
        kind: z.literal('context-only'),
        beforeYear: z.number().int(),
        afterYear: z.number().int(),
      })
      .optional(),
  })
  .superRefine((event, context) => {
    if (event.end && !isChronologicallyPossible(event.start, event.end, event.calendar)) {
      context.addIssue({ code: 'custom', path: ['end'], message: 'End precedes start' });
    }
    if (
      !isValidHistDate(event.start, event.calendar) ||
      (event.end && !isValidHistDate(event.end, event.calendar))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['start'],
        message: 'Date is invalid in its declared calendar',
      });
    }
    if (event.datePrecision === 'day' && event.start.day === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['datePrecision'],
        message: 'Day precision requires a known day',
      });
    }
    if (event.datePrecision === 'month' && event.start.month === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['datePrecision'],
        message: 'Month precision requires a known month',
      });
    }
  });

export const CampaignSchema = z
  .object({
    id: QidSchema,
    name: LocalizedNameSchema,
    leader: z.string().optional(),
    people: z.array(EventPersonLinkSchema).optional(),
    polity: z.string(),
    description: LocalizedTextSchema.optional(),
    sources: z.array(SourceSchema).min(1),
    steps: z
      .array(
        z.object({
          eventId: QidSchema.optional(),
          coords: CoordinatesSchema,
          date: HistDateSchema,
          label: z.string().min(1),
          name: LocalizedNameSchema.optional(),
          sources: z.array(SourceSchema).min(1).optional(),
        }),
      )
      .min(1),
  })
  .superRefine((campaign, context) => {
    for (let index = 1; index < campaign.steps.length; index++) {
      if (compareHistDates(campaign.steps[index]!.date, campaign.steps[index - 1]!.date) < 0) {
        context.addIssue({
          code: 'custom',
          path: ['steps', index, 'date'],
          message: 'Campaign steps must be chronological',
        });
      }
    }
  });

export const PoliticalEntitySchema = z
  .object({
    id: z.string().min(1),
    qid: QidSchema.optional(),
    name: LocalizedNameSchema,
    start: HistDateSchema.optional(),
    end: HistDateSchema.optional(),
    sources: z.array(SourceSchema).min(1),
    areaHistory: z.array(z.object({ year: z.number().int(), areaKm2: z.number().nonnegative() })),
    wars: z.array(QidSchema),
  })
  .refine(
    (entity) => !entity.start || !entity.end || isChronologicallyPossible(entity.start, entity.end),
    'Entity end precedes its start',
  );

const CountMapSchema = z.record(z.string(), z.number().int().nonnegative());
export const EventShardSchema = z
  .object({
    key: z.string(),
    start: z.number().int(),
    end: z.number().int(),
    validFrom: z.number().int(),
    validTo: z.number().int(),
    path: z.string().min(1),
    count: z.number().int().nonnegative(),
  })
  .refine(
    (shard) =>
      shard.validFrom <= shard.start && shard.start <= shard.end && shard.end <= shard.validTo,
    'Shard validity must contain its chronological interval',
  );
export const DataManifestSchema = z.object({
  version: z.literal(1),
  builtAt: z.string(),
  totalEvents: z.number().int().nonnegative(),
  chunks: z.array(
    z.object({
      key: z.string(),
      path: z.string(),
      start: z.number().int(),
      end: z.number().int(),
      count: z.number().int().nonnegative(),
    }),
  ),
  density: z.array(z.object({ year: z.number().int(), count: z.number().int().nonnegative() })),
  coverage: z.object({ byType: CountMapSchema, byEra: CountMapSchema, byRegion: CountMapSchema }),
  sources: z.array(SourceSchema),
  eventsPmtiles: z.string().optional(),
  eventShards: z.array(EventShardSchema),
  searchIndex: z.string().optional(),
  campaigns: z.string().optional(),
});

export const StorySchema = z.object({
  id: z.string().min(1),
  title: LocalizedNameSchema,
  description: LocalizedNameSchema,
  sources: z.array(SourceSchema).min(1),
  steps: z.array(z.object({ eventId: QidSchema, text: LocalizedNameSchema })).min(1),
});

export type HistDate = z.infer<typeof HistDateSchema>;
export type HistoricalEvent = z.infer<typeof HistoricalEventSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type PoliticalEntity = z.infer<typeof PoliticalEntitySchema>;
export type DataManifest = z.infer<typeof DataManifestSchema>;
export type EventShard = z.infer<typeof EventShardSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Story = z.infer<typeof StorySchema>;
export type SourcedDate = z.infer<typeof SourcedDateSchema>;
export type EventPersonLink = z.infer<typeof EventPersonLinkSchema>;
export type PersonEventLink = z.infer<typeof PersonEventLinkSchema>;
export type PersonTenure = z.infer<typeof PersonTenureSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type PolityLeaders = z.infer<typeof PolityLeadersSchema>;
