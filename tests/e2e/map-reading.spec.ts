import { expect, test } from '@playwright/test';

test('boundary attribution names only the snapshot actually displayed at an exact date', async ({
  page,
}) => {
  await page.goto('/?y=1800&lang=fr&borders=historical-basemaps');
  const caption = page.locator('.map-attribution');
  await expect(caption).toContainText('1800');
  await expect(caption).not.toContainText('1815');
});

test('map reading explains the blend and separates a range from the boundary year', async ({
  page,
}) => {
  await page.goto('/?y=1807&lang=fr&borders=historical-basemaps&from=1800&to=1820');
  await expect(page.getByTestId('boundary-status')).toHaveAttribute('data-status', 'transition');
  await expect(page.getByTestId('boundary-status')).toContainText('1800 / 1815');
  const toggle = page.getByTestId('map-reading-toggle');
  await toggle.click();
  const reading = page.getByTestId('map-reading');
  await expect(reading).toBeVisible();
  await expect(reading).toContainText('ne reconstitue pas les frontières');
  await expect(reading).toContainText('non documentée');
  await expect(reading).toContainText('contemporains');
  await expect(reading).toContainText('les dates sources sont indiquées ici');
  await page.keyboard.press('Escape');
  await expect(reading).not.toBeVisible();
  await expect(toggle).toBeFocused();
  // Space on the help control must open it, not start the global timeline shortcut.
  await page.keyboard.press('Space');
  await expect(reading).toBeVisible();
  await expect(page.getByTestId('timeline-play')).toHaveAttribute(
    'aria-label',
    'Lire la chronologie',
  );
});

test('the timeline note loads on demand and closes back onto its control', async ({ page }) => {
  await page.goto('/?y=1500&lang=fr');
  const reading = page.getByTestId('timeline-reading');
  const summary = reading.locator('summary');
  await summary.click();
  const note = reading.locator('p').first();
  await expect(note).toContainText('Une même distance');
  await expect(note).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(note).not.toBeVisible();
  await expect(summary).toBeFocused();
});

test('map reading distinguishes the retained source year and the historical fallback', async ({
  page,
}) => {
  await page.goto('/?y=2026&lang=fr');
  await expect(page.getByTestId('boundary-status')).toHaveAttribute('data-status', 'latest');
  await expect(page.getByTestId('boundary-status')).toContainText('2024');
  await page.getByTestId('map-reading-toggle').click();
  await expect(page.getByTestId('map-reading')).toContainText(
    'ce n’est pas une observation pour l’année choisie',
  );
  await page.goto('/?y=-3500&lang=fr');
  await expect(page.locator('.map-attribution')).toContainText('Historical Basemaps');
  await page.getByTestId('map-reading-toggle').click();
  await expect(page.getByTestId('map-reading')).toContainText(
    'Cliopatria ne fournit pas de contour',
  );
  await expect(page.getByTestId('boundary-status')).toContainText('4000 av. J.-C.');
});
