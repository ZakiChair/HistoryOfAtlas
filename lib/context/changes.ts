import type { FeatureCollection, Point } from 'geojson';
import { z } from '@/lib/zod';
import { contextText } from './types';
import type { Locale } from '@/lib/types';

const Text = z.object({ fr: z.string().min(1), en: z.string().min(1) });
export const ChangesDatasetSchema = z
  .object({
    version: z.literal(1),
    reviewedAt: z.iso.date(),
    changes: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
            year: z.number().int().min(-3500).max(2100),
            title: Text,
            mechanism: Text,
            consequence: Text,
            limits: Text,
            coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)]),
            sources: z
              .array(z.object({ label: z.string().min(1), url: z.url().startsWith('https://') }))
              .min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (new Set(data.changes.map((item) => item.id)).size !== data.changes.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate transformation ID' });
  });
export type ChangesDataset = z.infer<typeof ChangesDatasetSchema>;
export type HistoricalChange = ChangesDataset['changes'][number];

/** A labelled twenty-year reading window, not the duration of the historical event. */
export function changesInPeriod(
  changes: readonly HistoricalChange[],
  year: number,
  range: [number, number] | null,
) {
  const [from, to] = range ?? [year - 10, year + 10];
  return changes.filter((change) => change.year >= from && change.year <= to);
}

export function changesGeoJSON(
  changes: readonly HistoricalChange[],
  locale: Locale,
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: changes.map((change) => ({
      type: 'Feature',
      id: change.id,
      geometry: { type: 'Point', coordinates: change.coordinates },
      properties: {
        id: change.id,
        name: contextText(change.title, locale),
        year: change.year,
        kind: 'changes',
      },
    })),
  };
}
