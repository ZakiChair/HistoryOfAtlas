import { expect, test } from '@playwright/test';
import type { BattleIndex, BattleRecord } from '../../lib/battles/schema';

test('Tabaruzaka uses the reviewed battlefield sector and keeps both armies unquantified', async ({
  page,
  request,
}) => {
  const battle: BattleRecord = await (
    await request.get('/data/battles/events/Q9347968.json')
  ).json();
  const index: BattleIndex = await (await request.get('/data/battles/index.json')).json();
  const entry = index.battles.find((item) => item.id === 'Q9347968');
  expect(entry).toBeDefined();
  for (const record of [battle, entry!]) {
    expect(record.start).toEqual({ year: 1877, month: 3, day: 4 });
    expect(record.end).toEqual({ year: 1877, month: 3, day: 20 });
    expect(record.coords).toEqual([130.6516, 32.9127]);
  }
  expect(entry!.documented).toBe(false);
  expect(battle.missing ?? []).not.toContain('missing-coordinates');
  expect(battle.metadataReview).toMatchObject({
    fields: ['start', 'coords'],
    before: {
      start: { year: 1877, month: 3, day: 3 },
      end: { year: 1877, month: 3, day: 20 },
      coords: null,
    },
  });
  expect(battle.coordinateSource).toMatchObject({
    kind: 'reviewed',
    url: 'https://kumamoto-guide.jp/en/spots/detail/216',
  });
  expect(battle.participants.map((army) => army.id)).toEqual([
    'Q9347968:government-forces',
    'Q9347968:satsuma-rebels',
  ]);
  for (const army of battle.participants) {
    expect(army.medium).toBe('land');
    expect(army.strength).toEqual([]);
    expect(army.deaths).toEqual([]);
    expect(army.casualties).toEqual([]);
    expect(army.profileId).toBeUndefined();
  }
  await page.goto('/?battle=1&e=Q9347968&y=1877&lon=130.6516&lat=32.9127&z=16&pitch=60&lang=en');
  const map = page.locator('[data-battle-status]');
  await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
  await expect(map).toHaveAttribute('data-battle-rendered', 'true');
  await expect(map).toHaveAttribute('data-battle-models', '20');
  const detail = page.getByTestId('battle-detail');
  await expect(detail).toHaveAttribute('data-battle-id', 'Q9347968');
  await expect(detail.locator('.battle-location')).toContainText('32.9127°, 130.6516°');
  await expect(detail.locator('.battle-location')).toContainText(
    'no tactical precision is asserted',
  );
  await expect(detail.getByTestId('battle-unknown-strength-notice')).toContainText(
    'unknown strength, no historical proportions',
  );
  const rows = detail.getByTestId('battle-army');
  await expect(rows).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    await expect(rows.nth(i).locator('.battle-quantity')).toHaveCount(0);
    await expect(rows.nth(i).locator('.battle-unknown')).toHaveCount(3);
    await expect(rows.nth(i).getByTestId('battle-model-states').locator('dd')).toHaveText([
      '10',
      '0',
      '0',
    ]);
  }
  await page.getByTestId('battle-play').click();
  await expect
    .poll(async () => Number(await map.getAttribute('data-battle-progress')))
    .toBeGreaterThan(0.05);
  await page.getByTestId('battle-play').click();
  await page.getByRole('slider', { name: 'Animation progress' }).fill('1000');
  for (let i = 0; i < 2; i++)
    await expect(rows.nth(i).getByTestId('battle-model-states').locator('dd')).toHaveText([
      '10',
      '0',
      '0',
    ]);
  await expect(detail.getByTestId('battle-loss-share')).toHaveCount(0);
});
