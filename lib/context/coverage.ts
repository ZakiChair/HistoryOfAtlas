import type { FeatureCollection, Point } from 'geojson';
import { z } from '../zod';
import { REGION_IDS, type RegionId } from '../types';

const SourceId = z.enum(['cliopatria', 'historical-basemaps']);
const Year = z.number().int().safe();
const Interval = z.tuple([Year, Year]).refine(([from, to]) => from <= to, 'Reversed interval');
const Source = z
  .object({
    id: SourceId,
    label: z.string().min(1),
    url: z.url().startsWith('https://'),
    license: z.string().min(1),
    range: Interval,
    kind: z.enum(['intervals', 'snapshots']),
    approximate: z.literal(true),
    snapshotYears: z.array(Year).optional(),
  })
  .strict();
const Polity = z
  .object({
    id: z.string().regex(/^(clio|hb)-[a-f0-9]+$/),
    sourceId: SourceId,
    region: z.enum(REGION_IDS),
    center: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
    intervals: z.array(Interval).min(1),
  })
  .strict();

/** Counts evidence in the supplied catalogue. This schema makes no completeness claim. */
export const CoverageDatasetSchema = z
  .object({
    version: z.literal(1),
    method: z.literal('reference-point-regions-v1'),
    centerBasis: z.literal('first-source-label-anchor'),
    inputsSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    sources: z.array(Source).length(2),
    polities: z.array(Polity),
  })
  .strict()
  .superRefine((dataset, context) => {
    const issue = (message: string) => context.addIssue({ code: 'custom', message });
    const sources = new Map(dataset.sources.map((source) => [source.id, source]));
    if (sources.size !== dataset.sources.length) issue('Duplicate coverage source');
    const ids = new Set<string>();
    for (const source of dataset.sources) {
      if ((source.id === 'cliopatria') !== (source.kind === 'intervals'))
        issue(`Invalid temporal method for ${source.id}`);
      if (source.kind === 'snapshots') {
        const years = source.snapshotYears ?? [];
        if (
          !years.length ||
          years.some(
            (year, index) =>
              year < source.range[0] ||
              year > source.range[1] ||
              (index > 0 && year <= years[index - 1]),
          )
        )
          issue(`Invalid snapshot chronology for ${source.id}`);
      }
    }
    for (const polity of dataset.polities) {
      if (ids.has(polity.id)) issue(`Duplicate source identity ${polity.id}`);
      ids.add(polity.id);
      const source = sources.get(polity.sourceId);
      if (!source) {
        issue(`Unknown source for ${polity.id}`);
        continue;
      }
      if (!polity.id.startsWith(source.id === 'cliopatria' ? 'clio-' : 'hb-'))
        issue(`Mismatched source identity ${polity.id}`);
      for (const [from, to] of polity.intervals) {
        if (from < source.range[0] || to > source.range[1])
          issue(`Observation outside source range: ${polity.id}`);
        if (source.kind === 'snapshots' && (from !== to || !source.snapshotYears?.includes(from)))
          issue(`Snapshot is not an annual interval: ${polity.id}`);
      }
    }
  });

export type CoverageDataset = z.infer<typeof CoverageDatasetSchema>;
export type CoverageSourceId = z.infer<typeof SourceId>;
export type CoveragePolity = CoverageDataset['polities'][number];
export type CoverageRegion = {
  id: RegionId;
  entities: number;
  observations: number;
  inventory: number;
};

/** Navigation anchors only; these points are neither historical capitals nor region geometries. */
export const COVERAGE_REGION_CENTERS: Record<RegionId, [number, number]> = {
  europe: [15, 50],
  africa: [20, 0],
  asia: [105, 35],
  'middle-east': [45, 30],
  'north-america': [-100, 40],
  'south-america': [-65, -20],
  oceania: [155, -20],
  global: [0, -65],
};

function observationCount(polity: CoveragePolity, from: number, to: number): number {
  return polity.intervals.reduce(
    (count, [start, end]) => count + Number(start <= to && end >= from),
    0,
  );
}

export function summarizeCoverage(
  dataset: CoverageDataset,
  period: {
    sourceId: CoverageSourceId;
    fromYear: number;
    toYear: number;
  },
) {
  const { sourceId, fromYear, toYear } = period;
  if (!Number.isSafeInteger(fromYear) || !Number.isSafeInteger(toYear) || fromYear > toYear)
    throw new RangeError('Coverage needs an ordered, inclusive astronomical-year interval.');
  const source = dataset.sources.find((candidate) => candidate.id === sourceId)!;
  const regions: CoverageRegion[] = REGION_IDS.map((id) => ({
    id,
    entities: 0,
    observations: 0,
    inventory: 0,
  }));
  const byRegion = new Map(regions.map((row) => [row.id, row]));
  let entities = 0,
    observations = 0,
    inventory = 0;
  for (const polity of dataset.polities) {
    if (polity.sourceId !== sourceId) continue;
    const region = byRegion.get(polity.region)!;
    inventory += 1;
    region.inventory += 1;
    const count = observationCount(polity, fromYear, toYear);
    if (!count) continue;
    entities += 1;
    observations += count;
    region.entities += 1;
    region.observations += count;
  }
  const outsideSourceRange = toYear < source.range[0] || fromYear > source.range[1];
  return {
    source,
    entities,
    observations,
    inventory,
    regions,
    outsideSourceRange,
    // A source says nothing about a period it does not date: its counts are unknown, not zero.
    dated:
      !outsideSourceRange &&
      (!source.snapshotYears ||
        source.snapshotYears.some((value) => value >= fromYear && value <= toYear)),
  };
}

export function snapshotNeighbours(
  dataset: CoverageDataset,
  sourceId: CoverageSourceId,
  year: number,
) {
  const years = dataset.sources.find((source) => source.id === sourceId)?.snapshotYears ?? [];
  return {
    exact: years.includes(year),
    previous: years.filter((value) => value < year).at(-1),
    next: years.find((value) => value > year),
  };
}

export type CoverageFeatureProperties = {
  id: RegionId;
  entityId: string;
  regionId: RegionId;
  documented: boolean;
  observations: number;
  selected: boolean;
  referenceAnchor: true;
};

/** An inventory of fixed reference anchors, never an inferred territory or settlement map. */
export function coverageFeatureCollection(
  dataset: CoverageDataset,
  year: number,
  range: [number, number] | null,
  sourceId: CoverageSourceId,
  selectedId: string | null,
): FeatureCollection<Point, CoverageFeatureProperties> {
  const [from, to] = range ?? [year, year];
  // A selection from another view or an old link names no region and must not empty the map.
  const region = REGION_IDS.includes(selectedId as RegionId) ? selectedId : null;
  return {
    type: 'FeatureCollection',
    features: dataset.polities
      .filter((polity) => polity.sourceId === sourceId && (!region || polity.region === region))
      .map((polity) => {
        const observations = observationCount(polity, from, to);
        return {
          type: 'Feature',
          id: polity.id,
          geometry: { type: 'Point', coordinates: [...polity.center] },
          properties: {
            id: polity.region,
            entityId: polity.id,
            regionId: polity.region,
            documented: observations > 0,
            observations,
            selected: polity.region === region,
            referenceAnchor: true,
          },
        };
      }),
  };
}
