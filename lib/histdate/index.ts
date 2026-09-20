import type { Calendar, DatePrecision, Locale } from '../types';

export interface HistDate { year: number; month?: number; day?: number }

const MONTHS: Record<Locale, readonly string[]> = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

export function isLeapYear(year: number, calendar: Calendar = 'gregorian'): boolean {
  return year % 4 === 0 && (calendar !== 'gregorian' || year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number, calendar: Calendar = 'unknown'): number {
  if (month === 2) return isLeapYear(year, calendar) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidHistDate(date: HistDate, calendar: Calendar = 'unknown'): boolean {
  if (!Number.isSafeInteger(date.year)) return false;
  if (date.month === undefined) return date.day === undefined;
  if (!Number.isInteger(date.month) || date.month < 1 || date.month > 12) return false;
  return date.day === undefined || (Number.isInteger(date.day) && date.day >= 1 && date.day <= daysInMonth(date.year, date.month, calendar));
}

/** Missing components compare as the beginning of their known interval. */
export function compareHistDates(a: HistDate, b: HistDate): number {
  return Math.sign(a.year - b.year || (a.month ?? 1) - (b.month ?? 1) || (a.day ?? 1) - (b.day ?? 1));
}

/** No calendar conversion is implied: this is an ordering coordinate for a timeline. */
export function histDateToScalar(date: HistDate): number {
  return date.year + ((date.month ?? 1) - 1) / 12 + ((date.day ?? 1) - 1) / 372;
}

export function formatYear(year: number, locale: Locale = 'fr'): string {
  const integer = Math.round(year);
  return integer <= 0 ? `${1 - integer} ${locale === 'fr' ? 'av. J.-C.' : 'BCE'}` : String(integer);
}

export interface FormatHistDateOptions {
  precision?: DatePrecision;
  approximate?: boolean;
  calendar?: Calendar;
  showCalendar?: boolean;
}

export function formatHistDate(date: HistDate, locale: Locale = 'fr', options: FormatHistDateOptions | DatePrecision = {}): string {
  const opts = typeof options === 'string' ? { precision: options } : options;
  const precision = opts.precision ?? (date.day !== undefined ? 'day' : date.month !== undefined ? 'month' : 'year');
  let text = formatYear(date.year, locale);
  if (precision === 'century') {
    const number = Math.ceil((date.year <= 0 ? 1 - date.year : date.year) / 100);
    const ordinal = locale === 'fr' ? `${number}${number === 1 ? 'er' : 'e'}` : `${number}${number % 100 >= 11 && number % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[number % 10] ?? 'th'}`;
    text = `${ordinal} ${locale === 'fr' ? 'siècle' : 'century'}${date.year <= 0 ? locale === 'fr' ? ' av. J.-C.' : ' BCE' : ''}`;
  } else if (precision === 'decade') {
    const historicalYear = date.year <= 0 ? 1 - date.year : date.year;
    const decade = Math.floor(historicalYear / 10) * 10;
    text = locale === 'fr' ? `années ${decade}` : `${decade}s`;
    if (date.year <= 0) text += locale === 'fr' ? ' av. J.-C.' : ' BCE';
  } else if (date.month !== undefined && (precision === 'month' || precision === 'day')) {
    text = `${MONTHS[locale][date.month - 1]} ${text}`;
    if (date.day !== undefined && precision === 'day') text = `${date.day} ${text}`;
  }
  if (opts.approximate) text = `${locale === 'fr' ? 'vers' : 'c.'} ${text}`;
  if (opts.showCalendar && opts.calendar) {
    const labels: Record<Locale, Record<Calendar, string>> = {
      fr: { julian: 'julien', gregorian: 'grégorien', unknown: 'calendrier non précisé' },
      en: { julian: 'Julian', gregorian: 'Gregorian', unknown: 'calendar unspecified' },
    };
    text += ` (${labels[locale][opts.calendar]})`;
  }
  return text;
}

export function formatDateRange(start: HistDate, end: HistDate | undefined, locale: Locale = 'fr', options: FormatHistDateOptions | DatePrecision = {}): string {
  const first = formatHistDate(start, locale, options);
  return end && compareHistDates(start, end) !== 0 ? `${first} — ${formatHistDate(end, locale, options)}` : first;
}

/** Signed plain integers are astronomical; an explicit BCE suffix uses historical numbering. */
export function parseHistoricalYear(input: string): number | null {
  const value = input.trim();
  if (/^[+-]?\d+$/.test(value)) {
    const year = Number(value);
    return Number.isSafeInteger(year) ? year : null;
  }
  const bce = /^(\d+)\s*(?:BCE?|av\.?\s*J\.?\s*-?\s*C\.?)$/i.exec(value);
  if (bce) {
    const year = Number(bce[1]);
    return Number.isSafeInteger(year) && year > 0 ? 1 - year : null;
  }
  const ce = /^(\d+)\s*(?:CE|AD|ap\.?\s*J\.?\s*-?\s*C\.?)$/i.exec(value);
  if (ce) {
    const year = Number(ce[1]);
    return Number.isSafeInteger(year) && year > 0 ? year : null;
  }
  return null;
}

export function calendarFromWikidata(value?: string): Calendar {
  if (value?.endsWith('Q1985786') || value === 'julian') return 'julian';
  if (value?.endsWith('Q1985727') || value === 'gregorian') return 'gregorian';
  return 'unknown';
}

/** WDQS/RDF is XSD 1.1 (astronomical); Wikibase JSON has no year zero.
 * Source: https://www.wikidata.org/wiki/Help:Dates#Years_BC
 */
export function parseWikidataDate(value: string, precision = 9, encoding: 'rdf' | 'json' = 'rdf', calendar: Calendar = 'unknown'): HistDate {
  const match = /^([+-]?\d{4,16})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.exec(value);
  if (!match) throw new Error(`Invalid Wikidata timestamp: ${value}`);
  const rawYear = Number(match[1]);
  const year = encoding === 'json' && rawYear < 0 ? rawYear + 1 : rawYear;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date: HistDate = { year };
  if (precision >= 10 && month !== 0) date.month = month;
  if (precision >= 11 && day !== 0) date.day = day;
  if (!isValidHistDate(date, calendar)) throw new Error(`Invalid historical date: ${value}`);
  return date;
}

export function parseWikidataTime(value: string, options: { precision?: number; encoding?: 'rdf' | 'json'; calendar?: string } = {}): { date: HistDate; datePrecision: DatePrecision; calendar: Calendar } {
  const precision = options.precision ?? 9;
  if (!Number.isInteger(precision) || precision < 7 || precision > 14) throw new Error(`Unsupported Wikidata precision: ${precision}`);
  const calendar = calendarFromWikidata(options.calendar);
  const date = parseWikidataDate(value, precision, options.encoding ?? 'rdf', calendar);
  const datePrecision: DatePrecision = date.day !== undefined ? 'day' : date.month !== undefined ? 'month' : precision <= 7 ? 'century' : precision === 8 ? 'decade' : 'year';
  return { date, datePrecision, calendar };
}
