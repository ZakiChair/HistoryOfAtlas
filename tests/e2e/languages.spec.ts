import { expect, test } from '@playwright/test';
import type { Campaign, HistoricalEvent } from '../../lib/schema';

test('a new visit opens HistoryOfAtlas in English', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/HistoryOfAtlas/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('language-select')).toHaveValue('en');
  await expect(page.getByTestId('year-slider')).toHaveAttribute('aria-label', 'Year');
  await expect(page.getByTestId('language-select').locator('option')).toHaveCount(6);
});

test('campaign steps use sourced English names by default and follow language changes', async ({
  page,
  request,
}) => {
  const campaigns: Campaign[] = await (await request.get('/data/campaigns.json')).json();
  const campaign = campaigns.find((item) => item.id === 'Q124988')!;
  const step = campaign.steps[0];
  const event: HistoricalEvent = await (
    await request.get(`/data/events/${step.eventId}.json`)
  ).json();
  expect(event.name.fr).toBeTruthy();
  expect(event.name.fr).not.toBe(event.name.en);
  await page.goto(`/?campaign=${campaign.id}&step=0&y=${step.date.year}`);
  const title = page.locator('.campaign-steps [aria-current="step"] strong');
  await expect(title).toHaveText(event.name.en);
  await page.getByTestId('language-select').selectOption('fr');
  await expect(title).toHaveText(event.name.fr!);
  await page.getByTestId('language-select').selectOption('de');
  await expect(title).toHaveText(event.name.de ?? event.name.en);
  await expect(title).toHaveAttribute('lang', event.name.de ? 'de' : 'en');
});

const languages = [
  { locale: 'en', year: 'Year', play: 'Play timeline' },
  { locale: 'fr', year: 'Année', play: 'Lire la chronologie' },
  { locale: 'de', year: 'Jahr', play: 'Zeitleiste abspielen' },
  { locale: 'es', year: 'Año', play: 'Reproducir cronología' },
  { locale: 'zh', year: '年份', play: '播放时间轴' },
  { locale: 'ru', year: 'Год', play: 'Воспроизвести хронологию' },
];

for (const { locale, year, play } of languages) {
  test(`${locale} translates controls and survives a shared-link reload`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?y=-330&mode=list');
    await page.getByTestId('language-select').selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByTestId('year-slider')).toHaveAttribute('aria-label', year);
    await expect(page.getByTestId('timeline-play')).toHaveAttribute('aria-label', play);
    await expect.poll(() => new URL(page.url()).searchParams.get('lang')).toBe(locale);
    await page.reload();
    await expect(page.getByTestId('language-select')).toHaveValue(locale);
    await expect(page.getByTestId('year-slider')).toHaveAttribute('aria-label', year);
    await expect(page.getByTestId('timeline-play')).toHaveAttribute('aria-label', play);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    expect(errors).toEqual([]);
  });
}
