import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EventPeople from '../../components/panels/EventPeople';
import { selectedEventFilter } from '../../components/map/event-filters';
import { createInitialAtlasState } from '../../lib/store';
import type { EventPersonLink, HistoricalEvent, Story } from '../../lib/schema';
import {
  sortStoriesChronologically,
  storyBoundaryEvents,
  storyRange,
  type StoryRange,
} from '../../lib/story-order';

const require = createRequire(import.meta.url);
const mapRequire = createRequire(require.resolve('maplibre-gl/package.json'));
const { featureFilter } = mapRequire('@maplibre/maplibre-gl-style-spec') as {
  featureFilter: (
    filter: unknown,
    rootKey: string,
  ) => {
    filter: (
      globals: { zoom: number },
      feature: { type: string; properties: Record<string, unknown> },
    ) => boolean;
  };
};

const ringed = (state: ReturnType<typeof createInitialAtlasState>, id: string) =>
  featureFilter(selectedEventFilter(state), 'layers[0].filter').filter(
    { zoom: 3 },
    { type: 'Point', properties: { id, type: 'treaty' } },
  );

describe('active story step on the map', () => {
  const initial = createInitialAtlasState();

  it('rings the highlighted step only while its story is open', () => {
    expect(initial.highlightedEvent).toBeNull();
    const story = { ...initial, storyId: 'Q78994', highlightedEvent: 'Q134114' };
    expect(ringed(story, 'Q134114')).toBe(true);
    expect(ringed(story, 'Q48314')).toBe(false);
    expect(ringed({ ...story, storyId: null }, 'Q134114')).toBe(false);
  });

  it('lets an open dossier take precedence over the story step', () => {
    const state = {
      ...initial,
      storyId: 'Q78994',
      highlightedEvent: 'Q134114',
      selectedEvent: 'Q48314',
    };
    expect(ringed(state, 'Q48314')).toBe(true);
    expect(ringed(state, 'Q134114')).toBe(false);
  });
});

describe('people of a long campaign', () => {
  const person = (index: number, role: EventPersonLink['role']): EventPersonLink => ({
    personId: `Q${1000 + index}`,
    name: { en: `Person ${index}` },
    role,
    statementId: `Q1$${role}-${index}`,
    property: role === 'commander' ? 'P4791' : 'P710',
    sourceEntityId: 'Q1',
    sources: [{ label: 'Wikidata', url: `https://www.wikidata.org/wiki/Q1#${index}` }],
  });

  it('keeps every documented commander and shortens participation to eight names', () => {
    const people = [
      ...Array.from({ length: 10 }, (_, index) => person(index, 'commander')),
      ...Array.from({ length: 30 }, (_, index) => person(100 + index, 'participant')),
    ];
    const html = renderToStaticMarkup(createElement(EventPeople, { people }));
    expect(html).toContain('Documented command');
    for (let index = 0; index < 10; index++) expect(html).toContain(`>Person ${index}<`);
    for (let index = 100; index < 108; index++) expect(html).toContain(`>Person ${index}<`);
    expect(html).not.toContain('>Person 108<');
    expect(html).toContain('Show more (22)');
  });

  it('shows short lists in full', () => {
    const people = Array.from({ length: 8 }, (_, index) => person(index, 'participant'));
    const html = renderToStaticMarkup(createElement(EventPeople, { people }));
    expect(html).toContain('>Person 7<');
    expect(html).not.toContain('Show more');
  });
});

describe('guided story catalog', () => {
  const root = process.cwd();
  const stories: Story[] = JSON.parse(readFileSync(join(root, 'public/data/stories.json'), 'utf8'));
  const event = (id: string): HistoricalEvent =>
    JSON.parse(readFileSync(join(root, 'public/data/events', `${id}.json`), 'utf8'));

  it('orders the published stories chronologically with their date ranges', () => {
    const ranges = new Map<string, StoryRange>();
    for (const story of stories) {
      const range = storyRange(storyBoundaryEvents(story).map(event));
      expect(range, story.id).not.toBeNull();
      ranges.set(story.id, range!);
    }
    const sorted = sortStoriesChronologically(stories, ranges);
    expect(sorted).toHaveLength(stories.length);
    expect(sorted[0]!.title.en).toBe('Wars of Alexander the Great');
    expect(sorted.at(-1)!.title.en).toBe('World War II');
    const years = sorted.map((story) => ranges.get(story.id)!.start.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(ranges.get('Q78994')).toMatchObject({ start: { year: 1805 }, end: { year: 1815 } });
  });

  it('keeps undated stories after dated ones in their published order', () => {
    const range = (year: number): StoryRange => ({ start: { year }, end: { year } });
    const sorted = sortStoriesChronologically(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      new Map([
        ['c', range(1500)],
        ['d', range(-50)],
      ]),
    );
    expect(sorted.map((story) => story.id)).toEqual(['d', 'c', 'a', 'b']);
    expect(storyRange([])).toBeNull();
    expect(storyBoundaryEvents({ steps: [{ eventId: 'Q1', text: { en: 'x' } }] })).toEqual(['Q1']);
  });
});
