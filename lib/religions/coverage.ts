import { z } from '../zod';

const Id = z.string().trim().min(1);
const Text = z.object({ fr: z.string().min(1), en: z.string().min(1) });
const Year = z.number().int().safe();
const SafeUrl = z.url().refine((value) => {
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
}, 'Expected a public HTTP(S) source');
const Coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const Ring = z
  .array(Coordinate)
  .min(4)
  .refine((ring) => {
    const last = ring.at(-1)!;
    return (
      ring[0][0] === last[0] &&
      ring[0][1] === last[1] &&
      new Set(ring.map((p) => p.join(','))).size >= 3
    );
  }, 'Expected a closed non-degenerate ring');
const PolygonCoordinates = z.array(Ring).min(1);
const Geometry = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Polygon'), coordinates: PolygonCoordinates }),
  z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(PolygonCoordinates).min(1) }),
]);
const Tradition = z.object({
  id: Id,
  names: Text,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  symbol: Id,
  kind: z.enum(['religion', 'unaffiliated', 'aggregate']),
});
const Share = z
  .object({
    traditionId: Id,
    share: z.number().min(0).max(1).optional(),
    prevalence: z.enum(['majority', 'substantial', 'presence']).optional(),
    note: Text.optional(),
    sourceIds: z.array(Id).min(1).optional(),
  })
  .refine(
    (value) => (value.share !== undefined) !== (value.prevalence !== undefined),
    'Exactly one numeric share or qualitative prevalence is required',
  );
const Time = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('snapshot'), year: Year }),
  z
    .object({ kind: z.literal('interval'), fromYear: Year, toYear: Year })
    .refine((time) => time.fromYear <= time.toYear, 'Reversed interval'),
]);
const Observation = z.object({
  id: Id,
  regionId: Id,
  name: Text,
  geometryId: Id,
  time: Time,
  populationScope: Text,
  shares: z.array(Share).min(1),
  sourceIds: z.array(Id).min(1),
  note: Text.optional(),
});
const isMajority = (part: z.infer<typeof Share>) =>
  part.share !== undefined ? part.share > 0.5 : part.prevalence === 'majority';

export const ReligionCoverageDatasetSchema = z
  .object({
    version: z.literal(1),
    snapshotMaxAge: z.number().int().min(0).max(100),
    traditions: z.array(Tradition).min(1),
    sources: z
      .array(
        z.object({
          id: Id,
          title: z.string().min(1),
          url: SafeUrl,
          license: z.string().min(1),
          licenseUrl: SafeUrl.optional(),
          citation: z.string().optional(),
        }),
      )
      .min(1),
    geometries: z.array(z.object({ id: Id, geometry: Geometry, sourceIds: z.array(Id).min(1) })),
    observations: z.array(Observation),
  })
  .superRefine((data, context) => {
    const issue = (message: string) => context.addIssue({ code: 'custom', message });
    for (const key of ['traditions', 'sources', 'geometries', 'observations'] as const)
      if (new Set(data[key].map((row) => row.id)).size !== data[key].length)
        issue(`Duplicate ${key} ID`);
    const traditions = new Set(data.traditions.map((row) => row.id));
    const sources = new Set(data.sources.map((row) => row.id));
    const geometries = new Set(data.geometries.map((row) => row.id));
    const times = new Set<string>();
    for (const geometry of data.geometries)
      if (geometry.sourceIds.some((id) => !sources.has(id)))
        issue(`Unknown geometry source: ${geometry.id}`);
    for (const row of data.observations) {
      if (!geometries.has(row.geometryId)) issue(`Unknown geometry: ${row.id}`);
      if (row.sourceIds.some((id) => !sources.has(id)))
        issue(`Unknown observation source: ${row.id}`);
      if (new Set(row.shares.map((part) => part.traditionId)).size !== row.shares.length)
        issue(`Duplicate tradition: ${row.id}`);
      for (const part of row.shares) {
        if (!traditions.has(part.traditionId)) issue(`Unknown tradition: ${row.id}`);
        if (part.sourceIds?.some((id) => !sources.has(id)))
          issue(`Unknown share source: ${row.id}`);
      }
      const quantitative = row.shares.filter((part) => part.share !== undefined);
      if (quantitative.length && quantitative.length !== row.shares.length)
        issue(`Mixed quantitative and qualitative observation: ${row.id}`);
      if (quantitative.reduce((sum, part) => sum + part.share!, 0) > 1.010000001)
        issue(`Population shares exceed the population: ${row.id}`);
      if (row.shares.filter(isMajority).length > 1) issue(`Conflicting majorities: ${row.id}`);
      if (row.time.kind === 'snapshot' && !quantitative.length)
        issue(`Qualitative evidence needs an explicit interval: ${row.id}`);
      const key = JSON.stringify([row.regionId, row.time]);
      if (times.has(key)) issue(`Duplicate region/time observation: ${row.id}`);
      times.add(key);
    }
  });

export type ReligionCoverageDataset = z.infer<typeof ReligionCoverageDatasetSchema>;
export type ReligionCoverageObservation = z.infer<typeof Observation>;
export type ReligionCoverageShare = z.infer<typeof Share>;
export type ReligionCoverageTradition = z.infer<typeof Tradition>;

/** Most recent dated snapshot within its declared retention window, or a published interval. */
export function religionCoverageAt(
  dataset: ReligionCoverageDataset,
  year: number,
  range: [number, number] | null = null,
  tradition: string | null = null,
): ReligionCoverageObservation[] {
  const horizon = range ? Math.max(...range) : year;
  const regions = new Map<string, ReligionCoverageObservation[]>();
  for (const row of dataset.observations) {
    const time = row.time;
    const active =
      time.kind === 'interval'
        ? time.fromYear <= horizon && horizon <= time.toYear
        : time.year <= horizon && horizon - time.year <= dataset.snapshotMaxAge;
    if (active) {
      const rows = regions.get(row.regionId) ?? [];
      rows.push(row);
      regions.set(row.regionId, rows);
    }
  }
  const visible: ReligionCoverageObservation[] = [];
  for (const rows of regions.values()) {
    const latest = Math.max(
      ...rows.map((row) => (row.time.kind === 'snapshot' ? row.time.year : -Infinity)),
    );
    const candidates = rows.filter(
      (row) => row.time.kind === 'interval' || row.time.year === latest,
    );
    if (candidates.length !== 1) continue;
    const row = candidates[0];
    if (row.shares.filter(isMajority).length > 1) continue;
    if (
      !tradition ||
      row.shares.some(
        (part) =>
          part.traditionId === tradition &&
          (part.share !== undefined
            ? part.share >= 0.2
            : part.prevalence === 'majority' || part.prevalence === 'substantial'),
      )
    )
      visible.push(row);
  }
  return visible;
}

/** A neutral population category can dominate numerically without being a religious majority. */
export function religionCoverageClasses(
  dataset: ReligionCoverageDataset,
  observation: ReligionCoverageObservation,
): { majority: ReligionCoverageShare | null; substantial: ReligionCoverageShare[] } {
  const religions = new Set(
    dataset.traditions.filter((row) => row.kind === 'religion').map((row) => row.id),
  );
  const majorities = observation.shares.filter(isMajority);
  const majority =
    majorities.length === 1 && religions.has(majorities[0].traditionId) ? majorities[0] : null;
  return {
    majority,
    substantial: observation.shares.filter(
      (part) =>
        part !== majority &&
        religions.has(part.traditionId) &&
        (part.share !== undefined ? part.share >= 0.2 : part.prevalence === 'substantial'),
    ),
  };
}
