import { describe, expect, it } from 'vitest';
import {
  compareHistDates,
  formatHistDate,
  formatYear,
  isValidHistDate,
  histDateBounds,
  parseHistoricalYear,
  parseWikidataDate,
  parseWikidataTime,
} from '../../lib/histdate';
import { classifyEra, positionToYear, yearToPosition } from '../../lib/eras';

describe('historical dates without native Date conversion', () => {
  it('keeps the astronomical zero at 1 BCE and crosses directly into 1 CE', () => {
    expect(formatYear(0, 'fr')).toBe('1 av. J.-C.');
    expect(formatYear(-330, 'fr')).toBe('331 av. J.-C.');
    expect(formatYear(-330, 'en')).toBe('331 BCE');
    expect(formatYear(1, 'en')).toBe('1');
    expect(compareHistDates({ year: 0, month: 12, day: 31 }, { year: 1 })).toBeLessThan(0);
  });

  it('distinguishes Wikidata JSON historical numbering from RDF astronomical numbering', () => {
    expect(parseWikidataDate('-0331-10-01T00:00:00Z', 11, 'json')).toEqual({
      year: -330,
      month: 10,
      day: 1,
    });
    expect(parseWikidataDate('-0330-10-01T00:00:00Z', 11, 'rdf')).toEqual({
      year: -330,
      month: 10,
      day: 1,
    });
    expect(parseWikidataDate('-0001-00-00T00:00:00Z', 9, 'json')).toEqual({ year: 0 });
    expect(parseWikidataDate('0000-01-01T00:00:00Z', 9, 'rdf')).toEqual({ year: 0 });
  });

  it('discards placeholder days when the source has only year precision', () => {
    expect(parseWikidataDate('+1812-01-01T00:00:00Z', 9)).toEqual({ year: 1812 });
    expect(parseWikidataDate('+1812-06-00T00:00:00Z', 10)).toEqual({ year: 1812, month: 6 });
    expect(() => parseWikidataDate('unknown', 9)).toThrow();
  });

  it('does not turn an uncertain millennium into a falsely precise century', () => {
    expect(() =>
      parseWikidataTime('-2000-00-00T00:00:00Z', { precision: 6, encoding: 'json' }),
    ).toThrow(/precision/i);
  });

  it('validates leap years against the declared calendar rather than an assumed modern calendar', () => {
    expect(isValidHistDate({ year: 1700, month: 2, day: 29 }, 'julian')).toBe(true);
    expect(isValidHistDate({ year: 1700, month: 2, day: 29 }, 'gregorian')).toBe(false);
    expect(isValidHistDate({ year: 2000, month: 2, day: 29 }, 'gregorian')).toBe(true);
    expect(isValidHistDate({ year: 1812, day: 2 })).toBe(false);
    expect(isValidHistDate({ year: 1812, month: 4, day: 31 })).toBe(false);
  });

  it('bounds partial dates without treating an unknown end day as the first of the month', () => {
    expect(histDateBounds({ year: 1700, month: 2 }, 'julian')).toEqual({
      earliest: { year: 1700, month: 2, day: 1 },
      latest: { year: 1700, month: 2, day: 29 },
    });
    expect(histDateBounds({ year: 1700, month: 2 }, 'gregorian')).toEqual({
      earliest: { year: 1700, month: 2, day: 1 },
      latest: { year: 1700, month: 2, day: 28 },
    });
    expect(histDateBounds({ year: 0 })).toEqual({
      earliest: { year: 0, month: 1, day: 1 },
      latest: { year: 0, month: 12, day: 31 },
    });
  });

  it('preserves calendar metadata and visibly formats approximation and calendar', () => {
    expect(
      parseWikidataTime('+1700-02-29T00:00:00Z', {
        precision: 11,
        encoding: 'json',
        calendar: 'http://www.wikidata.org/entity/Q1985786',
      }),
    ).toEqual({
      date: { year: 1700, month: 2, day: 29 },
      datePrecision: 'day',
      calendar: 'julian',
    });
    expect(formatHistDate({ year: -330 }, 'fr', { approximate: true })).toBe('vers 331 av. J.-C.');
    expect(
      formatHistDate({ year: 1812, month: 9, day: 7 }, 'en', {
        calendar: 'julian',
        showCalendar: true,
      }),
    ).toBe('7 September 1812 (Julian)');
  });

  it('accepts explicit BCE input while keeping signed URL years astronomical', () => {
    expect(parseHistoricalYear('331 av. J.-C.')).toBe(-330);
    expect(parseHistoricalYear('331 BCE')).toBe(-330);
    expect(parseHistoricalYear('-330')).toBe(-330);
    expect(parseHistoricalYear('0 BCE')).toBeNull();
    expect(parseHistoricalYear('1812cats')).toBeNull();
  });
});

describe('nonlinear timeline', () => {
  it('round trips ancient, boundary and recent years without discontinuities', () => {
    for (const year of [-3500, -330, 0, 476, 1492, 1800, 1900, 1945, 2001, 2026]) {
      expect(positionToYear(yearToPosition(year, 2026), 2026)).toBe(year);
    }
    expect(yearToPosition(2026, 2026)).toBe(1);
    expect(yearToPosition(-3500, 2026)).toBe(0);
    expect(yearToPosition(1950, 2026) - yearToPosition(1940, 2026)).toBeGreaterThan(
      yearToPosition(-2000, 2026) - yearToPosition(-2010, 2026),
    );
    expect(classifyEra(1812)).toBe('19th-century');
  });
});
