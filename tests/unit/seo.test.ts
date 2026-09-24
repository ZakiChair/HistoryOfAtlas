import { describe, expect, it } from 'vitest';
import {
  commonsImageUrl,
  errorReportUrl,
  getEventMapUrl,
  getEventPermalink,
  getPersonMapUrl,
  hasStaticEventPage,
} from '@/lib/seo';
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

describe('shareable links', () => {
  it('links a person without copying the sharer’s whole view', () => {
    expect(getPersonMapUrl('Q517')).toBe('/?person=Q517');
  });
  it('opens the map at the event without an archive page', () => {
    expect(getEventMapUrl(lowImportance)).toBe(getEventPermalink(lowImportance));
  });
});

describe('preview images', () => {
  it('requests a 1200 px rendition of Commons files', () => {
    expect(
      commonsImageUrl('https://commons.wikimedia.org/wiki/Special:FilePath/A%20b.jpg?width=960'),
    ).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/A%20b.jpg?width=1200');
    expect(commonsImageUrl('https://commons.wikimedia.org/wiki/Special:FilePath/A.jpg', 640)).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/A.jpg?width=640',
    );
  });
  it('passes other images through and drops invalid values', () => {
    expect(commonsImageUrl('https://upload.wikimedia.org/a.jpg')).toBe(
      'https://upload.wikimedia.org/a.jpg',
    );
    expect(commonsImageUrl('not a url')).toBeUndefined();
    expect(commonsImageUrl(undefined)).toBeUndefined();
  });
});

describe('error reports', () => {
  it('prefills a GitHub issue with the identifier, displayed year and link', () => {
    const url = new URL(
      errorReportUrl({
        name: 'Battle of Gaugamela',
        id: 'Q188129',
        kind: 'event',
        year: -330,
        url: 'https://atlas.example/event/Q188129/',
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://github.com/ZakiChair/HistoryOfAtlas/issues/new',
    );
    expect(url.searchParams.get('title')).toBe('Correction: Battle of Gaugamela (Q188129)');
    const body = url.searchParams.get('body')!;
    expect(body).toContain('[Q188129](https://www.wikidata.org/wiki/Q188129)');
    expect(body).toContain('331 BCE (astronomical -330)');
    expect(body).toContain('https://atlas.example/event/Q188129/');
    expect(body).toContain('corrected at the source');
  });
  it('quotes non-Wikidata identifiers and omits unknown fields', () => {
    const body = new URL(
      errorReportUrl({ name: 'Kennecott', id: 'usgs-mrds', kind: 'resource' }),
    ).searchParams.get('body')!;
    expect(body).toContain('`usgs-mrds`');
    expect(body).not.toContain('Displayed year');
    expect(body).not.toContain('Link:');
    expect(body).not.toContain('Wikidata');
  });
});
