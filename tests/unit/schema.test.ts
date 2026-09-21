import { describe, expect, it } from 'vitest';
import {
  HistoricalEventSchema,
  HistDateSchema,
  CampaignSchema,
  EventShardSchema,
} from '../../lib/schema';
import { buildSequences } from '../../pipeline/build';

// Synthetic structural fixture: it is never shipped as historical data.
const fixture = {
  id: 'Q42',
  type: 'battle',
  name: { en: 'Schema test only' },
  start: { year: 0 },
  coords: [0, 20],
  belligerents: [],
  importance: 50,
  era: 'classical',
  region: 'africa',
  sources: [{ label: 'Wikidata', url: 'https://www.wikidata.org/wiki/Q42' }],
  datePrecision: 'year',
};

describe('ingestion contracts', () => {
  it('builds campaign steps with English defaults and preserved sourced names', () => {
    const event = HistoricalEventSchema.parse({
      ...fixture,
      name: { en: 'English event', fr: 'Événement français', de: 'Deutsches Ereignis' },
    });
    const second = { ...event, id: 'Q43', start: { year: 1 } };
    const campaign = buildSequences(
      new Map([['Q44', [event, second]]]),
      new Map([['Q44', { id: 'Q44', labels: { en: { value: 'Campaign' } } }]]),
      [{ id: 'Q44' }],
    )[0];
    expect(campaign.steps[0].label).toBe('English event');
    expect(campaign.steps[0].name).toEqual({
      en: 'English event',
      fr: 'Événement français',
      de: 'Deutsches Ereignis',
    });
  });

  it('retains available names, descriptions and source links in all six languages', () => {
    const names = {
      en: 'Example',
      fr: 'Exemple',
      de: 'Beispiel',
      es: 'Ejemplo',
      zh: '示例',
      ru: 'Пример',
    };
    const links = {
      en: 'https://en.wikipedia.org/wiki/Example',
      de: 'https://de.wikipedia.org/wiki/Beispiel',
      zh: 'https://zh.wikipedia.org/wiki/示例',
    };
    const event = HistoricalEventSchema.parse({
      ...fixture,
      name: names,
      description: names,
      summary: names,
      wikipedia: links,
    });
    expect(event.name).toEqual(names);
    expect(event.description).toEqual(names);
    expect(event.summary).toEqual(names);
    expect(event.wikipedia).toEqual(links);
  });

  it('requires temporal tile validity to contain the whole declared interval', () => {
    const shard = {
      key: '0',
      start: 0,
      end: 99,
      validFrom: -25,
      validTo: 124,
      path: '/data/tiles/0.pmtiles',
      count: 1,
    };
    expect(EventShardSchema.safeParse(shard).success).toBe(true);
    expect(EventShardSchema.safeParse({ ...shard, validTo: 98 }).success).toBe(false);
    expect(EventShardSchema.safeParse({ ...shard, start: 100 }).success).toBe(false);
  });
  it('requires real QID syntax and nonempty source provenance', () => {
    expect(HistoricalEventSchema.safeParse(fixture).success).toBe(true);
    expect(HistoricalEventSchema.safeParse({ ...fixture, id: 'invented' }).success).toBe(false);
    expect(HistoricalEventSchema.safeParse({ ...fixture, sources: [] }).success).toBe(false);
    expect(
      HistoricalEventSchema.safeParse({
        ...fixture,
        sources: [{ label: 'x', url: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
  });

  it('rejects invalid coordinates and negative event durations', () => {
    expect(HistoricalEventSchema.safeParse({ ...fixture, coords: [181, 50] }).success).toBe(false);
    expect(HistoricalEventSchema.safeParse({ ...fixture, coords: [0, Number.NaN] }).success).toBe(
      false,
    );
    expect(HistoricalEventSchema.safeParse({ ...fixture, end: { year: -1 } }).success).toBe(false);
    expect(HistDateSchema.safeParse({ year: 0, month: 4, day: 31 }).success).toBe(false);
  });

  it('accepts partially dated ends that could overlap a precisely dated start', () => {
    expect(
      HistoricalEventSchema.safeParse({
        ...fixture,
        start: { year: 2000, month: 6, day: 10 },
        end: { year: 2000 },
        datePrecision: 'day',
      }).success,
    ).toBe(true);
    expect(
      HistoricalEventSchema.safeParse({
        ...fixture,
        start: { year: 2000, month: 6, day: 10 },
        end: { year: 2000, month: 6 },
        datePrecision: 'day',
      }).success,
    ).toBe(true);
    expect(
      HistoricalEventSchema.safeParse({
        ...fixture,
        start: { year: 2000, month: 6, day: 10 },
        end: { year: 2000, month: 5 },
        datePrecision: 'day',
      }).success,
    ).toBe(false);
  });

  it('requires campaigns to have chronological, sourced steps', () => {
    const campaign = {
      id: 'Q42',
      name: { en: 'Schema test only' },
      polity: 'Q43',
      sources: fixture.sources,
      steps: [
        { eventId: 'Q44', coords: [0, 20], date: { year: 10 }, label: 'Step one' },
        { eventId: 'Q45', coords: [1, 20], date: { year: 9 }, label: 'Step two' },
      ],
    };
    expect(CampaignSchema.safeParse(campaign).success).toBe(false);
    expect(
      CampaignSchema.safeParse({ ...campaign, steps: [...campaign.steps].reverse() }).success,
    ).toBe(true);
  });
});
