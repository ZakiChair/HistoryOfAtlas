import { describe, expect, it } from 'vitest';
import { getEventPermalink, hasStaticEventPage } from '@/lib/seo';
import type { HistoricalEvent } from '@/lib/schema';

const lowImportance = {
  id: 'Q178912',
  type: 'naval',
  importance: 46,
  start: { year: 1780 },
  coords: [-8.5636, 36.8181],
} satisfies Pick<HistoricalEvent, 'id' | 'type' | 'importance' | 'start' | 'coords'>;

describe('permanent event URLs', () => {
  it('links a low-importance event to its valid atlas view instead of an absent static page', () => {
    expect(hasStaticEventPage(lowImportance)).toBe(false);
    const url = new URL(getEventPermalink(lowImportance), 'https://atlas.example');
    expect(url.pathname).toBe('/');
    expect(url.searchParams.get('e')).toBe(lowImportance.id);
    expect(url.searchParams.get('y')).toBe('1780');
    expect(Number(url.searchParams.get('lon'))).toBe(lowImportance.coords[0]);
    expect(Number(url.searchParams.get('lat'))).toBe(lowImportance.coords[1]);
  });
  it('uses the same inclusive importance threshold as static generation', () => {
    expect(getEventPermalink({ ...lowImportance, importance: 60 })).toBe('/event/Q178912/');
    expect(hasStaticEventPage({ ...lowImportance, importance: 59 })).toBe(false);
  });
  it('preserves astronomical BCE years without a Date conversion', () => {
    const url = new URL(
      getEventPermalink({ ...lowImportance, start: { year: -322 }, coords: undefined }),
      'https://atlas.example',
    );
    expect(url.searchParams.get('y')).toBe('-322');
    expect(url.searchParams.has('lon')).toBe(false);
  });
  it('includes curated records in the build while keeping uncatalogued client links safe', () => {
    expect(hasStaticEventPage(lowImportance, new Set([lowImportance.id]))).toBe(true);
    expect(getEventPermalink(lowImportance)).toMatch(/^\/\?y=/);
  });
  it.each(['war', 'campaign', 'treaty'] as const)(
    'generates %s pages regardless of prominence',
    (type) => {
      expect(getEventPermalink({ ...lowImportance, type, importance: 0 })).toBe('/event/Q178912/');
    },
  );
});
