import { expect, test } from '@playwright/test';
import type { BattleParticipant, BattleRecord } from '../../lib/battles/schema';

test('a coastal scene renders soldiers and ships with their own equipment, scales and losses', async ({
  page,
  request,
}, testInfo) => {
  const record: BattleRecord = await (
    await request.get('/data/battles/events/Q171416.json')
  ).json();
  const source = { label: 'Controlled rendering fixture', url: 'https://example.org/fixture' };
  const force = (id: string, medium: 'land' | 'naval', strength: number): BattleParticipant => ({
    id,
    name: { en: id },
    kind: 'military-unit',
    sideId: id,
    medium,
    profileId: medium === 'land' ? 'napoleonic-infantry' : 'sailing-warship',
    strength: [
      {
        value: strength,
        counts: medium === 'land' ? 'soldiers' : 'ships',
        scope: 'participant',
        renderable: true,
        sources: [source],
      },
    ],
    casualties: [
      {
        value: strength / 2,
        counts: medium === 'land' ? 'soldiers' : 'ships',
        scope: 'participant',
        renderable: true,
        sources: [source],
      },
    ],
    deaths: [],
    sources: [source],
  });
  // Synthetic source boundary fixture: both selected equipment families are
  // eligible in 1810. The real catalogue date and participants remain unchanged.
  record.start = { year: 1810 };
  delete record.end;
  record.participants = [force('Test fleet', 'naval', 12), force('Test shore force', 'land', 6000)];
  await page.route('**/data/battles/events/Q171416.json', (route) =>
    route.fulfill({ json: record }),
  );
  await page.goto(
    `/?${new URLSearchParams({ battle: '1', e: record.id, y: String(record.start!.year), lon: String(record.coords![0]), lat: String(record.coords![1]), z: '15.5', pitch: '60', lang: 'en' })}`,
  );
  const map = page.locator('[data-battle-status]');
  await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
  await expect(map).toHaveAttribute('data-battle-rendered', 'true');
  const rows = page.getByTestId('battle-army');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByTestId('battle-scale')).toContainText('1 ships');
  await expect(rows.nth(1).getByTestId('battle-scale')).toContainText('1,000 soldiers');
  await expect(rows.nth(0).locator('.battle-equipment')).toContainText('sailing warship');
  await expect(rows.nth(1).locator('.battle-equipment')).toContainText(
    'Napoleonic shako-and-musket infantry',
  );
  await expect(map).toHaveAttribute('data-battle-models', '18');
  await testInfo.attach('mixed-force-formation', {
    body: await page.locator('.maplibregl-canvas').screenshot(),
    contentType: 'image/png',
  });
  await page.getByRole('slider', { name: 'Animation progress' }).fill('1000');
  await expect(rows.nth(0).getByTestId('battle-model-states').locator('dd')).toHaveText([
    '6',
    '6',
    '0',
  ]);
  await expect(rows.nth(1).getByTestId('battle-model-states').locator('dd')).toHaveText([
    '3',
    '3',
    '0',
  ]);
  await expect(rows.nth(0).getByTestId('battle-loss-share')).toContainText('50%');
  await expect(rows.nth(1).getByTestId('battle-loss-share')).toContainText('50%');
});
