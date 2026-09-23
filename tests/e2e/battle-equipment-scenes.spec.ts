import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { BattleIndex, BattleRecord } from '../../lib/battles/schema';
import { UNIT_PROFILES, type UnitProfileId } from '../../lib/battles/units';
import type { BattleEquipmentRecord } from '../../pipeline/battles/equipment';

const index = JSON.parse(readFileSync('public/data/battles/index.json', 'utf8')) as BattleIndex;
const equipment = JSON.parse(readFileSync('data/curated/battle-equipment.json', 'utf8')) as {
  records: Record<string, BattleEquipmentRecord>;
};

for (const [id, patch] of Object.entries(equipment.records)) {
  const entry = index.battles.find((battle) => battle.id === id);
  if (!entry?.coords || !entry.start) continue;
  test(`sourced equipment renders at ${id} (${entry.name.en})`, async ({
    page,
    request,
  }, testInfo) => {
    const record: BattleRecord = await (
      await request.get(`/data/battles/events/${id}.json`)
    ).json();
    const armies = record.participants.filter((army) =>
      ['polity', 'military-unit'].includes(army.kind),
    );
    const expectedProfiles = armies.length
      ? (patch.participants ?? [])
          .filter((assignment) => armies.some((army) => army.id === assignment.id))
          .flatMap((assignment) => (assignment.profileId ? [assignment.profileId] : []))
      : patch.profileId
        ? [patch.profileId]
        : [];
    const loaded: string[] = [];
    const errors: string[] = [];
    page.on('requestfinished', (request) => {
      if (request.url().endsWith('.glb')) loaded.push(request.url());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(
      `/?${new URLSearchParams({ battle: '1', e: id, y: String(entry.start!.year), lon: String(entry.coords![0]), lat: String(entry.coords![1]), z: '15.5', pitch: '60', lang: 'en' })}`,
    );
    const map = page.locator('[data-battle-status]');
    await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
    await expect(map).toHaveAttribute('data-battle-rendered', 'true');
    expect(Number(await map.getAttribute('data-battle-models'))).toBeGreaterThan(0);
    for (const profileId of new Set(expectedProfiles)) {
      const profile = UNIT_PROFILES[profileId as UnitProfileId];
      expect(profile, profileId).toBeDefined();
      expect(
        loaded.some((url) => url.endsWith(profile.modelUrl)),
        profileId,
      ).toBe(true);
    }
    await testInfo.attach('equipment-formation', {
      body: await page.locator('.maplibregl-canvas').screenshot(),
      contentType: 'image/png',
    });
    await page.getByTestId('battle-play').click();
    await expect
      .poll(async () => Number(await map.getAttribute('data-battle-progress')))
      .toBeGreaterThan(0.025);
    await page.getByTestId('battle-play').click();
    expect(errors).toEqual([]);
  });
}
