import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Campaign } from '../../lib/schema';

const campaigns = JSON.parse(
  readFileSync(new URL('../../public/data/campaigns.json', import.meta.url), 'utf8'),
) as Campaign[];
const campaign = campaigns.find((item) => item.steps.length >= 10)!;
const campaignUrl = (step: number) =>
  `/?lang=fr&campaign=${campaign.id}&step=${step}&y=${campaign.steps[step].date.year}`;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('a shared playing campaign advances from its saved step and resumes again after reload', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto(`${campaignUrl(2)}&cplay=1`);
  const pause = page
    .locator('.campaign-controls')
    .getByRole('button', { name: 'Pause', exact: true });
  await expect(pause).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('cplay')).toBe('1');
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('step')), { timeout: 15_000 })
    .toBeGreaterThan(2);
  const savedStep = Number(new URL(page.url()).searchParams.get('step'));
  await page.reload();
  await expect(pause).toBeVisible();
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('step')), { timeout: 15_000 })
    .toBeGreaterThan(savedStep);
  await expect.poll(() => new URL(page.url()).searchParams.get('cplay')).toBe('1');
  await expect.poll(() => new URL(page.url()).searchParams.has('play')).toBe(false);
  await pause.click();
  await expect.poll(() => new URL(page.url()).searchParams.has('cplay')).toBe(false);
});

test('leaving the campaign panel stops its clock and reopening it keeps the saved step paused', async ({
  page,
}) => {
  await page.goto(campaignUrl(2));
  const play = page
    .locator('.campaign-controls')
    .getByRole('button', { name: 'Lire la campagne', exact: true });
  await play.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('cplay')).toBe('1');
  await page.getByRole('button', { name: 'Parcours', exact: true }).click();
  await expect(page.locator('.campaign-panel')).not.toBeAttached();
  await expect.poll(() => new URL(page.url()).searchParams.has('cplay')).toBe(false);
  const stoppedStep = new URL(page.url()).searchParams.get('step');
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();
  await expect(play).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('step')).toBe(stoppedStep);
  await expect.poll(() => new URL(page.url()).searchParams.has('cplay')).toBe(false);
  await play.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('cplay')).toBe('1');
  await page.getByRole('button', { name: 'Fermer la campagne', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has('campaign')).toBe(false);
  await expect.poll(() => new URL(page.url()).searchParams.has('cplay')).toBe(false);
});
