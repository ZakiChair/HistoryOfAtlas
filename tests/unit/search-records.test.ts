import { describe, expect, it } from 'vitest';
import {
  campaignSearchRecord,
  religionSearchRecords,
  searchBoost,
  searchFuzziness,
} from '../../lib/search-records';

// Structural documents exercise the record shapes; they are never published as history.
const text = (en: string) => ({ fr: `${en} (fr)`, en });
const stage = (
  id: string,
  year: number,
  kind: 'origin' | 'spread',
  extra: Partial<Parameters<typeof religionSearchRecords>[0]['milestones'][number]> = {},
) => ({
  id,
  traditionId: 'example-tradition',
  kind,
  year,
  approximate: false,
  title: text(`Stage ${id}`),
  coordinates: [year / 100, 10] as [number, number],
  ...extra,
});
const dataset = {
  traditions: [
    { id: 'example-tradition', names: text('Sample faiths') },
    { id: 'undated-tradition', names: text('Undated traditions') },
  ],
  milestones: [
    stage('later-origin', 200, 'origin'),
    stage('first-origin', -300, 'origin', { approximate: true }),
    stage('spread', -500, 'spread', {
      area: { label: text('Example valley'), ring: [] },
    }),
    { ...stage('orphan', 0, 'spread'), traditionId: 'unknown-tradition' },
  ],
};

describe('religion search documents', () => {
  const records = religionSearchRecords(dataset);
  const tradition = records.find((record) => record.targetId === 'example-tradition')!;
  const milestone = records.find((record) => record.targetId === 'spread')!;

  it('keeps traditions and milestones apart from events sharing an identifier', () => {
    expect(records.map((record) => record.id)).toEqual([
      'tradition-example-tradition',
      'tradition-undated-tradition',
      'milestone-later-origin',
      'milestone-first-origin',
      'milestone-spread',
    ]);
    expect(records.every((record) => record.kind === 'religion')).toBe(true);
  });

  it('places a tradition on its earliest origin, never on an earlier spread', () => {
    expect(tradition).toMatchObject({
      type: 'tradition',
      year: -300,
      approximate: true,
      coords: [-3, 10],
    });
  });

  it('does not invent a date or place for a tradition without an origin', () => {
    const undated = records.find((record) => record.targetId === 'undated-tradition')!;
    expect(undated.year).toBeUndefined();
    expect(undated.coords).toBeUndefined();
  });

  it('makes a tradition searchable by both names and by its catalogue identifier', () => {
    expect(tradition.title).toContain('Sample faiths (fr)');
    expect(tradition.title).toContain('Sample faiths');
    expect(tradition.title).toContain('example tradition');
  });

  it('links a milestone to its tradition, which is also searchable from it', () => {
    expect(milestone).toMatchObject({
      type: 'milestone',
      parentId: 'example-tradition',
      year: -500,
      approximate: false,
      coords: [-5, 10],
      context: text('Sample faiths'),
    });
    expect(milestone.title).toContain('Stage spread (fr)');
    for (const alias of ['Sample faiths', 'example tradition', 'Example valley (fr)'])
      expect(milestone.aliases).toContain(alias);
  });

  it('drops a milestone whose tradition is missing from the catalogue', () => {
    expect(records.some((record) => record.targetId === 'orphan')).toBe(false);
  });
});

describe('campaign search documents', () => {
  it('opens a campaign on its first step and finds it by its polity', () => {
    const record = campaignSearchRecord({
      id: 'Q10',
      name: { en: 'Example campaign', fr: 'Campagne exemple' },
      polity: 'Example polity',
      steps: [
        { coords: [12, 34], date: { year: -50 } },
        { coords: [0, 0], date: { year: -40 } },
      ],
    } as Parameters<typeof campaignSearchRecord>[0]);
    expect(record).toMatchObject({
      id: 'campaign-Q10',
      targetId: 'Q10',
      kind: 'campaign',
      year: -50,
      coords: [12, 34],
      aliases: 'Example polity',
    });
    expect(record.title).toContain('Campagne exemple');
  });

  it('keeps an empty campaign undated rather than failing', () => {
    const record = campaignSearchRecord({
      id: 'Q11',
      name: { en: 'Empty campaign' },
      steps: [],
    } as unknown as Parameters<typeof campaignSearchRecord>[0]);
    expect(record.year).toBeUndefined();
    expect(record.coords).toBeUndefined();
  });
});

describe('matching and ranking', () => {
  it('tolerates typos only in words of six characters or more', () => {
    for (const term of ['oil', 'rome', 'inca', 'islam']) expect(searchFuzziness(term)).toBe(false);
    for (const term of ['ghawar', 'waterlo', 'buddhism']) expect(searchFuzziness(term)).toBe(0.2);
  });

  it('puts a guided campaign and a tradition ahead of records sharing their words', () => {
    const campaign = searchBoost({ kind: 'campaign' });
    const tradition = searchBoost({ kind: 'religion', type: 'tradition' });
    const territory = searchBoost({ kind: 'entity' });
    const milestone = searchBoost({ kind: 'religion', type: 'milestone' });
    const person = searchBoost({ kind: 'person' });
    expect(tradition).toBeGreaterThan(campaign);
    expect(campaign).toBeGreaterThan(territory);
    expect(territory).toBeGreaterThan(milestone);
    expect(milestone).toBe(person);
  });

  it('orders events by their sourced importance, neutral when it is missing', () => {
    expect(searchBoost({ kind: 'event', importance: 90 })).toBeGreaterThan(
      searchBoost({ kind: 'event', importance: 30 }),
    );
    expect(searchBoost({ kind: 'event' })).toBe(1);
    expect(searchBoost({ kind: 'event', importance: 50 })).toBe(1);
  });
});
