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

for (const viewport of [
  { name: 'mobile', width: 390, height: 844, layers: false },
  { name: 'compact mobile with all layers', width: 320, height: 667, layers: true },
]) {
  test(`${viewport.name} sourced event drawer has no automatically detectable WCAG AA violations`, async ({
    page,
    request,
  }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
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
    await page.goto(
      `/?y=${event.start.year}&e=${event.id}&lang=en&theme=light${viewport.layers ? '&resources=1&religions=1' : ''}`,
    );
    await expect(
      page.getByTestId('event-panel').getByRole('heading', { name: event.name.en }),
    ).toBeVisible();
    await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
    if (viewport.layers) {
      await expect(page.getByTestId('religions-status')).toBeVisible();
      await expect(page.getByTestId('religions-status')).not.toContainText('Loading');
      await expect(page.getByTestId('resources-loading')).not.toBeAttached();
    }
    await expect
      .poll(
        async () => {
          const tools = await page
            .getByRole('toolbar', { name: 'Map controls', exact: true })
            .boundingBox();
          const drawer = await page.getByTestId('event-panel').boundingBox();
          return Boolean(tools && drawer && tools.y + tools.height <= drawer.y);
        },
        { message: 'Every map tool must remain above the open mobile drawer' },
      )
      .toBe(true);
    const result = await audit(page);
    await testInfo.attach('axe-mobile-event', {
      body: JSON.stringify(result.violations, null, 2),
      contentType: 'application/json',
    });
    expect(result.violations).toEqual([]);
  });
}
