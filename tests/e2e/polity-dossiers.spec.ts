import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { formatYear } from '../../lib/histdate';
import type { Person, PolityLeaders } from '../../lib/schema';

const registry: {
  mappings: {
    polityId: string;
    sourceName: string;
    wikidataId: string;
    status: 'verified' | 'ambiguous';
  }[];
} = JSON.parse(readFileSync('data/curated/polity-identities.json', 'utf8'));
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // This flow uses published statements; optional live encyclopedia requests
  // cannot change which political identity or office is under test.
  await page.route('https://*.wikipedia.org/api/rest_v1/page/summary/**', (route) => route.abort());
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

test('a reviewed territory opens its sourced current leader and returns to the territory', async ({
  page,
  request,
}) => {
  const mapping = registry.mappings.find(
    (entry) =>
      entry.status === 'verified' &&
      entry.wikidataId === 'Q71084' &&
      !entry.sourceName.startsWith('('),
  );
  expect(
    mapping,
    'The tested territory must be present in the reviewed identity registry',
  ).toBeTruthy();
  const polityResponse = await request.get(`/geo/polities/${mapping!.polityId}.json`);
  expect(polityResponse.ok()).toBe(true);
  const polity = await polityResponse.json();
  expect(polity.name).toBe(mapping!.sourceName);
  expect(polity.wikidataId).toBe(mapping!.wikidataId);
  const catalogResponse = await request.get(`/data/polity-leaders/${mapping!.wikidataId}.json`);
  expect(catalogResponse.ok()).toBe(true);
  const catalog: PolityLeaders = await catalogResponse.json();
  expect(catalog.polityId).toBe(mapping!.wikidataId);
  const tenure = catalog.leaders.find(
    (entry) =>
      entry.start?.length === 1 &&
      entry.end?.length === 1 &&
      !entry.start[0].approximate &&
      !entry.end[0].approximate &&
      ['day', 'month', 'year'].includes(entry.start[0].precision) &&
      ['day', 'month', 'year'].includes(entry.end[0].precision) &&
      entry.start[0].date.year <= entry.end[0].date.year,
  );
  expect(tenure, 'A dated office must come from the published source catalog').toBeTruthy();
  expect(tenure!.polity?.id).toBe(catalog.polityId);
  expect(tenure!.sources.length).toBeGreaterThan(0);
  const personResponse = await request.get(`/data/people/${tenure!.personId}.json`);
  expect(personResponse.ok()).toBe(true);
  const person: Person = await personResponse.json();
  expect(person.tenures.some((entry) => entry.id === tenure!.id)).toBe(true);
  const year = tenure!.start![0].date.year;
  const requested = new Set<string>();
  page.on('request', (resource) => requested.add(new URL(resource.url()).pathname));
  await page.goto(`/?entity=${mapping!.polityId}&y=${year}`);
  const territoryPanel = page.getByTestId('entity-panel');
  await expect(
    territoryPanel.getByRole('heading', { name: polity.name, exact: true }),
  ).toBeVisible();
  const leaders = territoryPanel.getByTestId('entity-leaders');
  await expect(
    leaders.getByRole('heading', {
      name: `Périodes documentées en ${formatYear(year)}`,
      exact: true,
    }),
  ).toBeVisible();
  const currentList = leaders.locator(':scope > .leader-list');
  const leader = currentList.getByRole('button', {
    name: tenure!.name.fr ?? tenure!.name.en,
    exact: true,
  });
  await expect(leader).toBeVisible();
  await expect(currentList.locator('.leader-sources > a').first()).toHaveAttribute(
    'href',
    tenure!.sources[0].url,
  );
  expect([...requested].filter((path) => path.startsWith('/data/people/'))).toEqual([]);
  await leader.click();
  const personPanel = page.getByTestId('person-panel');
  await expect(
    personPanel.getByRole('heading', { name: person.name.fr ?? person.name.en, exact: true }),
  ).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('person')).toBe(person.id);
  expect(new URL(page.url()).searchParams.get('entity')).toBe(mapping!.polityId);
  expect(new URL(page.url()).searchParams.get('y')).toBe(String(year));
  expect(requested.has(`/data/people/${person.id}.json`)).toBe(true);
  await personPanel
    .getByRole('button', { name: 'Fermer la fiche du personnage', exact: true })
    .click();
  await expect(
    territoryPanel.getByRole('heading', { name: polity.name, exact: true }),
  ).toBeVisible();
  await expect(leader).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.has('person')).toBe(false);
  expect(new URL(page.url()).searchParams.get('entity')).toBe(mapping!.polityId);
  await expect(page.getByTestId('year-slider')).toHaveAttribute('aria-valuetext', formatYear(year));
});

test('an explicitly ambiguous Roman identity does not borrow rulers or wars from its source QID', async ({
  page,
  request,
}) => {
  const mapping = registry.mappings.find(
    (entry) => entry.status === 'ambiguous' && entry.sourceName === 'Roman Empire',
  );
  expect(
    mapping,
    'The exclusion must come from the reviewed registry, not a test fixture',
  ).toBeTruthy();
  const response = await request.get(`/geo/polities/${mapping!.polityId}.json`);
  expect(response.ok()).toBe(true);
  const polity = await response.json();
  expect(polity.wikidataId).toBe(mapping!.wikidataId);
  const requested = new Set<string>();
  page.on('request', (resource) => requested.add(new URL(resource.url()).pathname));
  await page.goto(`/?entity=${mapping!.polityId}&y=${polity.firstObserved}`);
  const panel = page.getByTestId('entity-panel');
  await expect(panel.getByRole('heading', { name: polity.name, exact: true })).toBeVisible();
  await expect(panel.locator('.entity-sources')).toBeAttached();
  await expect(panel.getByTestId('entity-leaders')).toHaveCount(0);
  await expect(panel.locator('.entity-wars')).toHaveCount(0);
  expect([...requested].filter((path) => path.startsWith('/data/polity-leaders/'))).toEqual([]);
});
