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
  if (!event) return { title: 'Événement introuvable — Atlas Belli' };
  const name = event.name.fr ?? event.name.en;
  const description = `${name} · ${formatDateRange(event.start, event.end, 'fr', event.datePrecision)}. Consultez les dates, les participants documentés et les sources, puis explorez cet événement sur la carte historique.`;
  return {
    title: `${name} — Atlas Belli`,
    description,
    alternates: { canonical: `/event/${event.id}/` },
    openGraph: { title: name, description, type: 'article', images: ['/opengraph-image'] },
  };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const event = await readEvent((await params).id);
  if (!event) notFound();
  const name = event.name.fr ?? event.name.en;
  const query = new URLSearchParams({ y: String(event.start.year), e: event.id });
  if (event.coords) {
    query.set('lon', String(event.coords[0]));
    query.set('lat', String(event.coords[1]));
    query.set('z', '5');
  }
  const sources = [...event.sources];
  for (const [language, url] of Object.entries(event.wikipedia ?? {})) {
    if (url && !sources.some((source) => source.url === url))
      sources.push({ label: `Wikipédia ${language.toUpperCase()}`, url });
  }
  const date = formatDateRange(event.start, event.end, 'fr', {
    precision: event.datePrecision,
    approximate: event.dateApproximate,
    calendar: event.calendar,
    showCalendar: true,
  });
  return (
    <main className="document-page">
      <header className="document-header">
        <Link className="back-link" href="/">
          ← Revenir à l’atlas
        </Link>
        <span className="eyebrow">LES ARCHIVES DE L’ATLAS · {event.id}</span>
        <h1>{name}</h1>
        <p>{date}</p>
        <Link className="primary-button" href={`/?${query}`}>
          Situer cet événement dans l’histoire ↗
        </Link>
      </header>
      <article className="document-body">
        {event.disputed && (
          <p className="document-notice">
            Plusieurs dates ou lieux sont renseignés dans la source Wikidata de cet événement.
          </p>
        )}
        {event.summary?.fr && <p>{event.summary.fr}</p>}
        {!event.summary?.fr && event.summary?.en && <p lang="en">{event.summary.en}</p>}
        {(event.description?.fr ?? event.description?.en) && (
          <p lang={event.description?.fr ? 'fr' : 'en'}>
            {event.description?.fr ?? event.description?.en}
          </p>
        )}
        <div className="document-grid">
          <section className="document-card">
            <span className="eyebrow">01 / REPÈRES</span>
            <h2>Les faits documentés</h2>
            <dl>
              <dt>Date</dt>
              <dd>{date}</dd>
              <dt>Précision</dt>
              <dd>
                {
                  {
                    day: 'Jour',
                    month: 'Mois',
                    year: 'Année',
                    decade: 'Décennie',
                    century: 'Siècle',
                  }[event.datePrecision]
                }
              </dd>
              {event.place?.name && (
                <>
                  <dt>Lieu référencé</dt>
                  <dd>{event.place.name}</dd>
                </>
              )}
              {event.coords && (
                <>
                  <dt>Coordonnées de la source</dt>
                  <dd>
                    {event.coords[1].toFixed(4)}°, {event.coords[0].toFixed(4)}°
                  </dd>
                </>
              )}
              {event.outcome && (
                <>
                  <dt>Issue indiquée</dt>
                  <dd>{event.outcome}</dd>
                </>
              )}
              {event.victor && (
                <>
                  <dt>Vainqueur indiqué</dt>
                  <dd>{event.victor}</dd>
                </>
              )}
              {event.strength !== undefined && (
                <>
                  <dt>Effectifs rapportés</dt>
                  <dd>{event.strength.toLocaleString('fr')}</dd>
                </>
              )}
              {event.deaths !== undefined && (
                <>
                  <dt>Morts rapportés</dt>
                  <dd>{event.deaths.toLocaleString('fr')}</dd>
                </>
              )}
              {event.casualties !== undefined && (
                <>
                  <dt>Pertes rapportées</dt>
                  <dd>{event.casualties.toLocaleString('fr')}</dd>
                </>
              )}
            </dl>
            {event.parentWar && (
              <Link className="source-link" href={`/?war=${event.parentWar}&y=${event.start.year}`}>
                Explorer le conflit lié · {event.parentWar} ↗
              </Link>
            )}
          </section>
          <section className="document-card">
            <span className="eyebrow">02 / ACTEURS</span>
            <h2>Participants référencés</h2>
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
              <p>Les participants ne sont pas renseignés dans ce relevé.</p>
            )}
            <p>
              Une participation documentée ne suffit pas à établir les camps opposés. Les alliances
              absentes des sources ne sont pas reconstituées.
            </p>
          </section>
        </div>
        {Boolean(event.people?.length) && (
          <section>
            <h2>Personnes et commandement</h2>
            <ul>
              {event.people!.map((person, index) => {
                const personQuery = new URLSearchParams(query);
                personQuery.set('person', person.personId);
                return (
                  <li key={`${person.statementId}-${person.personId}-${index}`}>
                    <Link href={`/?${personQuery}`}>
                      {person.name.fr ?? person.name.en} —{' '}
                      {person.role === 'commander'
                        ? 'commandement documenté'
                        : 'participation documentée'}
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
          <h2>Remonter aux sources</h2>
          <p>
            Les informations de cette page proviennent de Wikidata. Les résumés éventuels et les
            illustrations conservent leurs licences propres ; la fiche interactive ouvre les
            articles encyclopédiques associés.
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
            Comprendre les dates, les incertitudes et les licences →
          </Link>
        </section>
      </article>
    </main>
  );
}
