/**
 * Schema.org structured data for the static archive pages.
 * Server-only by convention: import it from app/ pages, never from client components.
 */
import type { HistDate } from '@/lib/histdate';
import type { LicenseDataset } from '@/lib/licenses';
import type { HistoricalEvent } from '@/lib/schema';
import type { Calendar, DatePrecision } from '@/lib/types';
import { commonsImageUrl, CRAWL_DISALLOW } from '@/lib/seo';

type JsonLdValue = string | number | boolean | null | JsonLdObject | JsonLdValue[] | undefined;
export interface JsonLdObject {
  [key: string]: JsonLdValue;
}

/** ISO 8601 year: four digits, or the expanded signed form for astronomical years ≤ 0. */
export function isoYear(year: number): string {
  if (!Number.isSafeInteger(year)) throw new RangeError(`Invalid year: ${year}`);
  if (year < 0) return `-${String(-year).padStart(4, '0')}`;
  if (year > 9999) return `+${year}`;
  return String(year).padStart(4, '0');
}

function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

/** Proleptic Julian calendar date → proleptic Gregorian date, through the Julian Day Number. */
export function julianToGregorian(date: Required<HistDate>): Required<HistDate> {
  const a = floorDiv(14 - date.month, 12);
  const y = date.year + 4800 - a;
  const m = date.month + 12 * a - 3;
  const jdn = date.day + floorDiv(153 * m + 2, 5) + 365 * y + floorDiv(y, 4) - 32083;
  const b = jdn + 32044;
  const century = floorDiv(4 * b + 3, 146097);
  const c = b - floorDiv(146097 * century, 4);
  const d = floorDiv(4 * c + 3, 1461);
  const e = c - floorDiv(1461 * d, 4);
  const month = floorDiv(5 * e + 2, 153);
  return {
    year: 100 * century + d - 4800 + floorDiv(month, 10),
    month: month + 3 - 12 * floorDiv(month, 10),
    day: e - floorDiv(153 * month + 2, 5) + 1,
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Which end of a decade or century a date stands for. */
export type PeriodEdge = 'start' | 'end';

/**
 * First or last astronomical year of the decade or century containing `year`, counted in
 * historical years the way the pages display them (the 1790s, the 4th century BCE).
 */
export function periodEdge(
  year: number,
  precision: 'decade' | 'century',
  edge: PeriodEdge,
): number {
  const bce = year <= 0;
  const historical = bce ? 1 - year : year;
  const [first, last] =
    precision === 'century'
      ? [(Math.ceil(historical / 100) - 1) * 100 + 1, Math.ceil(historical / 100) * 100]
      : // Years 1–9 form the "0s" decade: there is no historical year 0 on either side.
        [Math.max(1, Math.floor(historical / 10) * 10), Math.floor(historical / 10) * 10 + 9];
  if (!bce) return edge === 'start' ? first : last;
  // BCE: the later historical year is the earlier astronomical one.
  return edge === 'start' ? 1 - last : 1 - first;
}

interface IsoParts {
  year: number;
  month?: number;
  day?: number;
}

function isoParts(
  date: HistDate,
  precision: DatePrecision,
  calendar: Calendar | undefined,
  edge: PeriodEdge,
): IsoParts {
  if (precision === 'decade' || precision === 'century')
    return { year: periodEdge(date.year, precision, edge) };
  if (precision === 'day' && date.month !== undefined && date.day !== undefined) {
    if (calendar === 'julian')
      return julianToGregorian({ year: date.year, month: date.month, day: date.day });
    if (calendar === 'gregorian') return { year: date.year, month: date.month, day: date.day };
  }
  if (
    (precision === 'day' || precision === 'month') &&
    date.month !== undefined &&
    calendar === 'gregorian'
  )
    return { year: date.year, month: date.month };
  return { year: date.year };
}

const formatIso = ({ year, month, day }: IsoParts) =>
  `${isoYear(year)}${month === undefined ? '' : `-${pad(month)}`}${day === undefined ? '' : `-${pad(day)}`}`;

/** Orders two values by their first day, which is how date parsers read a reduced-precision value. */
const compareFirstDays = (a: IsoParts, b: IsoParts) =>
  a.year - b.year || (a.month ?? 1) - (b.month ?? 1) || (a.day ?? 1) - (b.day ?? 1);

/**
 * ISO 8601 date truncated to the known precision. ISO dates are proleptic Gregorian, so a
 * Julian day is converted; a Julian month, an unknown or an undeclared calendar keeps only the
 * year, since converting it would claim a precision the source does not have. A decade or a
 * century has no ISO date value that parsers accept, so it becomes the first (`edge: 'start'`)
 * or last (`edge: 'end'`) year of that period, never the single year stored in the record.
 */
export function isoDate(
  date: HistDate,
  precision: DatePrecision,
  calendar?: Calendar,
  edge: PeriodEdge = 'start',
): string {
  return formatIso(isoParts(date, precision, calendar, edge));
}

/**
 * schema.org start and end dates for a record. A decade or century record spans its whole
 * period, even without an end. A reduced-precision end is read as the first day of its year or
 * month, so an end that would sort before the start (the start's own year once a Julian day
 * is converted, for example) is left out rather than published as a negative duration.
 */
export function eventDates(
  event: Pick<EventLike, 'start' | 'end' | 'datePrecision' | 'calendar'>,
): { startDate: string; endDate?: string } {
  const { datePrecision: precision, calendar } = event;
  const start = isoParts(event.start, precision, calendar, 'start');
  const period = precision === 'decade' || precision === 'century';
  const endSource = event.end ?? (period ? event.start : undefined);
  const end = endSource ? isoParts(endSource, precision, calendar, 'end') : undefined;
  return {
    startDate: formatIso(start),
    ...(end && compareFirstDays(end, start) >= 0 ? { endDate: formatIso(end) } : {}),
  };
}

/**
 * Next.js guidance: escape `<` so record text can never close the script element. The two
 * JavaScript line terminators are escaped too, for consumers that evaluate the payload.
 */
export function serializeJsonLd(value: JsonLdObject): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export const wikidataUrl = (id: string) => `https://www.wikidata.org/wiki/${id}`;

export interface BreadcrumbItem {
  name: string;
  /** Path relative to the origin, e.g. `/war/Q123/`. */
  path: string;
}

export function breadcrumbJsonLd(origin: string, items: BreadcrumbItem[]): JsonLdObject {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${origin}${item.path}`,
    })),
  };
}

export type EventLike = Pick<
  HistoricalEvent,
  | 'id'
  | 'name'
  | 'start'
  | 'end'
  | 'datePrecision'
  | 'calendar'
  | 'coords'
  | 'place'
  | 'image'
  | 'wikipedia'
  | 'summary'
  | 'description'
>;

export interface EventReference {
  id: string;
  name: string;
  /** Archive page path, when the record has one. */
  path?: string;
}

export interface EventJsonLdOptions {
  origin: string;
  /** Path of the page describing this record. */
  path: string;
  /** Parent conflict, linked to its own archive page when it has one. */
  superEvent?: EventReference;
  /** Child records, e.g. the events listed on a war page. */
  subEvents?: EventReference[];
}

function eventReference(origin: string, reference: EventReference): JsonLdObject {
  return {
    '@type': 'Event',
    name: reference.name,
    ...(reference.path ? { url: `${origin}${reference.path}` } : {}),
    sameAs: wikidataUrl(reference.id),
  };
}

export function eventJsonLd(event: EventLike, options: EventJsonLdOptions): JsonLdObject {
  const { origin } = options;
  const description =
    event.summary?.en ?? event.description?.en ?? event.summary?.fr ?? event.description?.fr;
  const sameAs = [
    wikidataUrl(event.id),
    ...Object.values(event.wikipedia ?? {}).filter((url): url is string => Boolean(url)),
  ];
  const location: JsonLdObject | undefined =
    event.coords || event.place?.name
      ? {
          '@type': 'Place',
          ...(event.place?.name ? { name: event.place.name } : {}),
          ...(event.place?.id ? { sameAs: wikidataUrl(event.place.id) } : {}),
          ...(event.coords
            ? {
                geo: {
                  '@type': 'GeoCoordinates',
                  latitude: event.coords[1],
                  longitude: event.coords[0],
                },
              }
            : {}),
        }
      : undefined;
  const image = commonsImageUrl(event.image);
  return {
    '@type': 'Event',
    '@id': `${origin}${options.path}#event`,
    name: event.name.en,
    url: `${origin}${options.path}`,
    identifier: event.id,
    ...(description ? { description } : {}),
    ...eventDates(event),
    ...(location ? { location } : {}),
    ...(image ? { image } : {}),
    sameAs,
    ...(options.superEvent ? { superEvent: eventReference(origin, options.superEvent) } : {}),
    ...(options.subEvents?.length
      ? { subEvent: options.subEvents.map((item) => eventReference(origin, item)) }
      : {}),
  };
}

/** A single `<script>` payload: several nodes share one context. */
export function jsonLdGraph(...nodes: JsonLdObject[]): JsonLdObject {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

export interface DatasetPart {
  name: string;
  description: string;
  url: string;
  license?: string;
}

export interface DatasetJsonLdOptions {
  origin: string;
  path: string;
  name: string;
  description: string;
  dateModified: string;
  /** Astronomical years; rendered as an ISO 8601 interval. */
  temporalCoverage: [number, number];
  keywords: string[];
  parts: DatasetPart[];
  repository: string;
}

/** Sources shown or cited on demand rather than published as data (typefaces are skipped too). */
const NOT_DATA_SOURCES = new Set(['wikipedia', 'wikimedia-commons']);

/** Canonical public licence texts, preferred to the copies the site ships beside the data. */
const PUBLIC_LICENSE_TEXTS: Record<string, string> = {
  'GPL-3.0-only': 'https://www.gnu.org/licenses/gpl-3.0.html',
};

/**
 * Dataset parts for the upstream data sources in the licence manifest, one per source.
 * Typefaces and Wikipedia or Commons content are not parts of the dataset. A manifest entry
 * whose URL is its licence page describes a use of a source (Natural Earth as a validation
 * mask), so it is folded into that source's own part.
 */
export function licenseDatasetParts(datasets: LicenseDataset[], origin: string): DatasetPart[] {
  const parts = new Map<string, DatasetPart>();
  const isUse = (dataset: LicenseDataset) => dataset.url === dataset.licenseUrl;
  // Sources first, so a folded use adds to the source's own description.
  const ordered = [...datasets.filter((d) => !isUse(d)), ...datasets.filter(isUse)];
  for (const dataset of ordered) {
    if (dataset.id.startsWith('font-') || NOT_DATA_SOURCES.has(dataset.id)) continue;
    const use = isUse(dataset);
    const url = use ? `${new URL(dataset.url).origin}/` : dataset.url;
    const name = (use ? dataset.name.split(' · ')[0]! : dataset.name)
      // The geography pipeline labels Historical Basemaps in French; this data is English.
      .replace(/ et contributeurs$/, ' and contributors');
    const license =
      PUBLIC_LICENSE_TEXTS[dataset.license] ??
      (dataset.licenseUrl?.startsWith('/') ? `${origin}${dataset.licenseUrl}` : dataset.licenseUrl);
    const existing = parts.get(url);
    if (existing) {
      existing.description = `${existing.description}. ${dataset.scope}`;
      if (!existing.license && license) existing.license = license;
      continue;
    }
    parts.set(url, { name, description: dataset.scope, url, ...(license ? { license } : {}) });
  }
  return [...parts.values()];
}

/**
 * The atlas combines sources under different licences, so no single licence is declared:
 * each source is a part with its own terms. Raw files under /data/ are not advertised as
 * distributions, and no part links a licence copy under such a path, because robots.txt keeps
 * them out of search indexes.
 */
export function datasetJsonLd(options: DatasetJsonLdOptions): JsonLdObject {
  const crawlable = (url: string) =>
    !CRAWL_DISALLOW.some((path) => url.startsWith(`${options.origin}${path}`));
  return {
    '@type': 'Dataset',
    '@id': `${options.origin}${options.path}#dataset`,
    name: options.name,
    description: options.description,
    url: `${options.origin}${options.path}`,
    sameAs: options.repository,
    isAccessibleForFree: true,
    dateModified: options.dateModified,
    temporalCoverage: `${isoYear(options.temporalCoverage[0])}/${isoYear(options.temporalCoverage[1])}`,
    spatialCoverage: { '@type': 'Place', name: 'World' },
    keywords: options.keywords,
    creator: { '@type': 'Organization', name: 'HistoryOfAtlas', url: `${options.origin}/` },
    // Upstream sources only: parts described on this site are listed under hasPart.
    isBasedOn: [
      ...new Set(
        options.parts
          .map((part) => part.url)
          .filter((url) => !url.startsWith(`${options.origin}/`)),
      ),
    ],
    hasPart: options.parts.map((part) => ({
      '@type': 'Dataset',
      name: part.name,
      description: part.description,
      url: part.url,
      ...(part.license && crawlable(part.license) ? { license: part.license } : {}),
    })),
  };
}
