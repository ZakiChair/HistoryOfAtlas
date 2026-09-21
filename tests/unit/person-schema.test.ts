import { describe, expect, it } from 'vitest';
import * as schema from '../../lib/schema';

// Structural fixtures only; these assertions never enter the historical corpus.
const sources = [{ label: 'Structural source', url: 'https://example.org/source' }];
const date = {
  date: { year: 0 },
  precision: 'year',
  calendar: 'unknown',
  statementId: 'Q10$example',
  property: 'P580',
  sourceEntityId: 'Q10',
  sources,
};
const person = {
  id: 'Q10',
  name: { en: 'Structural person' },
  birth: [date, { ...date, date: { year: 1 } }],
  tenures: [],
  events: [],
  sources,
};

describe('sourced people contracts', () => {
  it('requires named and sourced leaders in a polity catalog', () => {
    expect(schema).toHaveProperty('PolityLeadersSchema');
    expect(schema.PolityLeadersSchema.safeParse({ polityId: 'Q10', leaders: [] }).success).toBe(
      true,
    );
    expect(schema.PolityLeadersSchema.safeParse({ polityId: 'invalid', leaders: [] }).success).toBe(
      false,
    );
  });
  it('retains competing source dates instead of silently selecting one', () => {
    expect(schema).toHaveProperty('PersonSchema');
    const parsed = schema.PersonSchema.parse(person);
    expect(parsed.birth).toHaveLength(2);
    expect(parsed.birth?.map((item) => item.date.year)).toEqual([0, 1]);
  });

  it('requires provenance for the person and each date statement', () => {
    expect(schema).toHaveProperty('PersonSchema');
    expect(schema.PersonSchema.safeParse({ ...person, sources: [] }).success).toBe(false);
    expect(
      schema.PersonSchema.safeParse({ ...person, birth: [{ ...date, sources: [] }] }).success,
    ).toBe(false);
  });

  it('validates date precision and the source calendar', () => {
    expect(schema).toHaveProperty('SourcedDateSchema');
    expect(schema.SourcedDateSchema.safeParse({ ...date, precision: 'day' }).success).toBe(false);
    expect(
      schema.SourcedDateSchema.safeParse({
        ...date,
        date: { year: 1900, month: 2, day: 29 },
        calendar: 'julian',
        precision: 'day',
      }).success,
    ).toBe(true);
    expect(
      schema.SourcedDateSchema.safeParse({
        ...date,
        date: { year: 1900, month: 2, day: 29 },
        calendar: 'gregorian',
        precision: 'day',
      }).success,
    ).toBe(false);
  });

  it('preserves source-qualified approximation instead of stripping its warning', () => {
    expect(schema.SourcedDateSchema.parse({ ...date, approximate: true }).approximate).toBe(true);
    expect(schema.SourcedDateSchema.safeParse({ ...date, approximate: 'circa' }).success).toBe(
      false,
    );
  });

  it('requires political and personal statements to identify the corresponding subject and role', () => {
    const tenure = {
      id: 'Q20$head',
      personId: 'Q10',
      name: person.name,
      polity: { id: 'Q20', name: { en: 'Structural polity' } },
      role: 'head-of-state',
      property: 'P35',
      statementId: 'Q20$head',
      sourceEntityId: 'Q20',
      sources,
    };
    expect(schema.PersonTenureSchema.safeParse(tenure).success).toBe(true);
    expect(schema.PersonTenureSchema.safeParse({ ...tenure, sourceEntityId: 'Q30' }).success).toBe(
      false,
    );
    expect(
      schema.PersonTenureSchema.safeParse({ ...tenure, role: 'head-of-government' }).success,
    ).toBe(false);
    expect(schema.PersonTenureSchema.safeParse({ ...tenure, property: 'P6' }).success).toBe(false);
    expect(
      schema.PersonTenureSchema.safeParse({ ...tenure, property: 'P6', role: 'head-of-government' })
        .success,
    ).toBe(true);
    const office = {
      ...tenure,
      property: 'P39',
      role: 'office-holder',
      sourceEntityId: 'Q10',
      office: { id: 'Q40', name: { en: 'Structural office' } },
    };
    expect(schema.PersonTenureSchema.safeParse(office).success).toBe(true);
    expect(schema.PersonTenureSchema.safeParse({ ...office, office: undefined }).success).toBe(
      false,
    );
    expect(schema.PersonTenureSchema.safeParse({ ...office, sourceEntityId: 'Q20' }).success).toBe(
      false,
    );
  });

  it('preserves separate mandates and alternative tenure bounds with their sources', () => {
    expect(schema).toHaveProperty('PersonSchema');
    const tenure = {
      id: 'Q10$office',
      personId: 'Q10',
      name: person.name,
      office: { id: 'Q20', name: { en: 'Structural office' } },
      role: 'office-holder',
      start: [date, { ...date, date: { year: 1 } }],
      end: [{ ...date, date: { year: 2 }, property: 'P582' }],
      statementId: 'Q10$office',
      property: 'P39',
      sourceEntityId: 'Q10',
      sources,
    };
    const parsed = schema.PersonSchema.parse({
      ...person,
      tenures: [
        tenure,
        { ...tenure, id: 'Q10$second', start: [{ ...date, date: { year: 10 } }], end: [] },
      ],
    });
    expect(parsed.tenures).toHaveLength(2);
    expect(parsed.tenures[0].start).toHaveLength(2);
  });

  it('does not relabel bare participation as military command', () => {
    expect(schema).toHaveProperty('EventPersonLinkSchema');
    const link = {
      personId: 'Q10',
      name: person.name,
      role: 'participant',
      statementId: 'Q20$relation',
      property: 'P710',
      sourceEntityId: 'Q20',
      sources,
    };
    expect(schema.EventPersonLinkSchema.safeParse(link).success).toBe(true);
    expect(schema.EventPersonLinkSchema.safeParse({ ...link, role: 'commander' }).success).toBe(
      false,
    );
    expect(
      schema.EventPersonLinkSchema.safeParse({
        ...link,
        role: 'commander',
        property: 'P4791',
        participantId: 'Q30',
      }).success,
    ).toBe(true);
  });
});
