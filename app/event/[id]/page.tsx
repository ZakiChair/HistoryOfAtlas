import type { Metadata } from 'next';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { HistoricalEvent } from '@/lib/schema';
import { formatDateRange } from '@/lib/histdate';
import { hasStaticEventPage } from '@/lib/seo';

export const dynamic = 'force-static';
export const dynamicParams = false;
const directory = path.join(process.cwd(), 'public/data/events');

async function readEvent(id: string): Promise<HistoricalEvent | null> {
  if (!/^Q[1-9]\d*$/.test(id)) return null;
  try {
    return JSON.parse(
      await readFile(path.join(directory, `${id}.json`), 'utf8'),
    ) as HistoricalEvent;
  } catch {
    return null;
  }
}

export async function generateStaticParams() {
  const events = await Promise.all(
    (await readdir(directory))
      .filter((file) => /^Q\d+\.json$/.test(file))
      .map((file) => readEvent(file.slice(0, -5))),
  );
  const curated = JSON.parse(
    await readFile(path.join(process.cwd(), 'public/data/curated.json'), 'utf8'),
  ) as { id: string }[];
  const selected = new Set(curated.map((event) => event.id));
  return events
    .filter((event): event is HistoricalEvent =>
      Boolean(event && hasStaticEventPage(event, selected)),
    )
    .map((event) => ({ id: event.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const event = await readEvent((await params).id);
  if (!event) return { title: 'Event not found — HistoryOfAtlas' };
  const name = event.name.en;
  const description = `${name} · ${formatDateRange(event.start, event.end, 'en', event.datePrecision)}. See dates, documented participants and sources, then explore this event on the historical map.`;
  return {
    title: `${name} — HistoryOfAtlas`,
    description,
    alternates: { canonical: `/event/${event.id}/` },
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

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const event = await readEvent((await params).id);
  if (!event) notFound();
  const name = event.name.en;
  const query = new URLSearchParams({ y: String(event.start.year), e: event.id });
  if (event.coords) {
    query.set('lon', String(event.coords[0]));
    query.set('lat', String(event.coords[1]));
    query.set('z', '5');
  }
  const sources = [...event.sources];
  for (const [language, url] of Object.entries(event.wikipedia ?? {})) {
    if (url && !sources.some((source) => source.url === url))
      sources.push({ label: `Wikipedia ${language.toUpperCase()}`, url });
  }
  const date = formatDateRange(event.start, event.end, 'en', {
    precision: event.datePrecision,
    approximate: event.dateApproximate,
    calendar: event.calendar,
    showCalendar: true,
  });
  return (
    <main className="document-page">
      <header className="document-header">
        <Link className="back-link" href="/">
          ← Back to the atlas
        </Link>
        <span className="eyebrow">THE ATLAS ARCHIVES · {event.id}</span>
        <h1>{name}</h1>
        <p>{date}</p>
        <Link className="primary-button" href={`/?${query}`}>
          Explore this event in history ↗
        </Link>
      </header>
      <article className="document-body">
        {event.disputed && (
          <p className="document-notice">
            This event’s Wikidata source lists more than one date or location.
          </p>
        )}
        {event.summary?.en && <p>{event.summary.en}</p>}
        {!event.summary?.en && event.summary?.fr && <p lang="fr">{event.summary.fr}</p>}
        {(event.description?.en ?? event.description?.fr) && (
          <p lang={event.description?.en ? 'en' : 'fr'}>
            {event.description?.en ?? event.description?.fr}
          </p>
        )}
        <div className="document-grid">
          <section className="document-card">
            <span className="eyebrow">01 / KEY FACTS</span>
            <h2>Documented facts</h2>
            <dl>
              <dt>Date</dt>
              <dd>{date}</dd>
              <dt>Precision</dt>
              <dd>
                {
                  {
                    day: 'Day',
                    month: 'Month',
                    year: 'Year',
                    decade: 'Decade',
                    century: 'Century',
                  }[event.datePrecision]
                }
              </dd>
              {event.place?.name && (
                <>
                  <dt>Referenced location</dt>
                  <dd>{event.place.name}</dd>
                </>
              )}
              {event.coords && (
                <>
                  <dt>Source coordinates</dt>
                  <dd>
                    {event.coords[1].toFixed(4)}°, {event.coords[0].toFixed(4)}°
                  </dd>
                </>
              )}
              {event.outcome && (
                <>
                  <dt>Reported outcome</dt>
                  <dd>{event.outcome}</dd>
                </>
              )}
              {event.victor && (
                <>
                  <dt>Reported victor</dt>
                  <dd>{event.victor}</dd>
                </>
              )}
              {event.strength !== undefined && (
                <>
                  <dt>Reported strength</dt>
                  <dd>{event.strength.toLocaleString('en')}</dd>
                </>
              )}
              {event.deaths !== undefined && (
                <>
                  <dt>Reported deaths</dt>
                  <dd>{event.deaths.toLocaleString('en')}</dd>
                </>
              )}
              {event.casualties !== undefined && (
                <>
                  <dt>Reported casualties</dt>
                  <dd>{event.casualties.toLocaleString('en')}</dd>
                </>
              )}
            </dl>
            {event.parentWar && (
              <Link className="source-link" href={`/?war=${event.parentWar}&y=${event.start.year}`}>
                Explore the related conflict · {event.parentWar} ↗
              </Link>
            )}
          </section>
          <section className="document-card">
            <span className="eyebrow">02 / PARTICIPANTS</span>
            <h2>Referenced participants</h2>
            {event.belligerents.length ? (
              <ul>
                {event.belligerents.map((party) => (
                  <li key={`${party.entityId}-${party.side}`}>
                    <a
                      href={`https://www.wikidata.org/wiki/${party.entityId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {party.name} ↗
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Participants are not listed in this record.</p>
            )}
            <p>
              Documented participation does not establish opposing sides. Alliances absent from the
              sources are not reconstructed.
            </p>
          </section>
        </div>
        {Boolean(event.people?.length) && (
          <section>
            <h2>People and command</h2>
            <ul>
              {event.people!.map((person, index) => {
                const personQuery = new URLSearchParams(query);
                personQuery.set('person', person.personId);
                return (
                  <li key={`${person.statementId}-${person.personId}-${index}`}>
                    <Link href={`/?${personQuery}`}>
                      {person.name.en} —{' '}
                      {person.role === 'commander'
                        ? 'documented command'
                        : 'documented participation'}
                    </Link>
                    {' · '}
                    <a href={person.sources[0].url} target="_blank" rel="noreferrer">
                      Source ↗
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section>
          <span className="eyebrow">03 / PROVENANCE</span>
          <h2>Trace the sources</h2>
          <p>
            The information on this page comes from Wikidata. Summaries and illustrations retain
            their own licences; the interactive record opens the related encyclopedia articles.
          </p>
          <ul>
            {sources.map((source) => (
              <li key={source.url}>
                <a className="source-link" href={source.url} target="_blank" rel="noreferrer">
                  {source.label} ↗
                </a>
              </li>
            ))}
          </ul>
          <Link className="source-link" href="/about/">
            Understand dates, uncertainty and licences →
          </Link>
        </section>
      </article>
    </main>
  );
}
