import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ResourceSite } from '../../lib/resources/types';

const state = vi.hoisted(() => ({
  year: 1890,
  selected: null as ResourceSite | null,
  locale: 'en',
}));

vi.mock('../../lib/store', () => ({
  useAtlasStore: (selector: (value: object) => unknown) =>
    selector({ battlesVisible: false, resourcesVisible: true, year: state.year, range: null }),
}));
vi.mock('../../lib/i18n', () => ({
  useI18n: () => ({
    locale: state.locale,
    // MapLayers names the event key toggle through t(); these tests do not assert that label.
    t: (french: string, english: string) => (state.locale === 'fr' ? french : english),
  }),
}));
vi.mock('../../lib/resources/store', () => ({
  useResourceStore: (selector: (value: object) => unknown) =>
    selector({ status: 'ready', selected: state.selected, sources: [], categoryCounts: {} }),
}));

import MapLayers from '../../components/map/MapLayers';

const site: ResourceSite = {
  id: 'known-mine',
  name: 'Known mine',
  coordinates: [10, 20],
  categories: ['copper'],
  sourceId: 'source',
  sourceYear: 2026,
  sourceUrl: 'https://example.org/source',
  knowledge: [
    {
      fromYear: 1880,
      kind: 'discovery',
      categories: ['copper'],
      sourceUrl: 'https://example.org/discovery',
    },
  ],
  periods: [{ fromYear: 1900, toYear: 1910, sourceUrl: 'https://example.org/mining' }],
};

beforeEach(() => {
  state.year = 1890;
  state.locale = 'en';
  state.selected = structuredClone(site);
});

it('separates a sourced discovery from later exploitation and an undocumented current year', () => {
  const markup = renderToStaticMarkup(createElement(MapLayers));
  expect(markup).toContain('data-testid="resource-knowledge"');
  expect(markup).toContain('Discovery');
  expect(markup).toContain('1880');
  expect(markup).toContain('href="https://example.org/discovery"');
  expect(markup).toContain('No exploitation documented for 1890');
  expect(markup).toContain('1900 — 1910');
  state.year = 1905;
  expect(renderToStaticMarkup(createElement(MapLayers))).toContain(
    'Exploitation documented for 1905',
  );
  state.year = 1940;
  expect(renderToStaticMarkup(createElement(MapLayers))).toContain(
    'No exploitation documented for 1940',
  );
});

it('labels the first exploitation evidence as attestation instead of inventing a discovery', () => {
  state.selected = { ...site, knowledge: undefined };
  state.year = 1900;
  const markup = renderToStaticMarkup(createElement(MapLayers));
  expect(markup).toContain('First attestation');
  expect(markup).not.toContain('>Discovery');
  expect(markup).toContain('href="https://example.org/mining"');
});

it.each(['en', 'fr', 'de', 'es', 'zh', 'ru'])(
  'renders a discovery-only deposit without invented exploitation in %s',
  (locale) => {
    state.locale = locale;
    state.selected = { ...site, periods: [] };
    const markup = renderToStaticMarkup(createElement(MapLayers));
    expect(markup).toContain('data-testid="resource-knowledge"');
    expect(markup).toContain('data-testid="resource-no-exploitation"');
    expect(markup).toContain('data-exploitation="unattested"');
    expect(markup).not.toMatch(/undefined|NaN|\{period\}/);
    expect(markup).not.toContain('1900 — 1910');
  },
);
