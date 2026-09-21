import type { Metadata } from 'next';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { HistoricalEvent } from '@/lib/schema';
import type { HistDate } from '@/lib/histdate';
import { formatDateRange } from '@/lib/histdate';

export const dynamic = 'force-static';
export const dynamicParams = false;
type War = {
  id: string;
  name: { fr?: string; en: string };
  start: HistDate;
  end?: HistDate;
  count: number;
  path: string;
  source: string;
};
const root = path.join(process.cwd(), 'public/data');
async function readWars(): Promise<War[]> {
  return JSON.parse(await readFile(path.join(root, 'wars.json'), 'utf8')) as War[];
}
export async function generateStaticParams() {
  return (await readWars()).map((war) => ({ id: war.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const war = (await readWars()).find((item) => item.id === id);
  if (!war) return { title: 'Conflict not found — HistoryOfAtlas' };
  const name = war.name.en;
  const description = `${name}: ${war.count} documented events, their chronology and sources in HistoryOfAtlas.`;
  return {
    title: `${name} — HistoryOfAtlas`,
    description,
    alternates: { canonical: `/war/${id}/` },
    openGraph: {
      title: name,
      description,
      siteName: 'HistoryOfAtlas',
      locale: 'en_US',
      type: 'article',
      images: ['/opengraph-image'],
    },
  };
}

export default async function WarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const war = (await readWars()).find((item) => item.id === id);
  if (!war) notFound();
  const events = JSON.parse(
    await readFile(path.join(root, 'wars', `${war.id}.json`), 'utf8'),
  ) as HistoricalEvent[];
  const name = war.name.en;
  return (
    <main className="document-page">
      <header className="document-header">
        <Link className="back-link" href="/">
          ← Back to the atlas
        </Link>
        <span className="eyebrow">CONFLICTS & TIMELINES · {war.id}</span>
        <h1>{name}</h1>
        <p>
          {war.count} documented event{war.count === 1 ? '' : 's'} in this record
        </p>
        <Link
          className="primary-button"
          href={`/?war=${war.id}&y=${war.start.year}&from=${war.start.year}&to=${war.end?.year ?? war.start.year}&projection=mercator`}
        >
          Explore this timeline ↗
        </Link>
      </header>
      <article className="document-body">
        <section>
          <h2>Related events</h2>
          <p>
            The chronological links below come from Wikidata’s “part of” and “has part” relations.
            This selection covers {formatDateRange(war.start, war.end, 'en')}; it does not claim to
            cover the entire conflict or reconstruct an army’s movements.
          </p>
          <ol className="war-event-list">
            {events.map((event) => (
              <li key={event.id}>
                <span className="eyebrow">
                  {formatDateRange(event.start, event.end, 'en', event.datePrecision)}
                </span>
                <h3>
                  <Link
                    href={`/?e=${event.id}&war=${war.id}&y=${event.start.year}${event.coords ? `&lon=${event.coords[0]}&lat=${event.coords[1]}&z=5` : ''}`}
                  >
                    {event.name.en} ↗
                  </Link>
                </h3>
                <a
                  className="source-link"
                  href={`https://www.wikidata.org/wiki/${event.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source · {event.id}
                </a>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h2>Provenance and limits</h2>
          <p>
            An absent event does not mean it never happened. The available dates, participants and
            locations depend on the coverage of open sources.
          </p>
          <a className="source-link" href={war.source} target="_blank" rel="noreferrer">
            Wikidata · {war.id} ↗
          </a>
          <Link className="source-link" href="/about/">
            Read the methodology →
          </Link>
        </section>
      </article>
    </main>
  );
}
