import { expect, test } from '@playwright/test';
import type { BattleRecord } from '../../lib/battles/schema';
import { UNIT_PROFILES } from '../../lib/battles/units';

for (const [id, profileId] of [
  ['Q20312996', 'byzantine-spearman'],
  ['Q24971262', 'tercio-pikeman'],
  ['Q4870622', 'civil-war-pikeman'],
  ['Q1123353', 'british-martini-infantry'],
  ['Q2166177', 'zulu-spearman'],
  ['Q3636509', 'ottoman-ww1-infantry'],
  ['Q2887849', 'french-revolution-infantry'],
  ['Q699665', 'french-imperial-cocked-hat'],
  ['Q313435', 'austrian-seven-years-infantry'],
  ['Q384091', 'japanese-russo-war-winter-infantry'],
  ['Q384091', 'russian-russo-war-winter-infantry'],
  ['Q2736004', 'mexican-war-infantry'],
  ['Q2689975', 'mexican-war-infantry'],
  ['Q2888281', 'mexican-war-infantry'],
  ['Q2888281', 'musket-infantry'],
  ['Q1059732', 'french-revolution-infantry'],
  ['Q543994', 'napoleonic-infantry'],
  ['Q697266', 'french-line-infantry-1870'],
  ['Q697306', 'french-line-infantry-1870'],
  ['Q699238', 'french-line-infantry-1870'],
  ['Q699262', 'french-line-infantry-1870'],
  ['Q570919', 'french-line-infantry-1870'],
  ['Q697266', 'prussian-line-infantry-1870'],
  ['Q697306', 'prussian-line-infantry-1870'],
  ['Q699238', 'prussian-line-infantry-1870'],
  ['Q699262', 'prussian-line-infantry-1870'],
] as const) {
  test(`dated land equipment animates at ${id} (${profileId})`, async ({
    page,
    request,
  }, testInfo) => {
    const record: BattleRecord = await (
      await request.get(`/data/battles/events/${id}.json`)
    ).json();
    const models: string[] = [];
    const errors: string[] = [];
    page.on('requestfinished', (request) => {
      if (request.url().endsWith('.glb')) models.push(request.url());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(
      `/?${new URLSearchParams({
        battle: '1',
        e: id,
        y: String(record.start!.year),
        lon: String(record.coords![0]),
        lat: String(record.coords![1]),
        z: '16',
        pitch: '65',
        lang: 'en',
      })}`,
    );
    const map = page.locator('[data-battle-status]');
    await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
    await expect(map).toHaveAttribute('data-battle-rendered', 'true');
    await expect
      .poll(() => models.some((url) => url.endsWith(UNIT_PROFILES[profileId].modelUrl)))
      .toBe(true);
    await page.getByTestId('battle-play').click();
    await expect
      .poll(async () => Number(await map.getAttribute('data-battle-progress')))
      .toBeGreaterThan(0.05);
    await page.getByTestId('battle-play').click();
    await testInfo.attach('dated-equipment', {
      body: await page.locator('.maplibregl-canvas').screenshot(),
      contentType: 'image/png',
    });
    expect(errors).toEqual([]);
  });
}
