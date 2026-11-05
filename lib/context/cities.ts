import type { FeatureCollection, Point } from 'geojson';
import { z } from '../zod';
import { CoordinatesSchema, LocalizedNameSchema, QidSchema, SourceSchema } from '../schema';
import {
  CapitalFactSchema,
  PopulationFactSchema,
  PolityFactsMappingSchema,
  type FactDate,
  type PopulationFact,
} from '../polity-facts';
import { localizedName } from '../i18n';
import type { Locale } from '../types';

export const CuratedCapitalsSchema = z
  .object({
    version: z.literal(1),
    reviewedAt: z.iso.date(),
    license: z.literal('CC-BY-4.0'),
    capitals: z.array(
      z
        .object({
          subjectId: QidSchema,
          polityIds: z.array(z.string().regex(/^(?:clio|hb)-[a-f0-9]+$/)).min(1),
          replacesFactId: z.string().min(1).optional(),
          fact: CapitalFactSchema.refine(
            (fact) => fact.id.startsWith('context-capital-') && documentedFactPeriod(fact) !== null,
            'An editorial capital requires a distinct ID and definite dates',
          ),
        })
        .strict(),
    ),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.capitals.map((capital) => capital.fact.id)).size === value.capitals.length,
    'Duplicate editorial capital identity',
  );

const CapitalRelationSchema = z
  .object({
    subjectId: QidSchema,
    subjectName: LocalizedNameSchema,
    mappings: z.array(PolityFactsMappingSchema).min(1),
    fact: CapitalFactSchema,
  })
  .refine(
    (value) => value.mappings.every((mapping) => mapping.subjectId === value.subjectId),
    'Capital identity mismatch',
  );

const CityRecordSchema = z
  .object({
    id: QidSchema,
    name: LocalizedNameSchema,
    coordinates: CoordinatesSchema,
    coordinateSources: z.array(SourceSchema).min(1),
    coordinateVariantCount: z.number().int().positive(),
    capitals: z.array(CapitalRelationSchema),
    populations: z.array(PopulationFactSchema),
  })
  .refine(
    (value) => value.capitals.every((capital) => capital.fact.city.id === value.id),
    'Capital place identity mismatch',
  );

const TerritoryPopulationSchema = z
  .object({
    subjectId: QidSchema,
    name: LocalizedNameSchema,
    mappings: z.array(PolityFactsMappingSchema).min(1),
    populations: z.array(PopulationFactSchema),
    referenceLocations: z
      .array(
        z.object({
          polityId: z.string().regex(/^(?:clio|hb)-[a-f0-9]+$/),
          coordinates: CoordinatesSchema,
        }),
      )
      .optional(),
  })
  .refine(
    (value) => value.mappings.every((mapping) => mapping.subjectId === value.subjectId),
    'Population identity mismatch',
  );

export const CitiesDatasetSchema = z
  .object({
    version: z.literal(1),
    cities: z.array(CityRecordSchema),
    territories: z.array(TerritoryPopulationSchema),
    editorial: z
      .object({
        license: z.literal('CC-BY-4.0'),
        reviewedAt: z.iso.date(),
        capitalFactIds: z.array(z.string().min(1)),
      })
      .optional(),
    coverage: z.object({
      candidateCities: z.number().int().nonnegative(),
      mappedCities: z.number().int().nonnegative(),
      capitalAssertions: z.number().int().nonnegative(),
      excludedCapitalAssertions: z.number().int().nonnegative(),
      cityPopulationObservations: z.number().int().nonnegative(),
      territoryPopulationObservations: z.number().int().nonnegative(),
      rejectedPopulationStatements: z.number().int().nonnegative(),
      excludedCities: z.array(z.object({ id: QidSchema, reason: z.string().min(1) })),
    }),
  })
  .superRefine((value, context) => {
    for (const [items, field] of [
      [value.cities.map((city) => city.id), 'cities'],
      [value.territories.map((territory) => territory.subjectId), 'territories'],
    ] as const)
      if (new Set(items).size !== items.length)
        context.addIssue({ code: 'custom', path: [field], message: 'Duplicate source subject' });
    if (
      value.coverage.mappedCities !== value.cities.length ||
      value.coverage.candidateCities !== value.cities.length + value.coverage.excludedCities.length
    )
      context.addIssue({
        code: 'custom',
        path: ['coverage'],
        message: 'City coverage does not account for candidates',
      });
  });

export type CitiesDataset = z.infer<typeof CitiesDatasetSchema>;
export type CityRecord = z.infer<typeof CityRecordSchema>;
export type TerritoryPopulation = z.infer<typeof TerritoryPopulationSchema>;
export type CityPeriodOptions = {
  year: number;
  range?: [number, number] | null;
  sourceId: 'cliopatria' | 'historical-basemaps';
};

function definite(date: FactDate | undefined): date is FactDate {
  return Boolean(date && !date.approximate && ['day', 'month', 'year'].includes(date.precision));
}

