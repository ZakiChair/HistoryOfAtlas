import type { MetadataRoute } from 'next';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { HistoricalEvent } from '@/lib/schema';
import { readCuratedIds, readDataBuiltAt, readEvent, readWars } from '@/lib/archive';
import { hasStaticEventPage, siteOrigin } from '@/lib/seo';
export const dynamic = 'force-static';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const [wars, curated, files, builtAt] = await Promise.all([
    readWars(),
    readCuratedIds(),
    readdir(path.join(process.cwd(), 'public/data/events')),
    readDataBuiltAt(),
  ]);
  const events = await Promise.all(
    files.filter((file) => /^Q\d+\.json$/.test(file)).map((file) => readEvent(file.slice(0, -5))),
  );
  // Every archive page is regenerated from the same data build.
  const lastModified = builtAt;
  return [
    { url: `${origin}/`, lastModified, priority: 1 },
    { url: `${origin}/about/`, lastModified, priority: 0.7 },
    ...events
      .filter((event): event is HistoricalEvent =>
        Boolean(event && hasStaticEventPage(event, curated)),
      )
      .map((event) => ({ url: `${origin}/event/${event.id}/`, lastModified, priority: 0.6 })),
    ...wars.map((war) => ({ url: `${origin}/war/${war.id}/`, lastModified, priority: 0.7 })),
  ];
}
