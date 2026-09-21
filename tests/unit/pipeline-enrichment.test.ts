import { describe, expect, it } from 'vitest';
import { buildPeople, compactEvent, sourceDescription } from '../../pipeline/normalize/enrichment';
import type { Entity } from '../../pipeline/normalize';
import type { HistoricalEvent } from '../../lib/schema';

const snak = (value: unknown) => ({ datavalue: { value } });
const claim = (
  id: string,
  value: unknown,
  qualifiers: Record<string, unknown> = {},
  rank = 'normal',
) => ({
  id,
  rank,
  mainsnak: snak(value),
  qualifiers,
});
const item = (id: string) => ({ id });
const date = (year: number) => ({
  time: `${year < 0 ? '-' : '+'}${String(Math.abs(year)).padStart(4, '0')}-00-00T00:00:00Z`,
  precision: 9,
  calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
});
const human = (id: string, claims = {}): Entity =>
  ({
    id,
    labels: { en: { value: `Source ${id}` } },
    claims: { P31: [claim(`${id}$human`, item('Q5'))], ...claims },
  }) as Entity;
const event = (): HistoricalEvent => ({
  id: 'Q100',
  type: 'battle',
  name: { en: 'Fixture event' },
  start: { year: 1800 },
  coords: [1, 1],
  belligerents: [],
  importance: 10,
  era: '19th-century',
  region: 'europe',
  sources: [{ label: 'Source', url: 'https://www.wikidata.org/wiki/Q100' }],
  datePrecision: 'year',
});

