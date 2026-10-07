import type { FeatureCollection, LineString, MultiLineString } from 'geojson';
import type { Locale } from '@/lib/types';
import { z } from '@/lib/zod';
import { networkGeometry } from './network-geography';

const Text = z.object({ fr: z.string().min(1), en: z.string().min(1) });
const Coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)]);
const Source = z.object({ label: z.string().min(1), url: z.url().startsWith('https://') });

export const NetworkKindSchema = z.enum(['trade', 'migration', 'forced-migration']);

/** A dated reading window, never a year-by-year reconstruction of traffic or road geometry. */
export const NetworkRecordSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    title: Text,
    kind: NetworkKindSchema,
    fromYear: z.number().int().min(-3500).max(2100),
    toYear: z.number().int().min(-3500).max(2100),
    /** Approximate dates reflect periodisation, not an exact opening or closure. */
    approximate: z.boolean(),
    uncertain: z.boolean(),
    temporalBasis: Text,
    direction: z.enum(['both', 'forward']),
    directionNote: Text,
    geometry: z.literal('schematic'),
    coordinates: z.array(Coordinate).min(2),
    waypoints: z
      .array(
        z.object({
          name: Text,
          coordinates: Coordinate,
          basis: z.literal('editorial-anchor'),
        }),
      )
      .min(2),
    description: Text,
    mechanisms: Text,
    limits: Text,
    sources: z.array(Source).min(1),
  })
  .strict()
  .superRefine((network, context) => {
    const issue = (message: string) => context.addIssue({ code: 'custom', message });
    if (network.fromYear > network.toYear) issue(`Reversed network period: ${network.id}`);
    if ((network.kind === 'trade') !== (network.direction === 'both'))
      issue(`Direction contradicts the network reading convention: ${network.id}`);
    if (new Set(network.coordinates.map((point) => point.join(','))).size < 2)
      issue(`Degenerate network geometry: ${network.id}`);
    if (
      network.coordinates.length !== network.waypoints.length ||
      network.coordinates.some((point, index) =>
        point.some((value, axis) => value !== network.waypoints[index]?.coordinates[axis]),
      )
    )
      issue(`Network coordinates differ from declared editorial anchors: ${network.id}`);
  });

export const NetworkDatasetSchema = z
  .object({
    version: z.literal(1),
    reviewedAt: z.iso.date(),
    coverage: Text,
    networks: z.array(NetworkRecordSchema).min(1),
  })
  .strict()
  .superRefine((dataset, context) => {
    if (new Set(dataset.networks.map((network) => network.id)).size !== dataset.networks.length)
      context.addIssue({ code: 'custom', message: 'Duplicate network ID' });
  });

export type NetworkRecord = z.infer<typeof NetworkRecordSchema>;
export type NetworkDataset = z.infer<typeof NetworkDatasetSchema>;
export type NetworkKind = NetworkRecord['kind'];

/** Both endpoints are included; a source's reading window is not extrapolated. */
export function networksAtYear(networks: readonly NetworkRecord[], year: number): NetworkRecord[] {
  return networksInPeriod(networks, year, null);
}

/** The selected range takes precedence; partial overlaps remain visible, including endpoints. */
export function networksInPeriod(
  networks: readonly NetworkRecord[],
  year: number,
  range: readonly [number, number] | null,
): NetworkRecord[] {
  const [from, to] = range
    ? [Math.min(range[0], range[1]), Math.max(range[0], range[1])]
    : [year, year];
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
  return networks.filter((network) => network.fromYear <= to && network.toYear >= from);
}

export interface NetworkFeatureProperties {
  id: string;
  title: string;
  kind: NetworkKind;
  fromYear: number;
  toYear: number;
  direction: 'both' | 'forward';
  schematic: true;
}

/** No weight/volume property: line width must not imply undocumented quantities. */
export function networkFeatureCollection(
  networks: readonly NetworkRecord[],
  locale: Locale,
): FeatureCollection<LineString | MultiLineString, NetworkFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: networks.map((network) => ({
      type: 'Feature',
      id: network.id,
      geometry: networkGeometry(network.coordinates),
      properties: {
        id: network.id,
        title: network.title[locale === 'fr' ? 'fr' : 'en'],
        kind: network.kind,
        fromYear: network.fromYear,
        toYear: network.toYear,
        direction: network.direction,
        schematic: true,
      },
    })),
  };
}
