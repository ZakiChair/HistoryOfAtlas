import { z } from 'zod';
import { isChronologicallyPossible, isValidHistDate } from './histdate';
import {
  CalendarSchema,
  DatePrecisionSchema,
  HistDateSchema,
  LocalizedNameSchema,
  QidSchema,
  SourceSchema,
} from './schema';

export const FactDateSchema = z
  .object({
    date: HistDateSchema,
    precision: DatePrecisionSchema,
    calendar: CalendarSchema,
    approximate: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (!isValidHistDate(value.date, value.calendar))
      context.addIssue({ code: 'custom', path: ['date'], message: 'Invalid source calendar date' });
    if (
      (value.precision === 'day' && value.date.day === undefined) ||
      (value.precision === 'month' && value.date.month === undefined)
    )
      context.addIssue({
        code: 'custom',
        path: ['precision'],
        message: 'Date precision requires its corresponding components',
      });
  });
export type FactDate = z.infer<typeof FactDateSchema>;

const evidence = {
  id: z.string().min(1),
  start: FactDateSchema.optional(),
  end: FactDateSchema.optional(),
  sources: z.array(SourceSchema).min(1),
  note: LocalizedNameSchema.optional(),
};

function orderedDates(
  value: { start?: FactDate; end?: FactDate; at?: FactDate; date?: FactDate },
  context: z.RefinementCtx,
) {
  const point = value.at ?? value.date;
  const pairs = [
    [value.start, value.end],
    [value.start, point],
    [point, value.end],
  ] as const;
  if (
    pairs.some(
      ([start, end]) =>
        start && end && !isChronologicallyPossible(start.date, end.date, start.calendar),
    )
  )
    context.addIssue({ code: 'custom', message: 'Fact dates are not chronologically possible' });
}

export const CapitalFactSchema = z
  .object({
    ...evidence,
    city: z.object({ id: QidSchema, name: LocalizedNameSchema }),
    at: FactDateSchema.optional(),
  })
  .superRefine(orderedDates);
export type CapitalFact = z.infer<typeof CapitalFactSchema>;

const quantity = z.number().int().safe().nonnegative();
export const PopulationFactSchema = z
  .object({
    ...evidence,
    value: quantity.optional(),
    min: quantity.optional(),
    max: quantity.optional(),
    date: FactDateSchema.optional(),
    approximate: z.boolean(),
  })
  .superRefine((value, context) => {
    orderedDates(value, context);
    if (
      (value.value === undefined && (value.min === undefined || value.max === undefined)) ||
      (value.min !== undefined && value.max !== undefined && value.min > value.max) ||
      (value.value !== undefined && value.min !== undefined && value.min > value.value) ||
      (value.value !== undefined && value.max !== undefined && value.max < value.value)
    )
      context.addIssue({ code: 'custom', message: 'Population is outside its documented bounds' });
  });
export type PopulationFact = z.infer<typeof PopulationFactSchema>;

export const PolityFactsProfileSchema = z
  .object({
    version: z.literal(1),
    subjectId: QidSchema,
    name: LocalizedNameSchema,
    capitals: z.array(CapitalFactSchema),
    populations: z.array(PopulationFactSchema),
  })
  .superRefine((profile, context) => {
    for (const field of ['capitals', 'populations'] as const)
      if (new Set(profile[field].map((fact) => fact.id)).size !== profile[field].length)
        context.addIssue({ code: 'custom', path: [field], message: 'Duplicate fact identifier' });
  });
export type PolityFactsProfile = z.infer<typeof PolityFactsProfileSchema>;

const PolityIdSchema = z.string().regex(/^(?:clio|hb)-[a-f0-9]+$/);
const yearBounds = {
  fromYear: z.number().int().safe().optional(),
  toYear: z.number().int().safe().optional(),
};
export const PolityFactsMappingSchema = z
  .object({
    polityId: PolityIdSchema,
    sourceName: z.string().min(1),
    sourceWikidataId: QidSchema.optional(),
    subjectId: QidSchema,
    label: LocalizedNameSchema,
    ...yearBounds,
    sources: z.array(SourceSchema).min(1),
  })
  .refine(
    (value) =>
      value.fromYear === undefined || value.toYear === undefined || value.fromYear <= value.toYear,
    'Identity interval is reversed',
  );
export type PolityFactsMapping = z.infer<typeof PolityFactsMappingSchema>;

export const PolityFactsRegistrySchema = z
  .object({
    version: z.literal(1),
    reviewedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const [year, month, day] = value.split('-').map(Number);
        return isValidHistDate({ year, month, day }, 'gregorian');
      }, 'Invalid review date'),
    mappings: z.array(PolityFactsMappingSchema),
    excluded: z.array(z.object({ polityId: PolityIdSchema, reason: z.string().min(1) })).optional(),
  })
  .superRefine((registry, context) => {
    const groups = new Map<string, PolityFactsMapping[]>();
    for (const mapping of registry.mappings) {
      const previous = groups.get(mapping.polityId) ?? [];
      if (
        previous.some(
          (item) =>
            (item.fromYear ?? -Infinity) <= (mapping.toYear ?? Infinity) &&
            (mapping.fromYear ?? -Infinity) <= (item.toYear ?? Infinity),
        )
      )
        context.addIssue({
          code: 'custom',
          path: ['mappings'],
          message: 'Reviewed identity intervals overlap',
        });
      groups.set(mapping.polityId, [...previous, mapping]);
    }
    const excluded = new Set<string>();
    for (const item of registry.excluded ?? []) {
      if (excluded.has(item.polityId) || groups.has(item.polityId))
        context.addIssue({
          code: 'custom',
          path: ['excluded'],
          message: 'Excluded identity is duplicated or mapped',
        });
      excluded.add(item.polityId);
    }
  });