/** Unknown endpoints and coarse dates do not establish annual presence. */
export function documentedFactPeriod(fact: {
  at?: FactDate;
  date?: FactDate;
  start?: FactDate;
  end?: FactDate;
}): [number, number] | null {
  const point = fact.at ?? fact.date;
  if (point) return definite(point) ? [point.date.year, point.date.year] : null;
  return definite(fact.start) && definite(fact.end)
    ? [fact.start.date.year, fact.end.date.year]
    : null;
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] <= a[1] && b[0] <= b[1] && a[0] <= b[1] && a[1] >= b[0];
}

function mappingPeriod(
  mapping: z.infer<typeof PolityFactsMappingSchema>,
  sourceId: CityPeriodOptions['sourceId'],
): [number, number] | null {
  if (!mapping.polityId.startsWith(sourceId === 'cliopatria' ? 'clio-' : 'hb-')) return null;
  return [mapping.fromYear ?? -Infinity, mapping.toYear ?? Infinity];
}

export function cityEvidenceInPeriod(city: CityRecord, options: CityPeriodOptions) {
  const period: [number, number] = options.range ?? [options.year, options.year];
  return {
    capitals: city.capitals.filter((capital) => {
      const dates = documentedFactPeriod(capital.fact);
      if (!dates) return false;
      return capital.mappings.some((mapping) => {
        const identity = mappingPeriod(mapping, options.sourceId);
        return (
          identity &&
          overlaps(period, [Math.max(dates[0], identity[0]), Math.min(dates[1], identity[1])])
        );
      });
    }),
    populations: city.populations.filter((fact) => {
      const dates = documentedFactPeriod(fact);
      return dates !== null && overlaps(dates, period);
    }),
  };
}

export function visibleCities(dataset: CitiesDataset, options: CityPeriodOptions): CityRecord[] {
  return dataset.cities.filter((city) => {
    const evidence = cityEvidenceInPeriod(city, options);
    return evidence.capitals.length > 0 || evidence.populations.length > 0;
  });
}

/** Choose a recorded date, keeping earlier references separate from current evidence. */
export function previousPopulationReferences(
  facts: readonly PopulationFact[],
  year: number,
): PopulationFact[] {
  const references = facts.flatMap((fact) => {
    const date = fact.date ?? fact.end ?? fact.start;
    return date && date.date.year <= year ? [{ fact, year: date.date.year }] : [];
  });
  const latest = Math.max(...references.map((reference) => reference.year));
  return references
    .filter((reference) => reference.year === latest)
    .map((reference) => reference.fact);
}

export function territoryPopulationsInPeriod(
  territory: TerritoryPopulation,
  options: CityPeriodOptions,
): PopulationFact[] {
  const period: [number, number] = options.range ?? [options.year, options.year];
  return territory.populations.filter((fact) => {
    const dates = documentedFactPeriod(fact);
    if (!dates) return false;
    return territory.mappings.some((mapping) => {
      const identity = mappingPeriod(mapping, options.sourceId);
      return (
        identity &&
        overlaps(period, [Math.max(dates[0], identity[0]), Math.min(dates[1], identity[1])])
      );
    });
  });
}

export function cityObservationYear(city: CityRecord, options: CityPeriodOptions): number | null {
  const evidence = cityEvidenceInPeriod(city, options);
  const selected: [number, number] = options.range ?? [options.year, options.year];
  const periods: [number, number][] = evidence.capitals.flatMap((capital) => {
    const dates = documentedFactPeriod(capital.fact)!;
    return capital.mappings.flatMap((mapping) => {
      const identity = mappingPeriod(mapping, options.sourceId);
      if (!identity) return [];
      const period: [number, number] = [
        Math.max(dates[0], identity[0], selected[0]),
        Math.min(dates[1], identity[1], selected[1]),
      ];
      return period[0] <= period[1] ? [period] : [];
    });
  });
  for (const fact of evidence.populations) {
    const dates = documentedFactPeriod(fact)!;
    periods.push([Math.max(dates[0], selected[0]), Math.min(dates[1], selected[1])]);
  }
  const candidates = periods.map(([from, to]) => Math.max(from, Math.min(to, options.year)));
  if (!candidates.length) {
    for (const capital of city.capitals) {
      const date = capital.fact.at ?? capital.fact.start ?? capital.fact.end;
      if (date) candidates.push(date.date.year);
    }
    for (const fact of city.populations) {
      const date = fact.date ?? fact.start ?? fact.end;
      if (date) candidates.push(date.date.year);
    }
  }
  return (
    candidates.sort(
      (a, b) => Math.abs(a - options.year) - Math.abs(b - options.year) || a - b,
    )[0] ?? null
  );
}

export function citiesGeoJSON(
  dataset: CitiesDataset,
  options: CityPeriodOptions & { locale?: Locale },
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: visibleCities(dataset, options).map((city) => {
      const evidence = cityEvidenceInPeriod(city, options);
      return {
        type: 'Feature',
        id: city.id,
        geometry: { type: 'Point', coordinates: city.coordinates },
        properties: {
          id: city.id,
          kind: 'cities',
          name: localizedName(city.name, options.locale ?? 'en'),
          capitalCount: evidence.capitals.length,
          populationCount: evidence.populations.length,
          year: cityObservationYear(city, options),
        },
      };
    }),
  };
}
