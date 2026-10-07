import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Campaign } from '../../lib/schema';

const campaigns = JSON.parse(
  readFileSync(new URL('../../public/data/campaigns.json', import.meta.url), 'utf8'),
) as Campaign[];
const campaign = campaigns.find((item) => item.steps.length >= 10)!;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('opening the context reader hides the first-visit card without dismissing it', async ({
  page,
}) => {
  await page.goto('/?lang=fr');
  const card = page.getByTestId('start-card');
  await expect(card).toBeVisible();
  await page.getByTestId('context-toggle').click();
  const panel = page.getByTestId('context-panel');
  await expect(panel).toBeVisible();
  await expect(card).not.toBeAttached();
  await expect(page.getByTestId('context-changes')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('atlas-start-card'))).toBeNull();
  await panel.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(panel).not.toBeAttached();
  await expect(card).toBeVisible();
  await expect(page.getByTestId('context-toggle')).toBeFocused();
});

test('opening the context reader and selecting a record stop campaign playback', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const campaignUrl = `/?lang=fr&campaign=${campaign.id}&step=0&y=${campaign.steps[0].date.year}`;
  await page.goto(campaignUrl);
  await page
    .locator('.campaign-controls')
    .getByRole('button', { name: 'Lire la campagne', exact: true })
    .click();
  await expect(
    page.locator('.campaign-controls').getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('cplay')).toBe('1');
  await page.getByTestId('context-toggle').click();
  await expect(page.getByTestId('context-panel')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.has('cplay')).toBe(false);

  // Restore a history entry while the campaign stays mounted. Selecting a record must
  // pause that restored clock independently of the context-opening button.
  await page.evaluate((url) => {
    history.pushState(null, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, `${campaignUrl}&cplay=1&context=changes`);
  const reader = page.getByTestId('context-changes');
  await expect(reader).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('cplay')).toBe('1');
  const record = reader.locator('ol > li').first().getByRole('button').first();
  await record.click();
  await expect(record).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.has('cplay')).toBe(false);
  await expect.poll(() => new URL(page.url()).searchParams.get('campaign')).toBe(campaign.id);
  await expect.poll(() => new URL(page.url()).searchParams.has('play')).toBe(false);
});
