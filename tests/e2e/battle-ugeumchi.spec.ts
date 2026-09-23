import { expect, test } from '@playwright/test';
import type { BattleIndex, BattleRecord } from '../../lib/battles/schema';

test('Ugeumchi uses Gregorian dates and preserves three unquantified forces in two camps', async ({
  page,
  request,
}) => {
  const battle: BattleRecord = await (
    await request.get('/data/battles/events/Q4872624.json')
  ).json();
  const index: BattleIndex = await (await request.get('/data/battles/index.json')).json();
  const entry = index.battles.find((item) => item.id === battle.id)!;
  for (const record of [battle, entry]) {
    expect(record.start).toEqual({ year: 1894, month: 12, day: 4 });
    expect(record.end).toEqual({ year: 1894, month: 12, day: 7 });
    expect(record.coords).toEqual([127.1123, 36.4332]);
  }
  expect(entry.documented).toBe(false);
  expect(battle.participants.map((army) => army.sideId)).toEqual([
    'donghak',
    'government-japanese',
    'government-japanese',
  ]);
  for (const army of battle.participants) {
    expect(army.strength).toEqual([]);
    expect(army.deaths).toEqual([]);
    expect(army.casualties).toEqual([]);
    expect(army.profileId).toBeUndefined();
  }
  await page.goto('/?battle=1&e=Q4872624&y=1894&lon=127.1123&lat=36.4332&z=16&pitch=60&lang=en');
  const map = page.locator('[data-battle-status]');
  await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
  await expect(map).toHaveAttribute('data-battle-rendered', 'true');
  await expect(map).toHaveAttribute('data-battle-models', '30');
  const detail = page.getByTestId('battle-detail');
  await expect(detail.locator('.battle-location')).toContainText('36.4332°, 127.1123°');
  await expect(detail.locator('.battle-location')).toContainText('designated battlefield sector');
  await expect(detail.getByTestId('battle-unknown-strength-notice')).toContainText(
    'unknown strength, no historical proportions',
  );
  const rows = detail.getByTestId('battle-army');
  await expect(rows).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await expect(rows.nth(i)).toContainText(battle.participants[i].name.en);
    await expect(rows.nth(i).locator('.battle-quantity')).toHaveCount(0);
  }
  await page.getByTestId('battle-play').click();
  await expect
    .poll(async () => Number(await map.getAttribute('data-battle-progress')))
    .toBeGreaterThan(0.05);
  await page.getByTestId('battle-play').click();
  await page.getByRole('slider', { name: 'Animation progress' }).fill('1000');
  for (let i = 0; i < 3; i++)
    await expect(rows.nth(i).getByTestId('battle-model-states').locator('dd')).toHaveText([
      '10',
      '0',
      '0',
    ]);
  await expect(detail.getByTestId('battle-loss-share')).toHaveCount(0);
});
