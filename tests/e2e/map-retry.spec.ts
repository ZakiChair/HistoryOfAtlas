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
  // No boundary is drawn, so none is credited, and the caption no longer claims to be loading.
  await expect(attribution).toHaveText('Natural Earth');
  const status = page.getByTestId('boundary-status');
  await expect(status).toHaveAttribute('data-status', 'unavailable');
  await expect(status).toHaveText('Boundaries unavailable');

  await page.unroute('**/geo/manifest.json');
  await retry.click();
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  });
  // Cliopatria borders are drawn for 1812, and the caption must now credit that source.
  await expect(attribution).toContainText('Cliopatria / Seshat');
  await expect(page.locator('.map-attribution')).toContainText('Approximate boundaries');
});
