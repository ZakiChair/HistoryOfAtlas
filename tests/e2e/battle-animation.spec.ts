import { expect, test } from '@playwright/test';
import type { BattleIndex, BattleRecord } from '../../lib/battles/schema';

test('the catalogue finds source-classified sea and air battles in the matching filters', async ({
  page,
}) => {
  await page.goto('/?battle=1&lang=en');
  const search = page.getByRole('textbox', { name: 'Search all battles…' });
  const types = page.getByRole('combobox', { name: 'All types' });
  await search.fill('Q702150');
  await types.selectOption('naval');
  await expect(page.getByTestId('battle-open-Q702150')).toBeVisible();
  await types.selectOption('battle');
  await expect(page.getByTestId('battle-open-Q702150')).not.toBeAttached();
  await search.fill('Q2603955');
  await types.selectOption('air');
  await expect(page.getByTestId('battle-open-Q2603955')).toBeVisible();
  await expect(page.getByTestId('battle-open-Q2603955')).toContainText('Air battles');
  await types.selectOption('naval');
  await expect(page.getByTestId('battle-open-Q2603955')).not.toBeAttached();
});

test('allied formations share the same notebook colour as their map camp', async ({
  page,
  request,
}) => {
  const battle: BattleRecord = await (await request.get('/data/battles/events/Q31900.json')).json();
  await page.goto(
    `/?${new URLSearchParams({ battle: '1', e: battle.id, y: String(battle.start!.year), lon: String(battle.coords![0]), lat: String(battle.coords![1]), z: '15.5', lang: 'en' })}`,
  );
  const rows = page.getByTestId('battle-army');
  await expect(rows).toHaveCount(3);
  // Athens and Plataea are the first two forces and share the Greek camp;
  // the third formation is Persian, matching the renderer's camp ordering.
  await expect(rows.nth(0).locator('.battle-army-dot')).toHaveClass(/army-0/);
  await expect(rows.nth(1).locator('.battle-army-dot')).toHaveClass(/army-0/);
  await expect(rows.nth(2).locator('.battle-army-dot')).toHaveClass(/army-1/);
});

test('reopening a paused battlefield restores its controls and model census', async ({ page }) => {
  await page.goto('/?battle=1&e=Q48314&y=1815&lon=4.4122&lat=50.6781&z=15.5&lang=en');
  await expect(page.locator('[data-battle-status]')).toHaveAttribute(
    'data-battle-status',
    'ready',
    { timeout: 45_000 },
  );
  await expect(page.getByTestId('battle-play')).toBeEnabled();
  await page.getByRole('button', { name: 'Collapse notebook', exact: true }).click();
  await expect(page.getByTestId('battle-detail')).not.toBeAttached();
  await page.getByRole('button', { name: 'Open notebook', exact: true }).click();
  await expect(page.getByTestId('battle-play')).toBeEnabled();
  await expect(page.getByTestId('battle-model-states').first()).toBeAttached();
});

test('unknown forces have an explicitly illustrative animated formation without invented strengths', async ({
  page,
  request,
}) => {
  const battle: BattleRecord = await (
    await request.get('/data/battles/events/Q126325733.json')
  ).json();
  expect(battle.participants).toEqual([]);
  expect(battle.totals.strength).toEqual([]);
  await page.goto(
    `/?${new URLSearchParams({ battle: '1', e: battle.id, y: String(battle.start!.year), lon: String(battle.coords![0]), lat: String(battle.coords![1]), z: '15.5', pitch: '60', lang: 'en' })}`,
  );
  const map = page.locator('[data-battle-status]');
  await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
  expect(Number(await map.getAttribute('data-battle-models'))).toBeGreaterThan(1);
  await expect(page.getByTestId('battle-unknown-strength-notice')).toContainText(
    'unknown strength, no historical proportions',
  );
  await expect(page.getByTestId('battle-illustrative-formation')).toContainText(
    'unknown strength, no historical proportions',
  );
  await page.getByTestId('battle-play').click();
  await expect
    .poll(async () => Number(await map.getAttribute('data-battle-progress')))
    .toBeGreaterThan(0.025);
  await expect(page.getByTestId('battle-scale')).not.toBeAttached();
});

