import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('Arabic controls fit a compact phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 667 });
  await page.goto('/?lang=ar&y=1900');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  for (const selector of ['.brand', '.header-actions', '.map-layers', '.timeline-toolbar']) {
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds!.x, selector).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width, selector).toBeLessThanOrEqual(320);
  }
  await page.getByTestId('help-trigger').click();
  await expect(page.getByTestId('help-sheet')).toBeVisible();
  await expect(page.getByTestId('help-sheet').locator('kbd').filter({ hasText: '⌘ K' })).toHaveCSS(
    'direction',
    'ltr',
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('arabic-compact-help.png') });
});

test('Arabic layers and help stay readable and accessible', async ({ page }, testInfo) => {
  await page.goto('/?lang=ar&y=1900&resources=1&religions=1');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true', {
    timeout: 45_000,
  });
  await expect(page.getByTestId('resources-layer-toggle')).toContainText('الموارد الاستراتيجية');
  await expect(page.getByTestId('religions-layer-toggle')).toContainText('الأديان');
  await page.getByTestId('resources-legend-toggle').click();
  await expect(page.getByTestId('resource-legend')).toBeVisible();
  await expect(page.getByTestId('resource-filter-gold')).toContainText('الذهب');
  await page.screenshot({ path: testInfo.outputPath('arabic-resources.png') });
  await page.getByTestId('religions-legend-toggle').click();
  await expect(page.getByTestId('religions-panel')).toBeVisible();
  await expect(page.getByTestId('religions-panel').locator('h2')).toContainText(/[\u0600-\u06ff]/);
  await expect(page.locator('.religion-coverage-colours')).not.toContainText(
    'Christian traditions',
  );
  await page.screenshot({ path: testInfo.outputPath('arabic-religions.png') });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.getByTestId('help-trigger').click();
  await expect(page.getByTestId('help-sheet')).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('arabic-help.png') });
});

test('English story sources keep their own direction inside the Arabic notebook', async ({
  page,
  request,
}) => {
  const stories = await (await request.get('/data/stories.json')).json();
  const story = stories[0];
  await page.goto(`/?lang=ar&y=1815&story=${story.id}`);
  const title = page.locator('.story-title');
  await expect(title).toHaveText(story.title.en);
  await expect(title).toHaveAttribute('lang', 'en');
  await expect(title).toHaveCSS('direction', 'ltr');
  const source = page.locator('.story-step p').first();
  await expect(source).toHaveText(story.steps[0].text.en);
  await expect(source).toHaveAttribute('dir', 'auto');
  await expect(source).toHaveCSS('direction', 'ltr');
  await expect(page.locator('.story-panel')).toHaveCSS('direction', 'rtl');
});

test('Arabic search retains sourced titles and follows the interface reading direction', async ({
  page,
}) => {
  await page.goto('/?lang=ar&y=1815');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.locator('.search-trigger').click();
  const search = page.getByRole('combobox');
  await expect(search).toBeFocused();
  await search.fill('Waterloo');
  await expect(page.getByRole('option').first()).toBeVisible();
  await expect(page.locator('.search-dialog')).toHaveCSS('direction', 'rtl');
  const result = page.getByRole('option').filter({ hasText: 'Battle of Waterloo' }).first();
  await expect(result).toBeVisible();
  await result.click();
  const title = page
    .getByTestId('event-panel')
    .getByRole('heading', { name: 'Battle of Waterloo', exact: true });
  await expect(title).toBeVisible();
  await expect(title).toHaveAttribute('lang', 'en');
  await expect(title).toHaveAttribute('dir', 'auto');
  await expect(page.getByTestId('event-panel')).toHaveCSS('direction', 'rtl');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});
