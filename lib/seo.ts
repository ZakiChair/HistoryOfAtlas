import { formatYear } from '@/lib/histdate';
import type { HistoricalEvent } from '@/lib/schema';

type IndexableEvent = Pick<HistoricalEvent, 'id' | 'importance' | 'type'>;

/** Public repository where readers can file corrections. */
export const REPOSITORY_URL = 'https://github.com/ZakiChair/HistoryOfAtlas';

/** Raw data, tile and glyph paths kept out of search indexes by robots.txt. */
export const CRAWL_DISALLOW = ['/data/', '/geo/', '/glyphs/'];

/** Absolute origin used for canonical URLs, sitemaps and structured data. */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://historyofatlas.vercel.app').replace(
    /\/$/,
    '',
  );
}

/** Shared static-export eligibility; the browser need not load an editorial index. */
export function hasStaticEventPage(
  event: IndexableEvent,
  curatedIds?: ReadonlySet<string>,
): boolean {
  return (
    event.importance >= 60 ||
    Boolean(curatedIds?.has(event.id)) ||
    ['war', 'campaign', 'treaty'].includes(event.type)
  );
}

/** Opens the record in the interactive atlas at its year and, when known, its location. */
export function getEventMapUrl(event: Pick<HistoricalEvent, 'id' | 'start' | 'coords'>): string {
  const query = new URLSearchParams({ y: String(event.start.year), e: event.id });
  if (event.coords) {
    query.set('lon', String(event.coords[0]));
    query.set('lat', String(event.coords[1]));
    query.set('z', '5');
  }
  return `/?${query.toString()}`;
}

/** A person's dossier on its own, without the sharer's camera, layers or filters. */
export function getPersonMapUrl(id: string): string {
  return `/?${new URLSearchParams({ person: id }).toString()}`;
}

/**
 * Less prominent records still have a permanent, valid URL opening their map detail.
 * Pass the curated set at build time so links match the exported pages exactly.
 */
export function getEventPermalink(
  event: Pick<HistoricalEvent, 'id' | 'importance' | 'type' | 'start' | 'coords'>,
  curatedIds?: ReadonlySet<string>,
): string {
  if (hasStaticEventPage(event, curatedIds)) return `/event/${event.id}/`;
  return getEventMapUrl(event);
}

/** Wikimedia Commons FilePath URLs accept a width; previews need a larger rendition. */
export function commonsImageUrl(image: string | undefined, width = 1200): string | undefined {
  if (!image) return undefined;
  try {
    const url = new URL(image);
    if (url.hostname !== 'commons.wikimedia.org' || !url.pathname.includes('Special:FilePath'))
      return image;
    url.searchParams.set('width', String(width));
    return url.toString();
  } catch {
    return undefined;
  }
}

export interface ErrorReport {
  /** Displayed record name. */
  name: string;
  /** Wikidata QID, resource sourceId or other stable identifier. */
  id: string;
  /** Kind of record, in English for the maintainers' tracker. */
  kind: 'event' | 'war' | 'person' | 'resource' | 'religion' | 'territory';
  /** Year displayed when the reader noticed the problem (astronomical numbering). */
  year?: number;
  /** Absolute URL of the page or view that shows the problem. */
  url?: string;
}

/** A prefilled GitHub issue: readers only add what is wrong and a verifiable reference. */
export function errorReportUrl(report: ErrorReport): string {
  const isQid = /^Q[1-9]\d*$/.test(report.id);
  const identifier = isQid
    ? `[${report.id}](https://www.wikidata.org/wiki/${report.id})`
    : `\`${report.id}\``;
  const lines = [
    `**Record:** ${report.name} (${report.kind})`,
    `**Identifier:** ${identifier}`,
    ...(report.year === undefined
      ? []
      : [`**Displayed year:** ${formatYear(report.year, 'en')} (astronomical ${report.year})`]),
    ...(report.url ? [`**Link:** ${report.url}`] : []),
    '',
    '**What is wrong?**',
    '',
    '',
    '**Verifiable reference (link, publication, page):**',
    '',
    ...(isQid
      ? ['', '_Factual errors in a Wikidata statement can also be corrected at the source._']
      : []),
  ];
  const query = new URLSearchParams({
    title: `Correction: ${report.name} (${report.id})`,
    body: lines.join('\n'),
  });
  return `${REPOSITORY_URL}/issues/new?${query.toString()}`;
}
