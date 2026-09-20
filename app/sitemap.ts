import type { MetadataRoute } from 'next';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { HistoricalEvent } from '@/lib/schema';
import { hasStaticEventPage } from '@/lib/seo';
export const dynamic = 'force-static';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const directory = path.join(process.cwd(), 'public/data');
  const [warsText, curatedText, files] = await Promise.all([
    readFile(path.join(directory, 'wars.json'), 'utf8'),
    readFile(path.join(directory, 'curated.json'), 'utf8'),
    readdir(path.join(directory, 'events')),
  ]);
  const wars = JSON.parse(warsText) as { id: string }[];
  const curated = new Set((JSON.parse(curatedText) as { id: string }[]).map((event) => event.id));
  const events = await Promise.all(
    files
      .filter((file) => /^Q\d+\.json$/.test(file))
      .map(
        async (file) =>
          JSON.parse(
            await readFile(path.join(directory, 'events', file), 'utf8'),
          ) as HistoricalEvent,
      ),
  );
  return [
    { url: `${origin}/`, priority: 1 },
    { url: `${origin}/about/`, priority: 0.7 },
    ...events
      .filter((event) => hasStaticEventPage(event, curated))
      .map((event) => ({ url: `${origin}/event/${event.id}/`, priority: 0.6 })),
    ...wars.map((war) => ({ url: `${origin}/war/${war.id}/`, priority: 0.7 })),
  ];
}
