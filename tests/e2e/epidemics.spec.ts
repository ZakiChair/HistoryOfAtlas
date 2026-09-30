import { expect, test, type Page } from '@playwright/test';
import { epidemicFixture } from '../fixtures/epidemics';

const fixture = epidemicFixture();

async function ready(page: Page, year = 1347) {
  await page.route('**/data/epidemics/history.json', (route) => route.fulfill({ json: fixture }));
  await page.goto(`/?lang=fr&y=${year}&battles=0`);
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  });
}

async function epidemicReady(page: Page) {
  await expect(page.getByTestId('epidemics-status')).toBeVisible();
  await expect(page.getByTestId('epidemics-status')).not.toContainText('Chargement', {
    timeout: 20_000,
  });
}

test('epidemics load on activation, filter and open a dated detail', async ({ page }) => {
  await ready(page);
  await page.getByTestId('epidemics-layer-toggle').click();
  await epidemicReady(page);
  await expect(page.getByTestId('epidemics-status')).toContainText('foyers documentés');
  await page.getByTestId('epidemics-legend-toggle').click();
  await expect(page.getByTestId('epidemics-panel')).toBeVisible();
  await page.getByTestId('epidemic-filter-plague').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('epidemic')).toBe('plague');
  await page.getByTestId('epidemic-stage-plague-constantinople').click();
  const detail = page.getByTestId('epidemic-detail');
  await expect(detail).toBeVisible();
  await expect(detail).toContainText(/1347 — 1348/);
  await expect(detail).toContainText(/1\s?000 — 2\s?000 décès/);
  await expect(detail.getByRole('link', { name: /Test toll source/ })).toBeVisible();
});

test('shows the documented-outbreak count and empties past the grace window', async ({ page }) => {
  await page.route('**/data/epidemics/history.json', (route) => route.fulfill({ json: fixture }));
  await page.goto('/?lang=fr&y=1347&epidemics=1&battles=0');
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  });
  await epidemicReady(page);
  await expect(page.getByTestId('epidemics-status')).toContainText('2 foyers documentés');
  await page.goto('/?lang=fr&y=1400&epidemics=1&battles=0');
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  });
  await epidemicReady(page);
  await expect(page.getByTestId('epidemics-status')).toContainText('Aucun foyer documenté');
});

test('hiding the layer drops the flag but keeps the disease filter', async ({ page }) => {
  await ready(page);
  await page.getByTestId('epidemics-layer-toggle').click();
  await epidemicReady(page);
  await page.getByTestId('epidemics-legend-toggle').click();
  await page.getByTestId('epidemic-filter-plague').click();
  await page.getByTestId('epidemics-layer-toggle').click();
  await expect(page.getByTestId('epidemics-panel')).not.toBeAttached();
  const params = new URL(page.url()).searchParams;
  expect(params.has('epidemics')).toBe(false);
  expect(params.get('epidemic')).toBe('plague');
});

test('epidemic and religion panels are mutually exclusive', async ({ page }) => {
  await ready(page);
  await page.getByTestId('epidemics-layer-toggle').click();
  await page.getByTestId('epidemics-legend-toggle').click();
  await expect(page.getByTestId('epidemics-panel')).toBeVisible();
  await page.getByTestId('religions-layer-toggle').click();
  await page.getByTestId('religions-legend-toggle').click();
  await expect(page.getByTestId('religions-panel')).toBeVisible();
  await expect(page.getByTestId('epidemics-panel')).not.toBeAttached();
  await page.getByTestId('epidemics-legend-toggle').click();
  await expect(page.getByTestId('epidemics-panel')).toBeVisible();
  await expect(page.getByTestId('religions-panel')).not.toBeAttached();
});

test('the spread toggle hides halos and fronts and persists as espread=0', async ({ page }) => {
  await page.route('**/data/epidemics/history.json', (route) => route.fulfill({ json: fixture }));
  await page.goto('/?lang=fr&y=1348&epidemics=1&battles=0');
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  });
  await epidemicReady(page);
  await page.getByTestId('epidemics-legend-toggle').click();
  const toggle = page.getByTestId('epidemics-spread-toggle');
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('espread')).toBe('0');
  await page.goto('/?lang=fr&y=1348&epidemics=1&battles=0&espread=0');
  await page.getByTestId('epidemics-legend-toggle').click();
  await expect(page.getByTestId('epidemics-spread-toggle')).not.toBeChecked();
});
