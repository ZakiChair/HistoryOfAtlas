import { expect, test } from '@playwright/test';

test('the coverage view speaks the interface language, not English under an Arabic label', async ({
  page,
}) => {
  await page.goto('/?lang=ar&y=1812&context=coverage');
  const coverage = page.getByTestId('context-coverage');
  await expect(coverage).toHaveAttribute('lang', 'ar');
  await expect(coverage.locator('h3')).toHaveText('تغطية المصادر الإقليمية');
  await expect(coverage).not.toContainText('Territorial source coverage');
});

test('a shared reconstruction does not reopen the reading panel over it', async ({ page }) => {
  await page.goto('/?battle=1&context=changes&lang=fr');
  await expect(page.getByTestId('context-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('context-panel')).toHaveCount(0);
});

test('leaving a focused battle for the reading panel leaves no dossier behind', async ({
  page,
}) => {
  await page.goto('/?battle=1&e=Q48314&y=1815&lon=4.4122&lat=50.6794&z=16&lang=fr');
  await page.getByTestId('context-toggle').click();
  await expect(page.getByTestId('context-panel')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.has('e')).toBe(false);
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('z'))).toBeLessThan(5);
});

test('coverage actions change only what they name', async ({ page }) => {
  const param = (name: string) => new URL(page.url()).searchParams.get(name);
  await page.goto(
    '/?lang=fr&y=1807&context=coverage&borders=historical-basemaps&lon=30&lat=40&z=3&projection=mercator',
  );
  const coverage = page.getByTestId('context-coverage');
  await coverage.getByRole('button', { name: 'Instantané suivant · 1815', exact: true }).click();
  await expect.poll(() => param('y')).toBe('1815');
  expect(Number(param('lon'))).toBeCloseTo(30);

  await page.goto(
    '/?lang=fr&y=1810&from=1800&to=1820&context=coverage&contextItem=europe&lon=30&lat=40&z=3&projection=mercator',
  );
  await coverage.getByRole('button', { name: 'Centrer sur cette région', exact: true }).click();
  await expect.poll(() => Number(param('lon'))).toBeCloseTo(15);
  expect(param('from')).toBe('1800');
  expect(param('to')).toBe('1820');
  expect(param('y')).toBe('1810');
});

test('keyboard focus follows a city record and returns to its row', async ({ page }) => {
  await page.goto('/?lang=fr&y=1812&context=cities');
  const view = page.getByTestId('context-cities-view');
  const row = view.locator('[data-row]').first();
  const id = await row.getAttribute('data-row');
  await row.focus();
  await page.keyboard.press('Enter');
  const detail = page.getByTestId('context-city-detail');
  await expect(detail.locator('h4').first()).toBeFocused();
  await view.getByRole('button', { name: /Retour/ }).click();
  await expect(view.locator(`[data-row="${id}"]`)).toBeFocused();
  // Escape still reaches the panel because focus never fell out of it.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('context-panel')).toHaveCount(0);
});

test('Escape clears the city search before it closes the panel', async ({ page }) => {
  await page.goto('/?lang=fr&y=1812&context=cities');
  const search = page.getByTestId('context-cities-view').getByRole('searchbox');
  await search.fill('Rome');
  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('');
  await expect(page.getByTestId('context-panel')).toBeVisible();
});

test('reading the panel with the keyboard does not start the timeline', async ({ page }) => {
  await page.goto('/?lang=fr&y=1812&context=changes');
  await expect(page.getByTestId('context-changes')).toBeVisible();
  await page.locator('#context-heading').focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('timeline-play')).toHaveAttribute(
    'aria-label',
    'Lire la chronologie',
  );
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('1812');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the panel leaves part of the map visible and steps aside when showing a place', async ({
    page,
  }) => {
    await page.goto('/?lang=fr&y=1812&context=networks');
    const panel = page.getByTestId('context-panel');
    await expect(page.getByTestId('networks-view')).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(844 * 0.45 + 1);
    // Room for the map between the controls above and the sheet.
    expect(box.y).toBeGreaterThan(200);

    await page.locator('[data-testid^="network-"]').first().getByRole('button').first().click();
    await page.getByRole('button', { name: /carte/i }).first().click();
    await expect(page.getByTestId('networks-view')).toBeHidden();
    const collapsed = (await panel.boundingBox())!;
    expect(collapsed.height).toBeLessThan(80);
    // Collapsed, it covers neither the map tools nor the source credit above the timeline.
    const credit = (await page.locator('.map-attribution').boundingBox())!;
    expect(collapsed.y + collapsed.height).toBeLessThan(credit.y);
    const toggle = page.getByTestId('context-collapse');
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // The overlay stays active behind it, so reopening resumes the same reading.
    await expect.poll(() => new URL(page.url()).searchParams.get('context')).toBe('networks');
    await toggle.click();
    await expect(page.getByTestId('networks-view')).toBeVisible();
  });

  test('a record opened from a shared link is not hidden under the panel', async ({ page }) => {
    await page.goto('/?lang=fr&y=1812&context=changes&entity=Q172579');
    await expect(page.getByTestId('entity-panel')).toBeVisible();
    await expect(page.getByTestId('context-panel')).toBeHidden();
  });
});
