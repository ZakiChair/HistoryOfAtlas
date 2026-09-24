import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import LocaleLink from '@/components/ui/LocaleLink';
import type { HistoricalEvent } from '@/lib/schema';
import { formatDateRange } from '@/lib/histdate';
import { readCuratedIds, readEvent, readWarEvents, readWars, type WarRecord } from '@/lib/archive';
import {
  breadcrumbJsonLd,
  eventJsonLd,
  jsonLdGraph,
  serializeJsonLd,
  type EventLike,
} from '@/lib/jsonld';
import { commonsImageUrl, errorReportUrl, hasStaticEventPage, siteOrigin } from '@/lib/seo';

export const dynamic = 'force-static';
export const dynamicParams = false;

/** Keeps the structured data small on conflicts with hundreds of documented events. */
const MAX_JSON_LD_SUB_EVENTS = 100;

async function readWar(id: string): Promise<WarRecord | undefined> {
  return (await readWars()).find((item) => item.id === id);
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
  const war = await readWar(id);
  if (!war) return { title: 'Conflict not found — HistoryOfAtlas' };
  const name = war.name.en;
  const description = `${name}: ${war.count} documented events, their chronology and sources in HistoryOfAtlas.`;
  const image = commonsImageUrl((await readEvent(war.id))?.image);
  return {
    title: `${name} — HistoryOfAtlas`,
    description,
    alternates: { canonical: `/war/${id}/` },
    openGraph: {
      title: name,
      description,
      url: `/war/${id}/`,
      siteName: 'HistoryOfAtlas',
      locale: 'en_US',
      type: 'article',
      images: image ? [{ url: image, alt: name }] : ['/opengraph-image'],
    },
  };
}

function eventMapUrl(event: HistoricalEvent, war: WarRecord): string {
  const query = new URLSearchParams({ e: event.id, war: war.id, y: String(event.start.year) });
  if (event.coords) {
    query.set('lon', String(event.coords[0]));
    query.set('lat', String(event.coords[1]));
    query.set('z', '5');
  }
  return `/?${query}`;
}

export default async function WarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const war = await readWar(id);
  if (!war) notFound();
  const [events, record, curated] = await Promise.all([
    readWarEvents(war.id).then((items) => items ?? []),
    readEvent(war.id),
    readCuratedIds(),
  ]);
  const origin = siteOrigin();
  const pagePath = `/war/${war.id}/`;
  const name = war.name.en;
  const archived = new Set(
    events.filter((event) => hasStaticEventPage(event, curated)).map((event) => event.id),
  );
  const summary: EventLike = record ?? {
    id: war.id,
    name: war.name,
    start: war.start,
    ...(war.end ? { end: war.end } : {}),
    datePrecision: 'year',
  };
  const jsonLd = jsonLdGraph(
    eventJsonLd(summary, {
      origin,
      path: pagePath,
      subEvents: events
        .filter((event) => archived.has(event.id))
        .slice(0, MAX_JSON_LD_SUB_EVENTS)
        .map((event) => ({ id: event.id, name: event.name.en, path: `/event/${event.id}/` })),
    }),
    breadcrumbJsonLd(origin, [
      { name: 'HistoryOfAtlas', path: '/' },
      { name, path: pagePath },
    ]),
  );
  const introduction = record?.summary?.en ?? record?.description?.en;
  return (
    <main className="document-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <header className="document-header">
        <LocaleLink className="back-link" href="/">
          ← Back to the atlas
        </LocaleLink>
        <span className="eyebrow">CONFLICTS & TIMELINES · {war.id}</span>
        <h1>{name}</h1>
        <p>
          {war.count} documented event{war.count === 1 ? '' : 's'} in this record
          {archived.size > 0 ? ` · ${archived.size} with an archive page` : ''}
        </p>
        <Link
          className="primary-button"
          href={`/?war=${war.id}&y=${war.start.year}&from=${war.start.year}&to=${war.end?.year ?? war.start.year}&projection=mercator`}
        >
          Explore this timeline ↗
        </Link>
      </header>
      <article className="document-body">
        {introduction && <p>{introduction}</p>}
        {record && hasStaticEventPage(record, curated) && (
          <Link className="source-link" href={`/event/${record.id}/`}>
            Dates, participants and sources of this conflict →
          </Link>
        )}
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
                  {archived.has(event.id) ? (
                    <Link href={`/event/${event.id}/`}>{event.name.en}</Link>
                  ) : (
                    <Link href={eventMapUrl(event, war)}>{event.name.en} ↗</Link>
                  )}
                </h3>
                {archived.has(event.id) && (
                  <Link className="source-link" href={eventMapUrl(event, war)}>
                    On the map ↗
                  </Link>
                )}{' '}
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
          </a>{' '}
          <Link className="source-link" href="/about/">
            Read the methodology →
          </Link>{' '}
          <a
            className="source-link"
            href={errorReportUrl({
              name,
              id: war.id,
              kind: 'war',
              year: war.start.year,
              url: `${origin}${pagePath}`,
            })}
            target="_blank"
            rel="noreferrer"
          >
            Report an error on this page ↗
          </a>
        </section>
      </article>
    </main>
  );
}
