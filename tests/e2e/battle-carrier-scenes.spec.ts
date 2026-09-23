import { expect, test } from '@playwright/test';

for (const scene of [
  {
    id: 'Q173034',
    year: 1942,
    coords: [-178, 30],
    strengths: [3, 4],
    survivors: [2, 0],
    removed: [1, 4],
    armies: 6,
  },
  {
    id: 'Q207165',
    year: 1942,
    coords: [162.33333333333, -16.266666666667],
    strengths: [2, 3],
    survivors: [1, 2],
    removed: [1, 1],
    armies: 7,
  },
] as const) {
  test(`carrier cohorts retain sourced proportions beside unquantified aviation at ${scene.id}`, async ({
    page,
  }, testInfo) => {
    const assets: string[] = [];
    const errors: string[] = [];
    page.on('requestfinished', (request) => {
      if (request.url().endsWith('.glb')) assets.push(request.url());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(
      `/?${new URLSearchParams({ battle: '1', e: scene.id, y: String(scene.year), lon: String(scene.coords[0]), lat: String(scene.coords[1]), z: '15.5', pitch: '60', lang: 'en' })}`,
    );
    const map = page.locator('[data-battle-status]');
    await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
    await expect(map).toHaveAttribute('data-battle-rendered', 'true');
    const rows = page.getByTestId('battle-army');
    await expect(rows).toHaveCount(scene.armies);
    const states = (i: number) => rows.nth(i).getByTestId('battle-model-states').locator('dd');
    for (let i = 0; i < 2; i++) {
      await expect(states(i)).toHaveText([String(scene.strengths[i]), '0', '0']);
      await expect(rows.nth(i).getByTestId('battle-scale')).toContainText('1 ships');
      await expect(rows.nth(i).locator('.battle-quantity > a').first()).toHaveText(
        `${scene.strengths[i]} ships`,
      );
    }
    const unknownInitial: string[][] = [];
    for (let i = 2; i < scene.armies; i++) {
      const values = await states(i).allTextContents();
      expect(Number(values[0])).toBeGreaterThan(0);
      expect(values.slice(1)).toEqual(['0', '0']);
      unknownInitial.push(values);
      await expect(rows.nth(i).getByTestId('battle-scale')).toContainText('unknown strength');
    }
    for (const path of [
      '/models/battles/ww2-straight-deck-carrier.glb',
      '/models/battles/propeller-aircraft.glb',
    ])
      expect(assets.some((url) => url.endsWith(path))).toBe(true);
    await testInfo.attach('carrier-and-air-formation', {
      body: await page.locator('.maplibregl-canvas').screenshot(),
      contentType: 'image/png',
    });
    await page.getByRole('slider', { name: 'Animation progress' }).fill('1000');
    for (let i = 0; i < 2; i++)
      await expect(states(i)).toHaveText([
        String(scene.survivors[i]),
        String(scene.removed[i]),
        '0',
      ]);
    for (let i = 2; i < scene.armies; i++)
      await expect(states(i)).toHaveText(unknownInitial[i - 2]);
    const cap = testInfo.project.name.startsWith('mobile') ? 36 : 80;
    expect(Number(await map.getAttribute('data-battle-models'))).toBeLessThanOrEqual(cap);
    expect(errors).toEqual([]);
  });
}
