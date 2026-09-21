import { DEFAULT_LOCALE, type Calendar, type DatePrecision, type Locale } from '../types';

export interface HistDate {
  year: number;
  month?: number;
  day?: number;
}

const MONTHS: Record<Locale, readonly string[]> = {
  fr: [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  de: [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ],
  es: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  ru: [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ],
};

const RUSSIAN_MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];
const BCE_LABELS: Record<Locale, string> = {
  en: 'BCE',
  fr: 'av. J.-C.',
  de: 'v. Chr.',
  es: 'a. C.',
  zh: '公元前',
  ru: 'до н. э.',
};
const APPROXIMATE_LABELS: Record<Locale, string> = {
  en: 'c. ',
  fr: 'vers ',
  de: 'ca. ',
  es: 'c. ',
  zh: '约',
  ru: 'ок. ',
};
const CALENDAR_LABELS: Record<Locale, Record<Calendar, string>> = {
  fr: { julian: 'julien', gregorian: 'grégorien', unknown: 'calendrier non précisé' },
  en: { julian: 'Julian', gregorian: 'Gregorian', unknown: 'calendar unspecified' },
  de: { julian: 'julianisch', gregorian: 'gregorianisch', unknown: 'Kalender nicht angegeben' },
  es: { julian: 'juliano', gregorian: 'gregoriano', unknown: 'calendario no especificado' },
  zh: { julian: '儒略历', gregorian: '格里高利历', unknown: '历法未注明' },
  ru: { julian: 'юлианский', gregorian: 'григорианский', unknown: 'календарь не указан' },
};

function withEra(text: string, year: number, locale: Locale): string {
  if (year > 0) return text;
  return locale === 'zh' ? `${BCE_LABELS.zh}${text}` : `${text} ${BCE_LABELS[locale]}`;
}

function romanNumeral(value: number): string {
  // Very large source years remain readable without allocating enormous Roman strings.
  if (value > 3999) return String(value);
  let remaining = value;
  let text = '';
  for (const [number, numeral] of [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ] as const) {
    while (remaining >= number) {
      text += numeral;
      remaining -= number;
    }
  }
  return text;
}

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
  return (
    date.day === undefined ||
    (Number.isInteger(date.day) &&
      date.day >= 1 &&
      date.day <= daysInMonth(date.year, date.month, calendar))
  );
}

/** Missing components compare as the beginning of their known interval. */
export function compareHistDates(a: HistDate, b: HistDate): number {
  return Math.sign(
    a.year - b.year || (a.month ?? 1) - (b.month ?? 1) || (a.day ?? 1) - (b.day ?? 1),
  );
}

/** Bounds preserve uncertainty: an end known only to its year can be as late as December 31. */
export function histDateBounds(
  date: HistDate,
  calendar: Calendar = 'unknown',
): { earliest: HistDate; latest: HistDate } {
  const firstMonth = date.month ?? 1;
  const lastMonth = date.month ?? 12;
  return {
    earliest: { year: date.year, month: firstMonth, day: date.day ?? 1 },
    latest: {
      year: date.year,
      month: lastMonth,
      day: date.day ?? daysInMonth(date.year, lastMonth, calendar),
    },
  };
}

export function isChronologicallyPossible(
  start: HistDate,
  end: HistDate,
  calendar: Calendar = 'unknown',
): boolean {
  return (
    compareHistDates(
      histDateBounds(start, calendar).earliest,
      histDateBounds(end, calendar).latest,
    ) <= 0
  );
}

/** No calendar conversion is implied: this is an ordering coordinate for a timeline. */
export function histDateToScalar(date: HistDate): number {
  return date.year + ((date.month ?? 1) - 1) / 12 + ((date.day ?? 1) - 1) / 372;
}

export function formatYear(year: number, locale: Locale = DEFAULT_LOCALE): string {
  const integer = Math.round(year);
  const text = `${integer <= 0 ? 1 - integer : integer}${locale === 'zh' ? '年' : ''}`;
  return withEra(text, integer, locale);
}

export interface FormatHistDateOptions {
  precision?: DatePrecision;
  approximate?: boolean;
  calendar?: Calendar;
  showCalendar?: boolean;
}

