import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { HistoricalEvent, Person } from '../../lib/schema';

const summary = JSON.parse(readFileSync('tests/fixtures/wikipedia/Q48314-fr.json', 'utf8'));
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

test('battle to commander preserves the map and returns to the battle after a bilingual deep-link reload', async ({
  page,
  request,
}, testInfo) => {
  const event: HistoricalEvent = await (
    await request.get(`/data/events/${summary.wikibase_item}.json`)
  ).json();
  const commander = event.people?.find((person) => person.role === 'commander');
  expect(commander, 'The commander must be acquired from a sourced battle relation').toBeTruthy();
  const person: Person = await (
    await request.get(`/data/people/${commander!.personId}.json`)
  ).json();
  expect(person.sources.length).toBeGreaterThan(0);
  expect(person.events.some((link) => link.eventId === event.id)).toBe(true);
  await page.route('https://*.wikipedia.org/api/rest_v1/page/summary/**', (route) => route.abort());
  await page.goto(
    `/?y=${event.start.year}&e=${event.id}&lon=${event.coords![0]}&lat=${event.coords![1]}&z=4`,
  );
  const eventPanel = page.getByTestId('event-panel');
  await expect(eventPanel.getByTestId('event-people')).toBeAttached();
  const beforeYear = new URL(page.url()).searchParams.get('y');
  await eventPanel
    .getByRole('button', { name: new RegExp(commander!.name.fr ?? commander!.name.en, 'i') })
    .first()
    .click();
  const personPanel = page.getByTestId('person-panel');
  await expect(
    personPanel.getByRole('heading', { name: person.name.fr ?? person.name.en, exact: true }),
  ).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('person')).toBe(person.id);
  expect(new URL(page.url()).searchParams.get('e')).toBe(event.id);
  expect(new URL(page.url()).searchParams.get('y')).toBe(beforeYear);
  await page.reload();
  await expect(
    personPanel.getByRole('heading', { name: person.name.fr ?? person.name.en, exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Passer en anglais$/ }).click();
  await expect(
    personPanel.getByRole('heading', { name: person.name.en, exact: true }),
  ).toBeVisible();
  await expect(personPanel.locator('.sources-list a').first()).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const audit = await new AxeBuilder({ page })
    .include('[data-testid="person-panel"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  await testInfo.attach('person-accessibility', {
    body: JSON.stringify(audit.violations, null, 2),
    contentType: 'application/json',
  });
  expect(audit.violations).toEqual([]);
  await personPanel.getByRole('button', { name: 'Close person panel', exact: true }).click();
  await expect(eventPanel.getByRole('heading', { name: event.name.en, exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.has('person')).toBe(false);
});

test('people are searchable while their dossiers stay unloaded until selected', async ({
  page,
  request,
}) => {
  const event: HistoricalEvent = await (
    await request.get(`/data/events/${summary.wikibase_item}.json`)
  ).json();
  const commander = event.people?.find((person) => person.role === 'commander');
  expect(commander).toBeTruthy();
  const requested: string[] = [];
  page.on('request', (request) => requested.push(new URL(request.url()).pathname));
  await page.goto('/?y=1815');
  await page.getByRole('button', { name: 'Rechercher dans l’atlas', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Rechercher dans l’atlas' });
  await input.fill(commander!.name.fr ?? commander!.name.en);
  const result = page
    .getByRole('option')
    .filter({ hasText: commander!.name.fr ?? commander!.name.en })
    .filter({ hasText: /Personnage|Dirigeant/ })
    .first();
  await expect(result).toBeVisible();
  expect(requested.filter((path) => path.startsWith('/data/people/'))).toEqual([]);
  await result.click();
  await expect(page.getByTestId('person-panel')).toBeVisible();
  await expect
    .poll(() => requested.includes(`/data/people/${commander!.personId}.json`))
    .toBe(true);
});

test('a battle displays its sourced French encyclopedia summary and attribution', async ({
  page,
  request,
}) => {
  const event = await (await request.get(`/data/events/${summary.wikibase_item}.json`)).json();
  expect(event.wikipedia.fr).toContain('fr.wikipedia.org/wiki/');
  let requested = false;
  await page.route('https://fr.wikipedia.org/api/rest_v1/page/summary/**', async (route) => {
    requested = true;
    await route.fulfill({ json: summary });
  });
  await page.goto(`/?y=${event.start.year}&e=${event.id}`);
  const panel = page.getByTestId('event-panel');
  await expect(panel.locator('.detail-summary')).toHaveText(summary.extract);
  expect(requested).toBe(true);
  await expect(panel.locator('.detail-attribution a').first()).toHaveAttribute(
    'href',
    summary.content_urls.desktop.page,
  );
  await expect(panel.locator('.detail-attribution')).toContainText('CC BY-SA');
});
