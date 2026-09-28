import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const frenchEmpire = 'clio-bd4117cb9fdb95';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://*.wikipedia.org/api/rest_v1/page/summary/**', (route) => route.abort());
});

async function changeYear(page: Page, year: string) {
  await page.getByRole('button', { name: /Modifier l’année/ }).click();
  await page.getByRole('textbox', { name: 'Année', exact: true }).fill(year);
  await page.getByRole('button', { name: 'Valider l’année', exact: true }).click();
}

test('a selected empire shows its capital and dated population, without interpolating other years', async ({
  page,
}) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/data/polity-facts/')) requests.push(request.url());
  });
  await page.goto(`/?lang=fr&entity=${frenchEmpire}&y=1812`);
  const facts = page.getByTestId('entity-facts');
  await expect(facts).toBeVisible();
  await expect(facts.getByTestId('capital-facts')).toContainText('Paris');
  await expect(facts.getByTestId('capital-facts')).toContainText('Période non précisée');
  await expect(facts.getByTestId('capital-facts')).toContainText(
    'Aucune capitale datée documentée pour 1812',
  );
  await expect(facts.getByTestId('capital-facts')).toContainText(
    'Capitales mentionnées sans période connue',
  );
  await expect(facts.getByTestId('population-facts')).toContainText(/44\s*000\s*000/);
  await expect(facts.getByTestId('population-facts')).toContainText('1812');
  await expect(facts.locator('a[href*="wikidata.org"]').first()).toBeVisible();
  const profileRequests = () => requests.filter((url) => url.includes('/Q71084.json'));
  expect(profileRequests()).toHaveLength(1);
  await changeYear(page, '1810');
  await expect(facts.getByTestId('population-reference')).toContainText('1812');
  await expect(facts.getByTestId('population-facts')).toContainText(
    'Aucun chiffre documenté pour 1810',
  );
  expect(profileRequests()).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('polity facts are loaded only when a territory is opened', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/data/polity-facts/')) requested.push(request.url());
  });
  await page.goto('/?lang=fr&y=1812');
  await expect(page.getByTestId('timeline')).toBeVisible();
  await expect(page.getByTestId('entity-panel')).toHaveCount(0);
  expect(requested).toEqual([]);
});

test('Ottoman capitals follow the selected year and population ranges keep their source dates', async ({
  page,
}) => {
  await page.goto('/?lang=fr&entity=clio-bd4b87bc07eb4c&y=1400');
  const capitals = page.getByTestId('capital-facts');
  await expect(capitals.locator(':scope > ul')).toContainText('Edirne');
  await changeYear(page, '1500');
  await expect(capitals.locator(':scope > ul')).toContainText('Constantinople');
  await expect(capitals.locator(':scope > ul')).not.toContainText('Edirne');
  await expect(page.getByTestId('population-facts')).toContainText(/9\s*000\s*000/);
  await expect(page.getByTestId('population-facts')).toContainText('1500');
});

test('a failed profile can be retried and observations outside its identity period stay hidden', async ({
  page,
}) => {
  const profile = JSON.parse(readFileSync('public/data/polity-facts/Q71084.json', 'utf8'));
  profile.populations.push({
    ...profile.populations[0],
    id: 'outside-period',
    value: 123456789,
    date: { date: { year: 2000 }, precision: 'year', calendar: 'gregorian' },
  });
  let requests = 0;
  let recovered = false;
  await page.route('**/data/polity-facts/Q71084.json', async (route) => {
    requests += 1;
    if (!recovered) await route.fulfill({ status: 503, body: 'Unavailable' });
    else await route.fulfill({ json: profile });
  });
  await page.goto(`/?lang=fr&entity=${frenchEmpire}&y=1812`);
  const facts = page.getByTestId('entity-facts');
  await expect(facts.getByRole('button', { name: 'Réessayer', exact: true })).toBeVisible();
  const failedRequests = requests;
  recovered = true;
  await facts.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(facts.getByTestId('population-current')).toContainText(/44\s*000\s*000/);
  await expect(facts).not.toContainText(/123\s*456\s*789/);
  await expect(facts).not.toContainText('Autres observations démographiques');
  expect(requests).toBe(failedRequests + 1);
});

test('an earlier territory response cannot replace the newly selected territory facts', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route('**/data/polity-facts/Q71084.json', async (route) => {
    started = true;
    await gate;
    await route.fulfill({
      body: readFileSync('public/data/polity-facts/Q71084.json', 'utf8'),
      contentType: 'application/json',
    });
  });
  await page.goto(`/?lang=fr&entity=${frenchEmpire}&y=1812`);
  await expect.poll(() => started).toBe(true);
  // Browser history restoration changes selection without reloading the document.
  await page.evaluate(() => {
    history.pushState({}, '', '/?lang=fr&entity=clio-bd4b87bc07eb4c&y=1500');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByTestId('capital-facts').locator(':scope > ul')).toContainText(
    'Constantinople',
  );
  release();
  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .some((entry) => entry.name.endsWith('/Q71084.json')),
      ),
    )
    .toBe(true);
  await expect(page.getByTestId('capital-facts').locator(':scope > ul')).toContainText(
    'Constantinople',
  );
  await expect(page.getByTestId('population-facts')).not.toContainText(/44\s*000\s*000/);
});
