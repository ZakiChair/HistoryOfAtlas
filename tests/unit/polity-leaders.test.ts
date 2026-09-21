import { describe, expect, it } from 'vitest';
import { parsePolityLeaders, tenureAtYear } from '../../lib/polity-leaders';
import type { SourcedDate } from '../../lib/schema';

// Synthetic date statements exercise temporal classification, not historical assertions.
const date = (year: number, precision: SourcedDate['precision'] = 'year'): SourcedDate => ({
  date: { year },
  precision,
  calendar: 'unknown',
  property: 'P580',
  statementId: 'synthetic-date',
  sourceEntityId: 'Q1',
  sources: [{ label: 'Synthetic unit-test evidence', url: 'https://www.wikidata.org/wiki/Q1' }],
});

describe('political office identity joins', () => {
  const tenure = {
    id: 'synthetic-tenure',
    personId: 'Q1',
    name: { en: 'Synthetic person' },
    polity: { id: 'Q2', name: { en: 'Synthetic polity' } },
    role: 'head-of-state',
    property: 'P35',
    statementId: 'synthetic-statement',
    sourceEntityId: 'Q2',
    sources: [{ label: 'Synthetic evidence', url: 'https://www.wikidata.org/wiki/Q2' }],
  };

  it('requires the wrapper and every office relation to identify the reviewed polity', () => {
    expect(parsePolityLeaders({ polityId: 'Q2', leaders: [tenure] }, 'Q2').leaders).toHaveLength(1);
    expect(() => parsePolityLeaders({ polityId: 'Q2', leaders: [tenure] }, 'Q3')).toThrow();
    expect(() => parsePolityLeaders({ polityId: 'Q3', leaders: [tenure] }, 'Q3')).toThrow();
    expect(() =>
      parsePolityLeaders(
        {
          polityId: 'Q2',
          leaders: [
            {
              ...tenure,
              polity: undefined,
              office: { id: 'Q4', name: { en: 'Synthetic office' } },
            },
          ],
        },
        'Q2',
      ),
    ).toThrow();
  });
});

describe('sourced political periods on an annual timeline', () => {
  it('includes both documented endpoint years, including astronomical year zero', () => {
    const tenure = { start: [date(-2)], end: [date(0)] };
    expect(tenureAtYear(tenure, -3)).toBe('outside');
    expect(tenureAtYear(tenure, -2)).toBe('documented');
    expect(tenureAtYear(tenure, 0)).toBe('documented');
    expect(tenureAtYear(tenure, 1)).toBe('outside');
  });

  it('does not stretch a missing endpoint across all later or earlier history', () => {
    expect(tenureAtYear({ start: [date(1800)] }, 2000)).toBe('uncertain');
    expect(tenureAtYear({ end: [date(1850)] }, 1000)).toBe('uncertain');
    expect(tenureAtYear({}, 1800)).toBe('uncertain');
  });

  it('keeps conflicting and coarse dates out of the confidently dated annual list', () => {
    expect(tenureAtYear({ start: [date(1800), date(1810)], end: [date(1850)] }, 1820)).toBe(
      'uncertain',
    );
    expect(tenureAtYear({ start: [date(1800, 'century')], end: [date(1850)] }, 1810)).toBe(
      'uncertain',
    );
    expect(tenureAtYear({ start: [date(1800)], end: [date(1850, 'decade')] }, 1855)).toBe(
      'uncertain',
    );
    expect(tenureAtYear({ start: [date(1900)], end: [date(1800)] }, 1850)).toBe('uncertain');
  });

  it('preserves agreement when identical endpoints have independent evidence', () => {
    const first = date(1800);
    const corroborating = { ...first, statementId: 'another-source' };
    expect(tenureAtYear({ start: [first, corroborating], end: [date(1801)] }, 1800)).toBe(
      'documented',
    );
  });

  it('does not promote approximate endpoints or conflicting calendar evidence to definite periods', () => {
    const approximate = { ...date(1800), approximate: true };
    expect(tenureAtYear({ start: [approximate], end: [date(1810)] }, 1805)).toBe('uncertain');
    expect(tenureAtYear({ start: [date(1800), approximate], end: [date(1810)] }, 1805)).toBe(
      'uncertain',
    );
    expect(
      tenureAtYear({ start: [date(1800)], end: [{ ...date(1810), approximate: true }] }, 1805),
    ).toBe('uncertain');
    expect(
      tenureAtYear(
        {
          start: [
            { ...date(1800), calendar: 'julian' },
            { ...date(1800), calendar: 'gregorian' },
          ],
          end: [date(1810)],
        },
        1805,
      ),
    ).toBe('uncertain');
  });
});