export type PolityFactsRegistry = z.infer<typeof PolityFactsRegistrySchema>;

export function parsePolityFacts(value: unknown, expectedSubjectId: string): PolityFactsProfile {
  const parsed = PolityFactsProfileSchema.parse(value);
  if (parsed.subjectId !== expectedSubjectId)
    throw new Error('Population and capital evidence does not match the reviewed identity.');
  return parsed;
}

export function resolveFactsMapping(
  registry: PolityFactsRegistry,
  entity: { id: string; name: string; wikidataId?: string },
  year: number,
): PolityFactsMapping | null {
  if (registry.excluded?.some((item) => item.polityId === entity.id)) return null;
  const matches = registry.mappings.filter(
    (mapping) =>
      mapping.polityId === entity.id &&
      mapping.sourceName === entity.name &&
      mapping.sourceWikidataId === entity.wikidataId &&
      inMappingYear(year, mapping),
  );
  // Even a caller that skipped schema validation must not choose between ambiguous joins.
  return matches.length === 1 ? matches[0] : null;
}

type MappingPeriod = { fromYear?: number; toYear?: number };

function inMappingYear(year: number, mapping?: MappingPeriod): boolean {
  return (
    Number.isSafeInteger(year) &&
    year >= (mapping?.fromYear ?? -Infinity) &&
    year <= (mapping?.toYear ?? Infinity)
  );
}

function definiteDate(date: FactDate | undefined): date is FactDate {
  return Boolean(date && !date.approximate && ['day', 'month', 'year'].includes(date.precision));
}

/** Annual overlap is justified by a dated observation or two definite interval bounds. */
function currentInYear(
  point: FactDate | undefined,
  start: FactDate | undefined,
  end: FactDate | undefined,
  year: number,
): boolean {
  if (point) return definiteDate(point) && point.date.year === year;
  return (
    definiteDate(start) && definiteDate(end) && start.date.year <= year && end.date.year >= year
  );
}

/** Choose an actual encoded date, never an interpolated year inside an uncertain interval. */
function populationReferenceYear(
  fact: PopulationFact,
  year: number,
  mapping?: MappingPeriod,
): number | undefined {
  const dates = fact.date ? [fact.date] : [fact.start, fact.end];
  return dates
    .flatMap((date) => (date && inMappingYear(date.date.year, mapping) ? [date.date.year] : []))
    .sort((a, b) => Math.abs(a - year) - Math.abs(b - year) || a - b)[0];
}

/**
 * Shared by the annual selection and its history. Keep overlapping source intervals intact:
 * a mapping's bounds restrict the identity join, not the dates stated by the source.
 * Undated evidence remains available as undated history, never as an annual observation.
 */
export function populationFactsInScope(
  profile: PolityFactsProfile,
  mapping?: MappingPeriod,
): PopulationFact[] {
  return profile.populations.filter((fact) => {
    if (fact.date) return inMappingYear(fact.date.date.year, mapping);
    if (fact.start && fact.end)
      return (
        fact.start.date.year <= (mapping?.toYear ?? Infinity) &&
        fact.end.date.year >= (mapping?.fromYear ?? -Infinity)
      );
    const endpoint = fact.start ?? fact.end;
    return !endpoint || inMappingYear(endpoint.date.year, mapping);
  });
}

export function factsAtYear(
  profile: PolityFactsProfile,
  year: number,
  mapping?: MappingPeriod,
): {
  capitals: CapitalFact[];
  otherCapitals: CapitalFact[];
  populations: PopulationFact[];
  referencePopulations: PopulationFact[];
} {
  if (!inMappingYear(year, mapping))
    return { capitals: [], otherCapitals: [], populations: [], referencePopulations: [] };
  const capitals = profile.capitals.filter((fact) =>
    currentInYear(fact.at, fact.start, fact.end, year),
  );
  const currentCapitals = new Set(capitals);
  const otherCapitals = profile.capitals.filter((fact) => !currentCapitals.has(fact));
  const eligiblePopulations = populationFactsInScope(profile, mapping);
  const populations = eligiblePopulations.filter((fact) =>
    currentInYear(fact.date, fact.start, fact.end, year),
  );
  if (populations.length) return { capitals, otherCapitals, populations, referencePopulations: [] };
  const references = eligiblePopulations.flatMap((fact) => {
    const referenceYear = populationReferenceYear(fact, year, mapping);
    return referenceYear === undefined ? [] : [{ fact, year: referenceYear }];
  });
  references.sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year) || a.year - b.year);
  const closestYear = references[0]?.year;
  const referencePopulations = references
    .filter((reference) => reference.year === closestYear)
    .map((reference) => reference.fact);
  return { capitals, otherCapitals, populations, referencePopulations };
}