export function formatHistDate(
  date: HistDate,
  locale: Locale = DEFAULT_LOCALE,
  options: FormatHistDateOptions | DatePrecision = {},
): string {
  const opts = typeof options === 'string' ? { precision: options } : options;
  const precision =
    opts.precision ??
    (date.day !== undefined ? 'day' : date.month !== undefined ? 'month' : 'year');
  let text = formatYear(date.year, locale);
  if (precision === 'century') {
    const number = Math.ceil((date.year <= 0 ? 1 - date.year : date.year) / 100);
    const englishOrdinal = `${number}${number % 100 >= 11 && number % 100 <= 13 ? 'th' : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[number % 10] ?? 'th')}`;
    const centuries: Record<Locale, string> = {
      en: `${englishOrdinal} century`,
      fr: `${number}${number === 1 ? 'er' : 'e'} siècle`,
      de: `${number}. Jahrhundert`,
      es: `siglo ${romanNumeral(number)}`,
      zh: `${number}世纪`,
      ru: `${romanNumeral(number)} век`,
    };
    text = withEra(centuries[locale], date.year, locale);
  } else if (precision === 'decade') {
    const historicalYear = date.year <= 0 ? 1 - date.year : date.year;
    const decade = Math.floor(historicalYear / 10) * 10;
    const decades: Record<Locale, string> = {
      en: `${decade}s`,
      fr: `années ${decade}`,
      de: `${decade}er-Jahre`,
      es: `década de ${decade}`,
      zh: `${decade}年代`,
      ru: `${decade}-е годы`,
    };
    text = withEra(decades[locale], date.year, locale);
  } else if (date.month !== undefined && (precision === 'month' || precision === 'day')) {
    const day = precision === 'day' ? date.day : undefined;
    const month =
      locale === 'ru' && day === undefined
        ? RUSSIAN_MONTHS[date.month - 1]
        : MONTHS[locale][date.month - 1];
    if (locale === 'zh') text = `${text}${month}${day === undefined ? '' : `${day}日`}`;
    else if (locale === 'es') text = `${day === undefined ? '' : `${day} de `}${month} de ${text}`;
    else
      text = `${day === undefined ? '' : `${day}${locale === 'de' ? '.' : ''} `}${month} ${text}`;
  }
  if (opts.approximate) text = `${APPROXIMATE_LABELS[locale]}${text}`;
  if (opts.showCalendar && opts.calendar) {
    text += ` (${CALENDAR_LABELS[locale][opts.calendar]})`;
  }
  return text;
}

export function formatDateRange(
  start: HistDate,
  end: HistDate | undefined,
  locale: Locale = DEFAULT_LOCALE,
  options: FormatHistDateOptions | DatePrecision = {},
): string {
  const first = formatHistDate(start, locale, options);
  return end && compareHistDates(start, end) !== 0
    ? `${first} — ${formatHistDate(end, locale, options)}`
    : first;
}

/** Signed plain integers are astronomical; an explicit BCE suffix uses historical numbering. */
export function parseHistoricalYear(input: string): number | null {
  const value = input.trim();
  if (/^[+-]?\d+$/.test(value)) {
    const year = Number(value);
    return Number.isSafeInteger(year) ? year : null;
  }
  const bce =
    /^(\d+)\s*(?:BCE?|av\.?\s*J\.?\s*-?\s*C\.?|v\.?\s*Chr\.?|a\.?\s*C\.?|до\s*н\.?\s*э\.?)$/i.exec(
      value,
    ) ?? /^公元前\s*(\d+)\s*年?$/.exec(value);
  if (bce) {
    const year = Number(bce[1]);
    return Number.isSafeInteger(year) && year > 0 ? 1 - year : null;
  }
  const ce =
    /^(\d+)\s*(?:CE|AD|ap\.?\s*J\.?\s*-?\s*C\.?|n\.?\s*Chr\.?|d\.?\s*C\.?|н\.?\s*э\.?)$/i.exec(
      value,
    ) ?? /^(?:公元\s*)?(\d+)\s*年$/.exec(value);
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
export function parseWikidataDate(
  value: string,
  precision = 9,
  encoding: 'rdf' | 'json' = 'rdf',
  calendar: Calendar = 'unknown',
): HistDate {
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

export function parseWikidataTime(
  value: string,
  options: { precision?: number; encoding?: 'rdf' | 'json'; calendar?: string } = {},
): { date: HistDate; datePrecision: DatePrecision; calendar: Calendar } {
  const precision = options.precision ?? 9;
  if (!Number.isInteger(precision) || precision < 7 || precision > 14)
    throw new Error(`Unsupported Wikidata precision: ${precision}`);
  const calendar = calendarFromWikidata(options.calendar);
  const date = parseWikidataDate(value, precision, options.encoding ?? 'rdf', calendar);
  const datePrecision: DatePrecision =
    date.day !== undefined
      ? 'day'
      : date.month !== undefined
        ? 'month'
        : precision <= 7
          ? 'century'
          : precision === 8
            ? 'decade'
            : 'year';
  return { date, datePrecision, calendar };
}
