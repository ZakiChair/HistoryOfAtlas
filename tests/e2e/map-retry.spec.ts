import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('Try again after a failed geography manifest also restores the border attribution', async ({
  page,
}) => {
  // The map and the caption share one download of the manifest, so both fail together.
  await page.route('**/geo/manifest.json', (route) => route.abort());
  await page.goto('/?lang=en&y=1812');
  const retry = page.getByTestId('map-retry');
  await expect(retry).toBeVisible({ timeout: 30_000 });
  const attribution = page.locator('.map-attribution a');
  await expect(attribution).toContainText('Historical Basemaps');

  await page.unroute('**/geo/manifest.json');
  await retry.click();
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  });
  // Cliopatria borders are drawn for 1812, and the caption must name that source, not the
  // fallback it showed while the manifest was missing.
  await expect(attribution).toContainText('Cliopatria / Seshat');
  await expect(page.locator('.map-attribution')).toContainText('Approximate boundaries');
});