describe('source-faithful people enrichment', () => {
  it('preserves available Wikipedia articles in every additional interface language', () => {
    const names = {
      de: 'Deutscher Artikel',
      es: 'Artículo español',
      zh: '中文条目',
      ru: 'Русская статья',
    };
    const entities = new Map<string, Entity>([
      [
        'Q100',
        { id: 'Q100', claims: { P710: [claim('Q100$participant', item('Q1'))] } } as Entity,
      ],
      [
        'Q1',
        {
          ...human('Q1'),
          sitelinks: Object.fromEntries(
            Object.entries(names).map(([language, title]) => [`${language}wiki`, { title }]),
          ),
        },
      ],
    ]);
    const result = buildPeople([event()], entities, new Set());
    const expected = Object.fromEntries(
      Object.entries(names).map(([language, title]) => [
        language,
        `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`,
      ]),
    );
    expect(result.people[0]?.wikipedia).toEqual(expected);
    for (const url of Object.values(expected)) {
      expect(result.people[0]?.sources).toContainEqual({
        label: expect.stringMatching(/^Wikipedia \(/),
        url,
        license: 'CC-BY-SA-4.0',
      });
    }
  });

  it('keeps participation separate from command, reads side-qualified commanders, and excludes nonhumans', () => {
    const entities = new Map<string, Entity>([
      [
        'Q100',
        {
          id: 'Q100',
          claims: {
            P710: [
              claim('Q100$participant', item('Q1')),
              claim('Q100$side', item('Q9'), { P4791: [snak(item('Q2')), snak(item('Q3'))] }),
            ],
          },
        } as Entity,
      ],
      ['Q1', human('Q1')],
      ['Q2', human('Q2')],
      ['Q3', { id: 'Q3', claims: { P31: [claim('Q3$type', item('Q9'))] } } as Entity],
    ]);
    const input = event();
    const result = buildPeople([input], entities, new Set());
    expect(
      input.people?.map(({ personId, role, property, participantId }) => ({
        personId,
        role,
        property,
        participantId,
      })),
    ).toEqual([
      { personId: 'Q1', role: 'participant', property: 'P710', participantId: undefined },
      { personId: 'Q2', role: 'commander', property: 'P4791', participantId: 'Q9' },
    ]);
    expect(result.people.find((p) => p.id === 'Q2')?.events[0]).toMatchObject({
      eventId: 'Q100',
      statementId: 'Q100$side',
      sourceEntityId: 'Q100',
      role: 'commander',
    });
    expect(result.people.find((p) => p.id === 'Q2')?.events[0]?.name.en).toBe('Fixture event');
    expect(result.people.map((p) => p.id)).toEqual(['Q1', 'Q2']);
    expect(result.rejected.some((r) => r.reason === 'not-human' && r.personId === 'Q3')).toBe(true);
  });

  it('preserves old normal-rank tenures and every sourced date, without turning general office holders into heads of state', () => {
    const entities = new Map<string, Entity>([
      [
        'Q1',
        human('Q1', {
          P569: [claim('Q1$born', date(-2)), claim('Q1$born-other', date(-3))],
          P39: [
            claim('Q1$old', item('Q11'), { P580: [snak(date(1770))], P582: [snak(date(1780))] }),
            claim('Q1$new', item('Q12'), {}, 'preferred'),
          ],
        }),
      ],
      [
        'Q9',
        {
          id: 'Q9',
          labels: { en: { value: 'Source polity' } },
          claims: {
            P35: [
              claim('Q9$ruler', item('Q1'), { P580: [snak(date(1770))], P582: [snak(date(1780))] }),
            ],
          },
        } as Entity,
      ],
      [
        'Q11',
        {
          id: 'Q11',
          labels: { en: { value: 'Source office' } },
          claims: { P1001: [claim('Q11$jurisdiction', item('Q9'))] },
        } as Entity,
      ],
      ['Q12', { id: 'Q12', labels: { en: { value: 'Other office' } } }],
    ]);
    const result = buildPeople([], entities, new Set(['Q9']));
    const person = result.people[0]!;
    expect(person.birth?.map((b) => b.date.year)).toEqual([-1, -2]);
    expect(person.tenures.map((t) => t.statementId).sort()).toEqual([
      'Q1$new',
      'Q1$old',
      'Q9$ruler',
    ]);
    expect(person.tenures.find((t) => t.statementId === 'Q1$old')).toMatchObject({
      role: 'office-holder',
      polity: { id: 'Q9' },
      start: [{ date: { year: 1770 } }],
      end: [{ date: { year: 1780 } }],
    });
    expect(result.polities[0]?.leaders.map((t) => t.statementId)).toEqual(['Q9$ruler']);
  });

  it('indexes reverse participation only when its event is published and excludes impossible lifetime links', () => {
    const input = event();
    const entities = new Map<string, Entity>([
      [
        'Q9',
        {
          id: 'Q9',
          claims: { P35: [claim('Q9$ruler', item('Q1')), claim('Q9$late', item('Q2'))] },
        } as Entity,
      ],
      [
        'Q1',
        human('Q1', {
          P607: [claim('Q1$published', item('Q100')), claim('Q1$external', item('Q200'))],
        }),
      ],
      [
        'Q2',
        human('Q2', {
          P569: [claim('Q2$birth', date(1900))],
          P607: [claim('Q2$impossible', item('Q100'))],
        }),
      ],
    ]);
    const result = buildPeople([input], entities, new Set(['Q9']));
    expect(result.people.find((p) => p.id === 'Q1')?.events.map((e) => e.eventId)).toEqual([
      'Q100',
    ]);
    expect(input.people?.map((p) => p.personId)).toEqual(['Q1']);
    expect(result.rejected.some((r) => r.reason === 'event-before-person-birth')).toBe(true);
  });

  it('retains statement-level bibliographic references and strips dossier content from compact events', () => {
    const st = {
      ...claim('Q100$commander', item('Q1')),
      references: [{ snaks: { P854: [snak('https://example.org/source')] } }],
    };
    const entities = new Map<string, Entity>([
      ['Q100', { id: 'Q100', lastrevid: 12, claims: { P4791: [st] } } as Entity],
      ['Q1', human('Q1')],
    ]);
    const input = { ...event(), description: { en: 'Source description' } };
    buildPeople([input], entities, new Set());
    expect(input.people?.[0]?.sources).toEqual(
      expect.arrayContaining([
        { label: 'Wikidata reference URL', url: 'https://example.org/source' },
      ]),
    );
    expect(input.people?.[0]?.sources[0]?.url).toContain('oldid=12');
    expect(compactEvent(input)).not.toHaveProperty('people');
    expect(compactEvent(input)).not.toHaveProperty('description');
    expect(input.people).toHaveLength(1);
  });

  it('copies sourced descriptions as descriptions, without creating summaries or translating absent languages', () => {
    expect(sourceDescription({ id: 'Q1', descriptions: { en: { value: 'Source text' } } })).toEqual(
      { en: 'Source text' },
    );
    expect(sourceDescription({ id: 'Q1' })).toBeUndefined();
  });

  it('does not transfer an office holder to a jurisdiction created later or label a whole crossing tenure with both jurisdictions', () => {
    const entities = new Map<string, Entity>([
      [
        'Q1',
        human('Q1', {
          P39: [
            claim('Q1$early', item('Q11'), { P580: [snak(date(1770))], P582: [snak(date(1780))] }),
            claim('Q1$crossing', item('Q11'), {
              P580: [snak(date(1840))],
              P582: [snak(date(1860))],
            }),
          ],
        }),
      ],
      ['Q9', { id: 'Q9', claims: { P35: [claim('Q9$ruler', item('Q1'))] } } as Entity],
      [
        'Q11',
        {
          id: 'Q11',
          claims: {
            P1001: [
              claim('Q11$modern', item('Q9'), { P580: [snak(date(1850))] }),
              claim('Q11$old', item('Q8'), { P582: [snak(date(1849))] }),
            ],
          },
        } as Entity,
      ],
    ]);
    const person = buildPeople([], entities, new Set(['Q9'])).people[0]!;
    expect(
      person.tenures
        .filter((tenure) => tenure.statementId === 'Q1$early')
        .map((tenure) => tenure.polity?.id),
    ).toEqual(['Q8']);
    expect(
      person.tenures
        .filter((tenure) => tenure.statementId === 'Q1$crossing')
        .map((tenure) => tenure.polity?.id),
    ).toEqual([undefined]);
  });

  it.each([
    { P1480: [snak(item('Q8'))] },
    { P580: [snak({ ...date(1700), calendarmodel: 'http://www.wikidata.org/entity/Q1985786' })] },
  ])(
    'keeps jurisdiction generic when the association is uncertain or its calendar needs conversion',
    (qualifiers) => {
      const entities = new Map<string, Entity>([
        [
          'Q1',
          human('Q1', {
            P39: [
              claim('Q1$office', item('Q11'), {
                P580: [snak(date(1770))],
                P582: [snak(date(1780))],
              }),
            ],
          }),
        ],
        ['Q9', { id: 'Q9', claims: { P35: [claim('Q9$ruler', item('Q1'))] } } as Entity],
        [
          'Q11',
          { id: 'Q11', claims: { P1001: [claim('Q11$scope', item('Q9'), qualifiers)] } } as Entity,
        ],
      ]);
      const person = buildPeople([], entities, new Set(['Q9'])).people[0]!;
      expect(
        person.tenures.find((tenure) => tenure.statementId === 'Q1$office')?.polity,
      ).toBeUndefined();
    },
  );

  it('quarantines an inverted month/day tenure and a person whose sourced birth is after their death', () => {
    const exact = (value: string, precision = 11) => ({
      time: value,
      precision,
      calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
    });
    const entities = new Map<string, Entity>([
      [
        'Q9',
        {
          id: 'Q9',
          claims: { P35: [claim('Q9$ruler', item('Q1')), claim('Q9$invalid', item('Q2'))] },
        } as Entity,
      ],
      [
        'Q1',
        human('Q1', {
          P39: [
            claim('Q1$inversion', item('Q11'), {
              P580: [snak(exact('+1829-06-26T00:00:00Z'))],
              P582: [snak(exact('+1829-03-00T00:00:00Z', 10))],
            }),
          ],
        }),
      ],
      [
        'Q2',
        human('Q2', { P569: [claim('Q2$birth', date(-4))], P570: [claim('Q2$death', date(-335))] }),
      ],
    ]);
    const result = buildPeople([], entities, new Set(['Q9']));
    expect(result.people.map((person) => person.id)).toEqual(['Q1']);
    expect(result.people[0]?.tenures.some((tenure) => tenure.statementId === 'Q1$inversion')).toBe(
      false,
    );
    expect(result.rejected.map((rejection) => rejection.reason)).toEqual(
      expect.arrayContaining(['tenure-ends-before-start', 'life-dates-incoherent']),
    );
  });
});
