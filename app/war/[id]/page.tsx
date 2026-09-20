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
  if (!war) return { title: 'Conflit introuvable — Atlas Belli' };
  const name = war.name.fr ?? war.name.en;
  const description = `${name} : ${war.count} événements documentés, leur chronologie et leurs sources dans Atlas Belli.`;
  return {
    title: `${name} — Atlas Belli`,
    description,
    alternates: { canonical: `/war/${id}/` },
    openGraph: { title: name, description, type: 'article', images: ['/opengraph-image'] },
  };
}

export default async function WarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const war = (await readWars()).find((item) => item.id === id);
  if (!war) notFound();
  const events = JSON.parse(
    await readFile(path.join(root, 'wars', `${war.id}.json`), 'utf8'),
  ) as HistoricalEvent[];
  const name = war.name.fr ?? war.name.en;
  return (
    <main className="document-page">
      <header className="document-header">
        <Link className="back-link" href="/">
          ← Revenir à l’atlas
        </Link>
        <span className="eyebrow">CONFLITS & CHRONOLOGIES · {war.id}</span>
        <h1>{name}</h1>
        <p>
          {war.count} événement{war.count > 1 ? 's' : ''} documenté{war.count > 1 ? 's' : ''} dans
          ce relevé
        </p>
        <Link
          className="primary-button"
          href={`/?war=${war.id}&y=${war.start.year}&from=${war.start.year}&to=${war.end?.year ?? war.start.year}&projection=mercator`}
        >
          Explorer cette chronologie ↗
        </Link>
      </header>
      <article className="document-body">
        <section>
          <h2>Les événements liés</h2>
          <p>
            Les liens chronologiques ci-dessous viennent des relations « partie de » et « comprend »
            de Wikidata. Cette sélection couvre {formatDateRange(war.start, war.end, 'fr')}, sans
            prétendre couvrir toute la durée du conflit ni reconstituer les mouvements d’une armée.
          </p>
          <ol className="war-event-list">
            {events.map((event) => (
              <li key={event.id}>
                <span className="eyebrow">
                  {formatDateRange(event.start, event.end, 'fr', event.datePrecision)}
                </span>
                <h3>
                  <Link
                    href={`/?e=${event.id}&war=${war.id}&y=${event.start.year}${event.coords ? `&lon=${event.coords[0]}&lat=${event.coords[1]}&z=5` : ''}`}
                  >
                    {event.name.fr ?? event.name.en} ↗
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
          <h2>Provenance et limites</h2>
          <p>
            L’absence d’un événement ne signifie pas qu’il n’a pas eu lieu. Les dates, participants
            et lieux disponibles dépendent de la couverture des sources ouvertes.
          </p>
          <a className="source-link" href={war.source} target="_blank" rel="noreferrer">
            Wikidata · {war.id} ↗
          </a>
          <Link className="source-link" href="/about/">
            Lire la méthodologie →
          </Link>
        </section>
      </article>
    </main>
  );
}
