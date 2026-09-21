import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const audit = (page: Page) =>
  new AxeBuilder({ page })
    // This WCAG 2.5.3 rule is experimental in axe and otherwise excluded by its defaults.
    .options({ rules: { 'label-content-name-mismatch': { enabled: true } } })
    .withTags(tags)
    .analyze();

test('desktop atlas has no automatically detectable WCAG AA violations', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?lang=fr&y=1812');
  await expect(page.getByTestId('year-slider')).toBeVisible();
  const result = await audit(page);
  await testInfo.attach('axe-desktop', {
    body: JSON.stringify(result.violations, null, 2),
    contentType: 'application/json',
  });
  expect(result.violations).toEqual([]);
});

test('search is accessible and keyboard focus returns to its trigger', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?lang=fr&y=1812');
  const trigger = page.getByRole('button', { name: 'Rechercher dans l’atlas', exact: true });
  await trigger.click();
  await expect(page.getByRole('combobox', { name: 'Rechercher dans l’atlas' })).toBeFocused();
  await page.getByRole('combobox', { name: 'Rechercher dans l’atlas' }).fill('Waterloo');
  await expect(page.getByRole('option').first()).toBeVisible();
  const result = await audit(page);
  await testInfo.attach('axe-search', {
    body: JSON.stringify(result.violations, null, 2),
    contentType: 'application/json',
  });
  expect(result.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('mobile sourced event drawer has no automatically detectable WCAG AA violations', async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const manifest = await (await request.get('/data/manifest.json')).json();
  const chunks = manifest.chunks.filter(
    (item: { start: number; end: number }) => item.start <= 1815 && item.end >= 1815,
  );
  const events = (
    await Promise.all(
      chunks.map(async (chunk: { path: string }) => (await request.get(chunk.path)).json()),
    )
  ).flat();
  const event = events.find(
    (item: { type: string; name: { en: string } }) =>
      item.type === 'battle' && /waterloo/i.test(item.name.en),
  );
  expect(event).toBeTruthy();
  await page.goto(`/?y=${event.start.year}&e=${event.id}&lang=en&theme=light`);
  await expect(
    page.getByTestId('event-panel').getByRole('heading', { name: event.name.en }),
  ).toBeVisible();
  const result = await audit(page);
  await testInfo.attach('axe-mobile-event', {
    body: JSON.stringify(result.violations, null, 2),
    contentType: 'application/json',
  });
  expect(result.violations).toEqual([]);
});