test('sourced losses smaller than one figure remain visible as a proportional share', async ({
  page,
}) => {
  await page.goto('/?battle=1&e=Q1123353&y=1879&lon=30.5366&lat=-28.358&z=15.5&pitch=60&lang=en');
  await expect(page.locator('[data-battle-status]')).toHaveAttribute(
    'data-battle-status',
    'ready',
    { timeout: 45_000 },
  );
  await page.getByRole('slider', { name: 'Animation progress' }).fill('1000');
  const share = page.getByTestId('battle-loss-share').first();
  await expect(share).toContainText('11.3%');
  await expect(share.locator('.battle-loss-dead')).toHaveAttribute('style', /11\.333/);
  await page.getByRole('slider', { name: 'Animation progress' }).fill('0');
  await expect(share.locator('.battle-loss-dead')).toHaveAttribute('style', 'width: 0%;');
});

test('the full battle catalogue is opt-in and searchable across historical periods', async ({
  page,
  request,
}) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(new URL(request.url()).pathname));
  await page.goto('/?y=1815');
  await expect(page.getByTestId('year-slider')).toBeVisible();
  expect(requested.some((path) => path.startsWith('/models/battles/'))).toBe(false);
  expect(requested.includes('/data/battles/index.json')).toBe(false);
  await page.getByTestId('battle-mode-toggle').click();
  const index: BattleIndex = await (await request.get('/data/battles/index.json')).json();
  expect(index.counts.total).toBeGreaterThanOrEqual(16828);
  await expect(page.locator('.battle-result-count')).toHaveText(
    `${index.counts.total.toLocaleString('en')} results`,
  );
  await page.getByRole('textbox', { name: 'Search all battles…' }).fill('Hastings');
  await expect(page.getByTestId('battle-open-Q83224')).toBeVisible();
  await page.getByTestId('battle-open-Q83224').click();
  await expect(page.getByTestId('battle-detail')).toHaveAttribute('data-battle-id', 'Q83224');
  await expect(page.getByTestId('year-slider')).toHaveAttribute('aria-valuetext', '1066');
});

for (const projection of ['globe', 'mercator']) {
  test(`3D armies render, animate, pause and seek at sourced Waterloo coordinates on ${projection}`, async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(90_000);
    if (testInfo.project.name === 'chromium')
      await page.setViewportSize({ width: 1440, height: 960 });
    const battle: BattleRecord = await (
      await request.get('/data/battles/events/Q48314.json')
    ).json();
    const errors: string[] = [];
    const models: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (request.url().endsWith('.glb')) models.push(request.url());
    });
    const params = new URLSearchParams({
      battle: '1',
      e: battle.id,
      y: String(battle.start!.year),
      lon: String(battle.coords![0]),
      lat: String(battle.coords![1]),
      z: '15.5',
      pitch: '60',
      projection,
      lang: 'en',
    });
    await page.goto(`/?${params}`);
    const map = page.locator('[data-battle-status]');
    await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
    await expect(map).toHaveAttribute('data-battle-rendered', 'true');
    await expect(map).toHaveAttribute('data-battle-event', battle.id);
    expect(Number(await map.getAttribute('data-battle-models'))).toBeGreaterThan(20);
    expect(models.some((url) => url.includes('napoleonic'))).toBe(true);
    await expect(page.getByTestId('battle-play')).toHaveText('Animate armies');
    await expect(page.getByTestId('timeline-play')).toHaveAttribute('aria-label', 'Play timeline');
    const canvas = page.locator('.maplibregl-canvas');
    const before = await canvas.screenshot();
    await page.getByTestId('battle-play').click();
    await expect
      .poll(async () => Number(await map.getAttribute('data-battle-progress')))
      .toBeGreaterThan(0.025);
    const during = await canvas.screenshot();
    expect(before.equals(during), 'Actual map pixels must change when the 3D army moves').toBe(
      false,
    );
    await page.getByTestId('battle-play').click();
    await expect(page.getByTestId('battle-play')).toHaveText('Animate armies');
    const paused = await map.getAttribute('data-battle-progress');
    await page.waitForTimeout(400);
    await expect(map).toHaveAttribute('data-battle-progress', paused!);
    await page.getByRole('slider', { name: 'Animation progress' }).fill('850');
    await expect(map).toHaveAttribute('data-battle-progress', '0.850');
    await expect(page.getByTestId('battle-progress')).toHaveText('85%');
    await expect.poll(() => new URL(page.url()).searchParams.get('bphase')).toBe('0.85');
    await page.reload();
    await expect(page.getByTestId('battle-play')).toHaveText('Animate armies');
    await expect(page.getByTestId('battle-progress')).toHaveText('85%');
    expect(errors).toEqual([]);
  });
}

