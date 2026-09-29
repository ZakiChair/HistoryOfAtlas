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
const Source = z.object({
  id: Id,
  title: z.string().min(1),
  url: SafeUrl,
  license: z.string().min(1),
  licenseUrl: SafeUrl.optional(),
  citation: z.string().optional(),
});
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
export const isMajorityShare = (part: ReligionCoverageShare) =>
  part.share !== undefined ? part.share > 0.5 : part.prevalence === 'majority';
/** Counts for the tradition filter and the hatching: a ≥20 % share or a qualitative majority/substantial code. */
export const isPresentShare = (part: ReligionCoverageShare) =>
  part.share !== undefined
    ? part.share >= 0.2
    : part.prevalence === 'majority' || part.prevalence === 'substantial';

export const ReligionCoverageDatasetSchema = z
  .object({
    version: z.literal(1),
    snapshotMaxAge: z.number().int().min(0).max(100),
    traditions: z.array(Tradition).min(1),
    sources: z.array(Source).min(1),
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
      if (row.shares.filter(isMajorityShare).length > 1) issue(`Conflicting majorities: ${row.id}`);
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

const Entry = z.object({
  id: Id,
  regionId: Id,
  geometryId: Id,
  time: Time,
  /** The single share above the majority threshold, whatever its tradition kind. */
  majority: Id.nullable(),
  /** Traditions in share order that pass `isPresentShare`. */
  present: z.array(Id),
});

/** The render index: everything the map and the region list need, without shares or notes. */
export const ReligionCoverageIndexSchema = z
  .object({
    version: z.literal(2),
    snapshotMaxAge: z.number().int().min(0).max(100),
    traditions: z.array(Tradition).min(1),
    sources: z.array(Source).min(1),
    regions: z.array(z.object({ id: Id, name: Text })),
    geometries: z.array(z.object({ id: Id, geometry: Geometry, sourceIds: z.array(Id).min(1) })),
    observations: z.array(Entry),
  })
  .superRefine((data, context) => {
    const issue = (message: string) => context.addIssue({ code: 'custom', message });
    for (const key of ['traditions', 'sources', 'regions', 'geometries', 'observations'] as const)
      if (new Set(data[key].map((row) => row.id)).size !== data[key].length)
        issue(`Duplicate ${key} ID`);
    const traditions = new Set(data.traditions.map((row) => row.id));
    const sources = new Set(data.sources.map((row) => row.id));
    const regions = new Set(data.regions.map((row) => row.id));
    const geometries = new Set(data.geometries.map((row) => row.id));
    const times = new Set<string>();
    for (const geometry of data.geometries)
      if (geometry.sourceIds.some((id) => !sources.has(id)))
        issue(`Unknown geometry source: ${geometry.id}`);
    for (const row of data.observations) {
      if (!regions.has(row.regionId)) issue(`Unknown region: ${row.id}`);
      if (!geometries.has(row.geometryId)) issue(`Unknown geometry: ${row.id}`);
      if (row.majority && !traditions.has(row.majority)) issue(`Unknown tradition: ${row.id}`);
      if (row.majority && !row.present.includes(row.majority))
        issue(`Majority absent from present traditions: ${row.id}`);
      if (new Set(row.present).size !== row.present.length) issue(`Duplicate tradition: ${row.id}`);
      for (const id of row.present) if (!traditions.has(id)) issue(`Unknown tradition: ${row.id}`);
      const key = JSON.stringify([row.regionId, row.time]);
      if (times.has(key)) issue(`Duplicate region/time observation: ${row.id}`);
      times.add(key);
    }
  });

/** One region's detail file: the untouched full observations behind the index entries. */
export const ReligionCoverageRegionSchema = z
  .object({
    version: z.literal(2),
    regionId: Id,
    observations: z.array(Observation).min(1),
  })
  .superRefine((data, context) => {
    const ids = new Set<string>();
    for (const row of data.observations) {
      if (row.regionId !== data.regionId)
        context.addIssue({ code: 'custom', message: `Foreign observation: ${row.id}` });
      if (ids.has(row.id))
        context.addIssue({ code: 'custom', message: `Duplicate observations ID` });
      ids.add(row.id);
    }
  });

export type ReligionCoverageIndex = z.infer<typeof ReligionCoverageIndexSchema>;
export type ReligionCoverageEntry = z.infer<typeof Entry>;
export type ReligionCoverageRegion = z.infer<typeof ReligionCoverageRegionSchema>;
export type ReligionCoverageRegionName = ReligionCoverageIndex['regions'][number];

/** Most recent dated snapshot within its declared retention window, or a published interval. */
export function religionCoverageAt(
  index: ReligionCoverageIndex,
  year: number,
  range: [number, number] | null = null,
  tradition: string | null = null,
): ReligionCoverageEntry[] {
  const horizon = range ? Math.max(...range) : year;
  const regions = new Map<string, ReligionCoverageEntry[]>();
  for (const row of index.observations) {
    const time = row.time;
    const active =
      time.kind === 'interval'
        ? time.fromYear <= horizon && horizon <= time.toYear
        : time.year <= horizon && horizon - time.year <= index.snapshotMaxAge;
    if (active) {
      const rows = regions.get(row.regionId) ?? [];
      rows.push(row);
      regions.set(row.regionId, rows);
    }
  }
  const visible: ReligionCoverageEntry[] = [];
  for (const rows of regions.values()) {
    const latest = Math.max(
      ...rows.map((row) => (row.time.kind === 'snapshot' ? row.time.year : -Infinity)),
    );
    const candidates = rows.filter(
      (row) => row.time.kind === 'interval' || row.time.year === latest,
    );
    if (candidates.length !== 1) continue;
    const row = candidates[0];
    if (!tradition || row.present.includes(tradition)) visible.push(row);
  }
  return visible;
}

/** A neutral population category can dominate numerically without being a religious majority. */
export function religionCoverageClasses(
  index: ReligionCoverageIndex,
  entry: ReligionCoverageEntry,
): { majority: string | null; substantial: string[] } {
  const kinds = new Map(index.traditions.map((row) => [row.id, row.kind]));
  const majority =
    entry.majority && kinds.get(entry.majority) === 'religion' ? entry.majority : null;
  return {
    majority,
    substantial: entry.present.filter((id) => id !== majority && kinds.get(id) === 'religion'),
  };
}

export const COVERAGE_COORDINATE_DECIMALS = 4;

/** Published outlines are rounded to 1e-4°, about ten metres, far below the source accuracy. */
export function roundCoverageGeometry(
  geometry: z.infer<typeof Geometry>,
): z.infer<typeof Geometry> {
  const factor = 10 ** COVERAGE_COORDINATE_DECIMALS;
  const round = (value: number) => Math.round(value * factor) / factor;
  const ring = (points: [number, number][]): [number, number][] =>
    points.map(([x, y]) => [round(x), round(y)]);
  return geometry.type === 'Polygon'
    ? { type: 'Polygon', coordinates: geometry.coordinates.map(ring) }
    : {
        type: 'MultiPolygon',
        coordinates: geometry.coordinates.map((polygon) => polygon.map(ring)),
      };
}

export function summarizeCoverageObservation(observation: ReligionCoverageObservation): {
  majority: string | null;
  present: string[];
} {
  const majorities = observation.shares.filter(isMajorityShare);
  if (majorities.length > 1) throw new Error(`Conflicting majorities: ${observation.id}`);
  return {
    majority: majorities[0]?.traditionId ?? null,
    present: observation.shares.filter(isPresentShare).map((part) => part.traditionId),
  };
}

export function splitReligionCoverage(dataset: ReligionCoverageDataset): {
  index: ReligionCoverageIndex;
  regions: ReligionCoverageRegion[];
} {
  const names = new Map<string, { fr: string; en: string }>();
  const grouped = new Map<string, ReligionCoverageObservation[]>();
  for (const row of dataset.observations) {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(row.regionId))
      throw new Error(`Unsafe region id: ${row.regionId}`);
    const previous = names.get(row.regionId);
    if (previous && (previous.fr !== row.name.fr || previous.en !== row.name.en))
      throw new Error(`Conflicting region names: ${row.regionId}`);
    names.set(row.regionId, row.name);
    const rows = grouped.get(row.regionId) ?? [];
    rows.push(row);
    grouped.set(row.regionId, rows);
  }
  const index = ReligionCoverageIndexSchema.parse({
    version: 2,
    snapshotMaxAge: dataset.snapshotMaxAge,
    traditions: dataset.traditions,
    sources: dataset.sources,
    regions: [...names].map(([id, name]) => ({ id, name })),
    geometries: dataset.geometries.map((row) => ({
      ...row,
      geometry: roundCoverageGeometry(row.geometry),
    })),
    observations: dataset.observations.map((row) => ({
      id: row.id,
      regionId: row.regionId,
      geometryId: row.geometryId,
      time: row.time,
      ...summarizeCoverageObservation(row),
    })),
  });
  const regions = [...grouped].map(([regionId, observations]) =>
    ReligionCoverageRegionSchema.parse({ version: 2, regionId, observations }),
  );
  return { index, regions };
}
