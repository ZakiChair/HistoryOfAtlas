import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { BattleIndex, BattleRecord } from '../../lib/battles/schema';
import { UNIT_PROFILES, type UnitProfileId } from '../../lib/battles/units';

const index = JSON.parse(readFileSync('public/data/battles/index.json', 'utf8')) as BattleIndex;

for (const entry of index.battles.filter((battle) => battle.documented)) {
  test(`reviewed armies, equipment and casualties render for ${entry.id} (${entry.name.en})`, async ({
    page,
    request,
  }, testInfo) => {
    const battle: BattleRecord = await (
      await request.get(`/data/battles/events/${entry.id}.json`)
    ).json();
    if (!battle.start || !battle.coords) {
      await page.goto(`/?${new URLSearchParams({ battle: '1', e: battle.id, lang: 'en' })}`);
      const detail = page.getByTestId('battle-detail');
      await expect(detail).toHaveAttribute('data-battle-id', battle.id);
      await expect(detail).toContainText('Date or location missing');
      await expect(page.getByTestId('battle-play')).toHaveCount(0);
      for (const army of battle.participants) await expect(detail).toContainText(army.name.en);
      const sourcedShips = battle.participants.flatMap((army) =>
        [...army.strength, ...army.casualties].filter((value) => value.counts === 'ships'),
      );
      for (const quantity of sourcedShips)
        await expect(
          detail
            .locator('.battle-quantity > a')
            .filter({
              hasText: new RegExp(`^${quantity.value.toLocaleString('en')} ships$`),
            })
            .first(),
        ).toBeVisible();
      await expect(detail.getByTestId('battle-scale')).toHaveCount(0);
      await expect(page.locator('[data-battle-rendered="true"]')).toHaveCount(0);
      return;
    }
    const loaded: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('.glb')) loaded.push(request.url());
    });
    await page.goto(
      `/?${new URLSearchParams({ battle: '1', e: battle.id, y: String(battle.start!.year), lon: String(battle.coords![0]), lat: String(battle.coords![1]), z: battle.medium === 'land' ? '15.5' : '14.4', pitch: '60', lang: 'en' })}`,
    );
    const map = page.locator('[data-battle-status]');
    await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
    await expect(map).toHaveAttribute('data-battle-rendered', 'true');
    const armies = battle.participants.filter(
      (army) => army.kind === 'polity' || army.kind === 'military-unit',
    );
    const rows = page.getByTestId('battle-army');
    await expect(rows).toHaveCount(armies.length);
    const counts = (position: number) =>
      rows
        .nth(position)
        .getByTestId('battle-model-states')
        .locator('dd')
        .allTextContents()
        .then((values) => values.map(Number));
    let total = 0;
    const allocations: number[] = [];
    for (let position = 0; position < armies.length; position++) {
      await expect(rows.nth(position)).toContainText(armies[position].name.en);
      const initial = await counts(position);
      expect(initial[0], armies[position].name.en).toBeGreaterThan(0);
      expect(initial.slice(1)).toEqual([0, 0]);
      allocations.push(initial[0]);
      total += initial[0];
      if (armies[position].profileId) {
        const profile = UNIT_PROFILES[armies[position].profileId as UnitProfileId];
        expect(profile).toBeDefined();
        expect(loaded.some((path) => path.endsWith(profile.modelUrl))).toBe(true);
      }
    }
    expect(total).toBe(Number(await map.getAttribute('data-battle-models')));
    await testInfo.attach('initial-formation', {
      body: await page.locator('.maplibregl-canvas').screenshot(),
      contentType: 'image/png',
    });
    await page.getByRole('slider', { name: 'Animation progress' }).fill('1000');
    for (let position = 0; position < armies.length; position++) {
      const army = armies[position];
      const medium = army.medium ?? battle.medium;
      const unit = medium === 'naval' ? 'ships' : medium === 'air' ? 'aircraft' : 'soldiers';
      const strength = army.strength.find(
        (value) => value.renderable && value.counts === unit,
      )?.value;
      if (!strength) {
        await expect.poll(() => counts(position)).toEqual([allocations[position], 0, 0]);
        continue;
      }
      const deaths =
        army.deaths.find((value) => value.renderable && value.counts === unit)?.value ?? 0;
      const losses =
        army.casualties.find((value) => value.renderable && value.counts === unit)?.value ?? deaths;
      const dead = Math.round((allocations[position] * deaths) / strength);
      const removed = Math.round((allocations[position] * losses) / strength);
      await expect
        .poll(() => counts(position))
        .toEqual([allocations[position] - removed, removed - dead, dead]);
    }
    await testInfo.attach('final-formation', {
      body: await page.locator('.maplibregl-canvas').screenshot(),
      contentType: 'image/png',
    });
  });
}
