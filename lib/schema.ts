import { z } from 'zod';
import { compareHistDates, isValidHistDate } from './histdate';
import { ERA_IDS, EVENT_TYPES, REGION_IDS } from './types';

export const QidSchema = z.string().regex(/^Q[1-9]\d*$/, 'Expected a Wikidata QID');
const HttpUrlSchema = z.string().url().refine((url) => /^https?:\/\//i.test(url), 'Only HTTP(S) source URLs are allowed');
export const SourceSchema = z.object({ label: z.string().min(1), url: HttpUrlSchema, license: z.string().optional() });
export const LocalizedNameSchema = z.object({ fr: z.string().min(1).optional(), en: z.string().min(1) });
export const CoordinatesSchema = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]);
export const CalendarSchema = z.enum(['julian', 'gregorian', 'unknown']);
export const DatePrecisionSchema = z.enum(['day', 'month', 'year', 'decade', 'century']);
export const EventTypeSchema = z.enum(EVENT_TYPES);
export const EraIdSchema = z.enum(ERA_IDS);
export const RegionIdSchema = z.enum(REGION_IDS);

export const HistDateSchema = z.object({
  year: z.number().int().safe(),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
}).refine((date) => isValidHistDate(date), 'Invalid historical date');

export const HistoricalEventSchema = z.object({
  id: QidSchema,
  type: EventTypeSchema,
  name: LocalizedNameSchema,
  start: HistDateSchema,
  end: HistDateSchema.optional(),
  coords: CoordinatesSchema.optional(),
  coordinateSource: z.object({ kind: z.enum(['event', 'place']), entityId: QidSchema, url: HttpUrlSchema }).optional(),
  parentWar: QidSchema.optional(),
  belligerents: z.array(z.object({ side: z.enum(['A', 'B', 'other']), entityId: QidSchema, name: z.string().min(1) })),
  outcome: z.string().optional(),
  victor: z.string().optional(),
  importance: z.number().finite().min(0).max(100),
  era: EraIdSchema,
  region: RegionIdSchema,
  summary: z.object({ fr: z.string().optional(), en: z.string().optional() }).optional(),
  image: HttpUrlSchema.optional(),
  sources: z.array(SourceSchema).min(1, 'Every event must retain provenance'),
  datePrecision: DatePrecisionSchema,
  disputed: z.boolean().optional(),
  calendar: CalendarSchema.optional(),
  dateApproximate: z.boolean().optional(),
  wikipedia: z.object({ fr: z.string().optional(), en: z.string().optional() }).optional(),
  place: z.object({ id: QidSchema.optional(), name: z.string() }).optional(),
  sitelinks: z.number().int().nonnegative().optional(),
  strength: z.number().nonnegative().optional(),
  casualties: z.number().nonnegative().optional(),
  territorialContext: z.object({ kind: z.literal('context-only'), beforeYear: z.number().int(), afterYear: z.number().int() }).optional(),
}).superRefine((event, context) => {
  if (event.end && compareHistDates(event.end, event.start) < 0) {
    context.addIssue({ code: 'custom', path: ['end'], message: 'End precedes start' });
  }
  if (!isValidHistDate(event.start, event.calendar) || (event.end && !isValidHistDate(event.end, event.calendar))) {
    context.addIssue({ code: 'custom', path: ['start'], message: 'Date is invalid in its declared calendar' });
  }
  if (event.datePrecision === 'day' && event.start.day === undefined) {
    context.addIssue({ code: 'custom', path: ['datePrecision'], message: 'Day precision requires a known day' });
  }
  if (event.datePrecision === 'month' && event.start.month === undefined) {
    context.addIssue({ code: 'custom', path: ['datePrecision'], message: 'Month precision requires a known month' });
  }
});

export const CampaignSchema = z.object({
  id: QidSchema,
  name: LocalizedNameSchema,
  leader: z.string().optional(),
  polity: z.string(),
  description: z.object({ fr: z.string().optional(), en: z.string().optional() }).optional(),
  sources: z.array(SourceSchema).min(1),
  steps: z.array(z.object({
    eventId: QidSchema.optional(),
    coords: CoordinatesSchema,
    date: HistDateSchema,
    label: z.string().min(1),
    sources: z.array(SourceSchema).min(1).optional(),
  })).min(1),
}).superRefine((campaign, context) => {
  for (let index = 1; index < campaign.steps.length; index++) {
    if (compareHistDates(campaign.steps[index]!.date, campaign.steps[index - 1]!.date) < 0) {
      context.addIssue({ code: 'custom', path: ['steps', index, 'date'], message: 'Campaign steps must be chronological' });
    }
  }
});

export const PoliticalEntitySchema = z.object({
  id: z.string().min(1),
  qid: QidSchema.optional(),
  name: LocalizedNameSchema,
  start: HistDateSchema.optional(),
  end: HistDateSchema.optional(),
  sources: z.array(SourceSchema).min(1),
  areaHistory: z.array(z.object({ year: z.number().int(), areaKm2: z.number().nonnegative() })),
  wars: z.array(QidSchema),
}).refine((entity) => !entity.start || !entity.end || compareHistDates(entity.start, entity.end) <= 0, 'Entity end precedes its start');

const CountMapSchema = z.record(z.string(), z.number().int().nonnegative());
export const DataManifestSchema = z.object({
  version: z.literal(1),
  builtAt: z.string(),
  totalEvents: z.number().int().nonnegative(),
  chunks: z.array(z.object({ key: z.string(), path: z.string(), start: z.number().int(), end: z.number().int(), count: z.number().int().nonnegative() })),
  density: z.array(z.object({ year: z.number().int(), count: z.number().int().nonnegative() })),
  coverage: z.object({ byType: CountMapSchema, byEra: CountMapSchema, byRegion: CountMapSchema }),
  sources: z.array(SourceSchema),
  eventsPmtiles: z.string().optional(),
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
export type Source = z.infer<typeof SourceSchema>;
export type Story = z.infer<typeof StorySchema>;
