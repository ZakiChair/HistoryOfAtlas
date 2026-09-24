import type { Metadata } from 'next';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import LocaleLink from '@/components/ui/LocaleLink';
import type { HistoricalEvent } from '@/lib/schema';
import { formatDateRange } from '@/lib/histdate';
import {
  readCuratedIds,
  readEvent,
  readWarEvents,
  readWars,
  warNeighbours,
  type WarNeighbours,
} from '@/lib/archive';
import {
  breadcrumbJsonLd,
  eventJsonLd,
  jsonLdGraph,
  serializeJsonLd,
  type BreadcrumbItem,
} from '@/lib/jsonld';
import {
  commonsImageUrl,
  errorReportUrl,
  getEventMapUrl,
  getEventPermalink,
  hasStaticEventPage,
  siteOrigin,
} from '@/lib/seo';

export const dynamic = 'force-static';
export const dynamicParams = false;
const directory = path.join(process.cwd(), 'public/data/events');

export async function generateStaticParams() {
  const [events, curated] = await Promise.all([
    readdir(directory).then((files) =>
      Promise.all(
        files
          .filter((file) => /^Q\d+\.json$/.test(file))
          .map((file) => readEvent(file.slice(0, -5))),
      ),
    ),
    readCuratedIds(),
  ]);
  return events
    .filter((event): event is HistoricalEvent =>
      Boolean(event && hasStaticEventPage(event, curated)),
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
  const image = commonsImageUrl(event.image);
  return {
    title: `${name} — HistoryOfAtlas`,
    description,
    alternates: { canonical: `/event/${event.id}/` },
    openGraph: {
      title: name,
      description,
      url: `/event/${event.id}/`,
      siteName: 'HistoryOfAtlas',
      locale: 'en_US',
      type: 'article',
      images: image ? [{ url: image, alt: name }] : ['/opengraph-image'],
    },
  };
}

interface ParentWar {
  id: string;
  name?: string;
  /** Archive page of the conflict, when one is exported. */
  path?: string;
  mapUrl: string;
  neighbours: WarNeighbours<HistoricalEvent> | null;
}

/** A conflict record also has a chronology page listing its documented events. */
async function readOwnWarPath(event: HistoricalEvent): Promise<string | undefined> {
  return (await readWars()).some((war) => war.id === event.id) ? `/war/${event.id}/` : undefined;
}

async function readParentWar(event: HistoricalEvent): Promise<ParentWar | null> {
  if (!event.parentWar) return null;
  const [wars, members] = await Promise.all([readWars(), readWarEvents(event.parentWar)]);
  const war = wars.find((item) => item.id === event.parentWar);
  const query = new URLSearchParams({ war: event.parentWar, y: String(event.start.year) });
  return {
    id: event.parentWar,
    ...(war ? { name: war.name.en, path: `/war/${war.id}/` } : {}),
    mapUrl: `/?${query}`,
    neighbours: members ? warNeighbours(members, event.id) : null,
  };
}

function NeighbourLink({
  label,
  event,
  curated,
}: {
  label: string;
  event: HistoricalEvent;
  curated: ReadonlySet<string>;
}) {
  const href = getEventPermalink(event, curated);
  const external = !href.startsWith('/event/');
  return (
    <div className="document-card">
      <span className="eyebrow">{label}</span>
      <p>
        <Link href={href}>
          {event.name.en}
          {external ? ' ↗' : ''}
        </Link>
      </p>
      <p>{formatDateRange(event.start, event.end, 'en', event.datePrecision)}</p>
    </div>
  );
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const event = await readEvent((await params).id);
  if (!event) notFound();
  const [parentWar, ownWarPath, curated] = await Promise.all([
    readParentWar(event),
    readOwnWarPath(event),
    readCuratedIds(),
  ]);
  const origin = siteOrigin();
  const pagePath = `/event/${event.id}/`;
  const name = event.name.en;
  const mapUrl = getEventMapUrl(event);
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
  const breadcrumb: BreadcrumbItem[] = [
    { name: 'HistoryOfAtlas', path: '/' },
    ...(parentWar?.path && parentWar.name ? [{ name: parentWar.name, path: parentWar.path }] : []),
    { name, path: pagePath },
  ];
  const jsonLd = jsonLdGraph(
    eventJsonLd(event, {
      origin,
      path: pagePath,
      ...(parentWar
        ? {
            superEvent: {
              id: parentWar.id,
              name: parentWar.name ?? parentWar.id,
              ...(parentWar.path ? { path: parentWar.path } : {}),
            },
          }
        : {}),
    }),
    breadcrumbJsonLd(origin, breadcrumb),
  );
  const neighbours = parentWar?.neighbours;
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
        <span className="eyebrow">THE ATLAS ARCHIVES · {event.id}</span>
        <h1>{name}</h1>
        <p>{date}</p>
        <Link className="primary-button" href={mapUrl}>
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
              {parentWar && (
                <>
                  <dt>Part of</dt>
                  <dd>
                    {parentWar.path ? (
                      <Link href={parentWar.path}>{parentWar.name}</Link>
                    ) : (
                      parentWar.id
                    )}
                  </dd>
                </>
              )}
            </dl>
            {parentWar && (
              <Link className="source-link" href={parentWar.mapUrl}>
                {parentWar.name
                  ? `${parentWar.name} on the map ↗`
                  : `Explore the related conflict · ${parentWar.id} ↗`}
              </Link>
            )}
            {ownWarPath && (
              <Link className="source-link" href={ownWarPath}>
                Chronology of this conflict →
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
        {neighbours && (neighbours.previous || neighbours.next) && (
          <nav aria-labelledby="war-sequence-title">
            <span className="eyebrow">
              {neighbours.position} / {neighbours.total} IN THIS CONFLICT
            </span>
            <h2 id="war-sequence-title">
              {parentWar?.path ? (
                <Link href={parentWar.path}>{parentWar.name}</Link>
              ) : (
                'Within this conflict'
              )}
            </h2>
            <div className="document-grid">
              {neighbours.previous ? (
                <NeighbourLink label="← PREVIOUS" event={neighbours.previous} curated={curated} />
              ) : (
                <div />
              )}
              {neighbours.next && (
                <NeighbourLink label="NEXT →" event={neighbours.next} curated={curated} />
              )}
            </div>
          </nav>
        )}
        {Boolean(event.people?.length) && (
          <section>
            <h2>People and command</h2>
            <ul>
              {event.people!.map((person, index) => {
                const personQuery = new URLSearchParams(mapUrl.split('?')[1]);
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
          <a
            className="source-link"
            href={errorReportUrl({
              name,
              id: event.id,
              kind: 'event',
              year: event.start.year,
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
