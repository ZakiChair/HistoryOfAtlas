import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const changes = JSON.parse(
  readFileSync(new URL('../../public/data/context/changes.json', import.meta.url), 'utf8'),
) as {
  changes: { id: string; year: number; title: { fr: string }; coordinates: [number, number] }[];
};
const change = changes.changes.find((item) => item.id === 'vienna-1815')!;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('context loads only its active corpus and restores a sourced selection from its URL', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const requested: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (/^\/data\/context\/[^/]+\.json$/.test(path)) requested.push(path);
  });
  await page.goto('/?lang=fr&y=1812&from=1800&to=1820&projection=mercator');
  await expect(page.getByTestId('context-toggle')).toBeVisible();
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
  expect(requested).toEqual([]);

  await page.getByTestId('context-toggle').click();
  const panel = page.getByTestId('context-panel');
  await expect(page.getByTestId('context-changes')).toBeVisible();
  expect([...new Set(requested)]).toEqual(['/data/context/changes.json']);
  const entry = panel
    .locator('ol > li')
    .filter({ has: page.getByText(change.title.fr, { exact: true }) });
  await entry.getByRole('button').first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get('contextItem')).toBe(change.id);
  await entry.getByRole('button', { name: /Afficher cette date/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe(String(change.year));
  // The date lies inside the chosen period, which only a conflicting date would clear.
  await expect.poll(() => new URL(page.url()).searchParams.get('from')).toBe('1800');
  await expect.poll(() => new URL(page.url()).searchParams.has('play')).toBe(false);
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('lon')))
    .toBeCloseTo(change.coordinates[0]);
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('lat')))
    .toBeCloseTo(change.coordinates[1]);

  const sharedUrl = page.url();
  await page.reload();
  await expect(entry.getByRole('button').first()).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('context')).toBe('changes');
  expect(new URL(sharedUrl).searchParams.get('contextItem')).toBe(change.id);

  await page.getByTestId('context-tab-coverage').click();
  await expect(page.getByTestId('context-coverage')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.has('contextItem')).toBe(false);
  expect(new Set(requested)).toEqual(
    new Set(['/data/context/changes.json', '/data/context/coverage.json']),
  );
  const europe = panel.getByRole('button', { name: 'Europe', exact: true });
  await europe.click();
  await expect(europe).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.get('contextItem')).toBe('europe');
  await page.reload();
  await expect(europe).toHaveAttribute('aria-pressed', 'true');

  await panel.getByRole('button', { name: 'Toutes les régions', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has('contextItem')).toBe(false);
  await panel.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(panel).not.toBeAttached();
  await expect.poll(() => new URL(page.url()).searchParams.has('context')).toBe(false);
  await expect(page.getByTestId('context-toggle')).toBeFocused();
  expect(errors).toEqual([]);
});

test('coverage explains an unsourced snapshot year and navigates to the actual next observation', async ({
  page,
}) => {
  await page.goto(
    '/?lang=fr&y=1807&context=coverage&contextItem=europe&borders=historical-basemaps',
  );
  const coverage = page.getByTestId('context-coverage');
  const counts = coverage.locator('tbody td');
  await expect(coverage).toContainText('Aucun instantané n’est daté de cette année');
  // An undated year is unknown to this source, which a zero would misread as an empty world.
  await expect(counts.first()).toHaveText('—');
  await coverage.getByRole('button', { name: 'Instantané suivant · 1815', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('1815');
  await expect(coverage).not.toContainText('Aucun instantané n’est daté de cette année');
  await expect(counts.first()).not.toHaveText('—');
  await expect(coverage.getByRole('button', { name: 'Europe', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('the context reader fits mobile, keeps its controls reachable and passes an axe audit', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lang=fr&y=1812&context=coverage&theme=light');
  const panel = page.getByTestId('context-panel');
  await expect(page.getByTestId('context-coverage')).toBeVisible();
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
  const box = await panel.boundingBox();
  const timeline = await page.getByTestId('timeline').boundingBox();
  expect(box).not.toBeNull();
  expect(timeline).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(391);
  expect(box!.y + box!.height).toBeLessThanOrEqual(timeline!.y + 1);
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );

  const audit = await new AxeBuilder({ page })
    .include('[data-testid="context-panel"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  await testInfo.attach('axe-context-mobile', {
    body: JSON.stringify(audit.violations, null, 2),
    contentType: 'application/json',
  });
  expect(audit.violations).toEqual([]);
  await page.getByTestId('context-tab-networks').click();
  await expect(page.getByTestId('networks-view')).toBeVisible();
  await page.getByTestId('context-tab-cities').click();
  await expect(page.getByTestId('context-tab-cities')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByRole('status')).not.toBeAttached();
  await expect(panel.getByRole('alert')).not.toBeAttached();
  await panel.getByRole('heading', { name: 'Comprendre', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(panel).not.toBeAttached();
  await expect(page.getByTestId('context-toggle')).toBeFocused();
});
