import { describe, expect, it } from 'vitest';
import { HistoricalEventSchema, HistDateSchema, CampaignSchema } from '../../lib/schema';

// Synthetic structural fixture: it is never shipped as historical data.
const fixture = {
  id: 'Q42', type: 'battle', name: { en: 'Schema test only' }, start: { year: 0 },
  coords: [0, 20], belligerents: [], importance: 50, era: 'classical', region: 'africa',
  sources: [{ label: 'Wikidata', url: 'https://www.wikidata.org/wiki/Q42' }], datePrecision: 'year',
};

describe('ingestion contracts', () => {
  it('requires real QID syntax and nonempty source provenance', () => {
    expect(HistoricalEventSchema.safeParse(fixture).success).toBe(true);
    expect(HistoricalEventSchema.safeParse({ ...fixture, id: 'invented' }).success).toBe(false);
    expect(HistoricalEventSchema.safeParse({ ...fixture, sources: [] }).success).toBe(false);
    expect(HistoricalEventSchema.safeParse({ ...fixture, sources: [{ label: 'x', url: 'javascript:alert(1)' }] }).success).toBe(false);
  });

  it('rejects invalid coordinates and negative event durations', () => {
    expect(HistoricalEventSchema.safeParse({ ...fixture, coords: [181, 50] }).success).toBe(false);
    expect(HistoricalEventSchema.safeParse({ ...fixture, coords: [0, Number.NaN] }).success).toBe(false);
    expect(HistoricalEventSchema.safeParse({ ...fixture, end: { year: -1 } }).success).toBe(false);
    expect(HistDateSchema.safeParse({ year: 0, month: 4, day: 31 }).success).toBe(false);
  });

  it('requires campaigns to have chronological, sourced steps', () => {
    const campaign = { id: 'Q42', name: { en: 'Schema test only' }, polity: 'Q43', sources: fixture.sources,
      steps: [{ eventId: 'Q44', coords: [0, 20], date: { year: 10 }, label: 'Step one' }, { eventId: 'Q45', coords: [1, 20], date: { year: 9 }, label: 'Step two' }] };
    expect(CampaignSchema.safeParse(campaign).success).toBe(false);
    expect(CampaignSchema.safeParse({ ...campaign, steps: [...campaign.steps].reverse() }).success).toBe(true);
  });
});