test('reduced-motion visits stay paused, languages translate controls, and leaving releases the scene', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?battle=1&e=Q48314&y=1815&lon=4.412&lat=50.68&z=15.5&pitch=60&lang=fr');
  await expect(page.getByTestId('battle-play')).toHaveText('Animer les armées');
  for (const [locale, play] of [
    ['de', 'Armeen animieren'],
    ['es', 'Animar ejércitos'],
    ['zh', '播放军队动画'],
    ['ru', 'Оживить армии'],
  ]) {
    await page.getByTestId('language-select').selectOption(locale);
    await expect(page.getByTestId('battle-play')).toHaveText(play);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.getByTestId('battle-mode-toggle').click();
  await expect(page.getByTestId('battle-detail')).not.toBeAttached();
  await expect(page.locator('[data-battle-status]')).toHaveAttribute('data-battle-models', '0');
});

test('a catalogue record without a date or location never creates a fictitious battlefield', async ({
  page,
  request,
}) => {
  const index: BattleIndex = await (await request.get('/data/battles/index.json')).json();
  const incomplete = index.battles.find((battle) => !battle.coords || !battle.start)!;
  expect(incomplete).toBeTruthy();
  await page.goto(`/?battle=1&e=${incomplete.id}&lang=en`);
  await expect(page.getByTestId('battle-detail')).toHaveAttribute('data-battle-id', incomplete.id);
  await expect(page.getByTestId('battle-playback')).not.toBeAttached();
  await expect(page.locator('.battle-detail')).toContainText('Date or location missing');
  await expect(page.locator('[data-battle-status]')).toHaveAttribute(
    'data-battle-status',
    'empty',
    { timeout: 30_000 },
  );
  await expect(page.locator('[data-battle-status]')).toHaveAttribute('data-battle-models', '0');
});

test('naval forces use sourced ship counts and remain separate from personnel casualties', async ({
  page,
  request,
}) => {
  const battle: BattleRecord = await (
    await request.get('/data/battles/events/Q171416.json')
  ).json();
  const params = new URLSearchParams({
    battle: '1',
    e: battle.id,
    y: String(battle.start!.year),
    lon: String(battle.coords![0]),
    lat: String(battle.coords![1]),
    z: '14.4',
    pitch: '60',
    lang: 'en',
  });
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto(`/?${params}`);
  await expect(page.locator('[data-battle-status]')).toHaveAttribute(
    'data-battle-status',
    'ready',
    { timeout: 30_000 },
  );
  expect(requested.some((url) => url.endsWith('/sailing-warship.glb'))).toBe(true);
  const armies = page.getByTestId('battle-army');
  await expect(armies).toHaveCount(2);
  await expect(armies.nth(0)).toContainText('27 ships');
  await expect(armies.nth(1)).toContainText('33 ships');
  await page.getByRole('slider', { name: 'Animation progress' }).fill('1000');
  await expect(page.getByTestId('battle-progress')).toHaveText('100%');
});

test('the visible model census follows sourced losses and reverses when seeking backwards', async ({
  page,
}) => {
  await page.goto('/?battle=1&e=Q48314&y=1815&lon=4.4122&lat=50.6781&z=15.5&pitch=60&lang=en');
  await expect(page.locator('[data-battle-status]')).toHaveAttribute(
    'data-battle-status',
    'ready',
    { timeout: 45_000 },
  );
  const census = page.getByTestId('battle-model-states').first();
  await expect(census).toBeVisible();
  const counts = async () => (await census.locator('dd').allTextContents()).map(Number);
  const initial = await counts();
  expect(initial[0]).toBeGreaterThan(10);
  expect(initial.slice(1)).toEqual([0, 0]);
  await page.getByRole('slider', { name: 'Animation progress' }).fill('1000');
  const withdrawn = Math.round((initial[0] * 40000) / 72000);
  await expect.poll(counts).toEqual([initial[0] - withdrawn, withdrawn, 0]);
  await page.getByRole('slider', { name: 'Animation progress' }).fill('0');
  await expect.poll(counts).toEqual(initial);
});

test('space controls the selected reconstruction without advancing historical time', async ({
  page,
}) => {
  await page.goto('/?battle=1&e=Q48314&y=1815&lon=4.4122&lat=50.6781&z=15.5&lang=en');
  await expect(page.locator('[data-battle-status]')).toHaveAttribute(
    'data-battle-status',
    'ready',
    { timeout: 45_000 },
  );
  await page.getByTestId('battle-detail').getByRole('heading', { level: 2 }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('battle-play')).toHaveText('Pause animation');
  await expect(page.getByTestId('timeline-play')).toHaveAttribute('aria-label', 'Play timeline');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('battle-play')).toHaveText('Animate armies');
  await expect(page.getByTestId('year-slider')).toHaveAttribute('aria-valuetext', '1815');
});
