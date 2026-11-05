import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('network notices remain available outside the period without silently changing the date', async ({
  page,
}) => {
  await page.goto('/?lang=fr&y=1300&from=1250&to=1350&context=networks');
  const view = page.getByTestId('networks-view');
  await expect(view.locator('li[data-in-period]')).toHaveCount(14);
  await expect(view.locator('li[data-in-period="true"]')).toHaveCount(5);
  const entry = page.getByTestId('network-great-migration-us');
  await expect(entry).toHaveAttribute('data-in-period', 'false');
  await entry.getByRole('button').first().click();
  await expect(entry.getByRole('region')).toBeVisible();
  await expect
    .poll(() => new URL(page.url()).searchParams.get('contextItem'))
    .toBe('great-migration-us');
  expect(new URL(page.url()).searchParams.get('y')).toBe('1300');
  expect(new URL(page.url()).searchParams.get('from')).toBe('1250');
  for (const heading of [
    'Mécanismes',
    'Sens de lecture',
    'Limites de la représentation',
    'Sources',
  ])
    await expect(entry.getByRole('heading', { name: heading, exact: true })).toBeAttached();
  await expect(entry.getByRole('link', { name: /Smithsonian/ })).toHaveAttribute(
    'href',
    'https://www.searchablemuseum.com/the-great-migration/',
  );
  await entry
    .getByRole('button', { name: 'Afficher cette période sur la carte', exact: true })
    .click();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('1910');
  await expect.poll(() => new URL(page.url()).searchParams.has('from')).toBe(false);
  await expect(entry).toHaveAttribute('data-in-period', 'true');
  await page.reload();
  await expect(entry.getByRole('button').first()).toHaveAttribute('aria-expanded', 'true');
  await expect(entry).toContainText('Ce que signifient les dates');
});

test('network reading is accessible on Arabic mobile and declares English historical notices', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    '/?lang=ar&y=1800&context=networks&contextItem=transatlantic-forced-migration&theme=light',
  );
  const panel = page.getByTestId('context-panel');
  const entry = page.getByTestId('network-transatlantic-forced-migration');
  await expect(entry.getByRole('region')).toBeVisible();
  await expect(
    entry.getByText('Atlantic slave trade: forced displacement to Brazil', { exact: true }),
  ).toHaveAttribute('lang', 'en');
  await expect(entry).toContainText('تهجير قسري');
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );
  const audit = await new AxeBuilder({ page })
    .include('[data-testid="context-panel"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  await testInfo.attach('axe-networks-ar-mobile', {
    body: JSON.stringify(audit.violations),
    contentType: 'application/json',
  });
  expect(audit.violations).toEqual([]);
  await expect(entry.getByRole('button').first()).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('networks-ar-mobile.png') });
});
