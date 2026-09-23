import { expect, test } from '@playwright/test';
import type { BattleRecord } from '../../lib/battles/schema';

test('overview armies use the actual globe and survive projection changes', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?battle=1&y=1815&lon=4.412&lat=50.678&z=5&lang=en&projection=globe');
  const map = page.locator('[data-battle-status]');
  await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
  await expect(map).toHaveAttribute('data-battle-projection', 'globe');
  await expect(map).toHaveAttribute('data-battle-rendered', 'true');
  expect(Number(await map.getAttribute('data-battle-models'))).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Flat map', exact: true }).click();
  await expect(map).toHaveAttribute('data-battle-projection', 'mercator');
  await expect(map).toHaveAttribute('data-battle-rendered', 'true');
  await page.getByRole('button', { name: 'Globe', exact: true }).click();
  await expect(map).toHaveAttribute('data-battle-projection', 'globe');
  await expect(map).toHaveAttribute('data-battle-rendered', 'true');
});

test('disabling battles during a unit download cannot resurrect the disposed scene', async ({
  page,
}) => {
  test.setTimeout(90_000);
  let releaseDownload = () => {};
  let downloading = false;
  const held = new Promise<void>((resolve) => {
    releaseDownload = resolve;
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/models/battles/napoleonic-infantry.glb', async (route) => {
    downloading = true;
    await held;
    await route.continue();
  });
  try {
    await page.goto('/?battle=1&e=Q48314&y=1815&lon=4.412&lat=50.678&z=15.5&pitch=60&lang=en', {
      waitUntil: 'domcontentloaded',
    });
    await expect.poll(() => downloading, { timeout: 45_000 }).toBe(true);
    await page.getByTestId('battle-mode-toggle').click();
    const map = page.locator('[data-battle-status]');
    await expect(map).toHaveAttribute('data-battle-models', '0');
    const response = page.waitForResponse('**/models/battles/napoleonic-infantry.glb');
    releaseDownload();
    await response;
    await expect(map).toHaveAttribute('data-battle-rendered', 'false');
    await expect(map).toHaveAttribute('data-battle-event', '');
    await page.getByTestId('battle-mode-toggle').click();
    await page.getByRole('textbox', { name: 'Search all battles…' }).fill('Waterloo');
    await page.getByTestId('battle-open-Q48314').click();
    await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
    await expect(map).toHaveAttribute('data-battle-rendered', 'true');
    await expect(map).toHaveAttribute('data-battle-event', 'Q48314');
    expect(errors).toEqual([]);
  } finally {
    releaseDownload();
  }
});

test('a scene with no known soldiers never reports rendered armies', async ({ page, request }) => {
  const battle: BattleRecord = await (await request.get('/data/battles/events/Q48314.json')).json();
  for (const participant of battle.participants) {
    participant.strength = participant.strength.map((quantity) => ({ ...quantity, value: 0 }));
    participant.casualties = [];
    participant.deaths = [];
  }
  await page.route('**/data/battles/events/Q48314.json', (route) =>
    route.fulfill({ json: battle }),
  );
  await page.goto('/?battle=1&e=Q48314&y=1815&lon=4.412&lat=50.678&z=15.5&pitch=60&lang=en');
  const map = page.locator('[data-battle-status]');
  await expect(map).toHaveAttribute('data-battle-status', 'empty', { timeout: 45_000 });
  await expect(map).toHaveAttribute('data-battle-models', '0');
  await expect(map).toHaveAttribute('data-battle-rendered', 'false');
});

test('a failed unit asset can be retried without changing the selected battle', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const battle: BattleRecord = await (await request.get('/data/battles/events/Q48314.json')).json();
  let attempts = 0;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/models/battles/napoleonic-infantry.glb', async (route) => {
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 503, body: 'Temporary asset outage' });
    else await route.continue();
  });
  const params = new URLSearchParams({
    battle: '1',
    e: battle.id,
    y: String(battle.start!.year),
    lon: String(battle.coords![0]),
    lat: String(battle.coords![1]),
    z: '15.5',
    pitch: '60',
    lang: 'en',
  });
  await page.goto(`/?${params}`);
  const map = page.locator('[data-battle-status]');
  await expect(map).toHaveAttribute('data-battle-status', 'error', { timeout: 45_000 });
  await expect(page.getByTestId('battle-play')).toBeDisabled();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
  await expect(map).toHaveAttribute('data-battle-rendered', 'true');
  await expect(map).toHaveAttribute('data-battle-event', battle.id);
  expect(Number(await map.getAttribute('data-battle-models'))).toBeGreaterThan(20);
  expect(attempts).toBe(2);
  expect(errors).toEqual([]);
});
