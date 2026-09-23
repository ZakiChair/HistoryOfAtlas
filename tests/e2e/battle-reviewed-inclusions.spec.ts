import { expect, test, type Page } from '@playwright/test';
import type { GeoJSONSource, Map as HistoricalMap } from 'maplibre-gl';
import type { BattleIndex, BattleRecord } from '../../lib/battles/schema';

// Read the real catalogue source, including off-screen points. A rendered-feature
// query could falsely pass merely because an invented marker is outside the camera.
async function catalogueMarkerIds(page: Page, ids: string[]) {
  return page.evaluate(async (ids) => {
    type Hook = { memoizedState?: { current?: HistoricalMap }; next?: Hook };
    type Fiber = { memoizedState?: Hook; return?: Fiber };
    const element = document.querySelector('.world-map');
    if (!element) return null;
    const key = Object.keys(element).find((key) => key.startsWith('__reactFiber'));
    if (!key) return null;
    let fiber = (element as unknown as Record<string, Fiber>)[key];
    for (; fiber; fiber = fiber.return!) {
      for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const map = hook.memoizedState?.current;
        if (!map || typeof map.getSource !== 'function') continue;
        const source = map.getSource<GeoJSONSource>('battle-catalogue');
        if (!source || typeof source.getData !== 'function') return null;
        const data = await source.getData();
        if (data.type !== 'FeatureCollection' || !data.features.length) return null;
        return data.features
          .map((feature) => String(feature.properties?.id))
          .filter((id) => ids.includes(id))
          .sort();
      }
    }
    return null;
  }, ids);
}

test('Saint-Paul keeps six ships and approximately 600 landing troops separate from two unquantified French groups', async ({
  page,
  request,
}) => {
  const response = await request.get('/data/battles/events/Q2869902.json');
  expect(response.ok()).toBe(true);
  const battle: BattleRecord = await response.json();
  const index: BattleIndex = await (await request.get('/data/battles/index.json')).json();
  const entry = index.battles.find((item) => item.id === 'Q2869902');
  expect(entry).toBeDefined();
  expect(entry!.documented).toBe(false);
  expect(battle.start).toEqual({ year: 1809, month: 9, day: 21 });
  expect(battle.end).toEqual({ year: 1809, month: 9, day: 28 });
  expect(battle.coords).toEqual([55.266666666667, -21]);

  const expectedForces = [
    {
      id: 'saint-paul-british-squadron',
      name: 'British squadron under Rowley',
      medium: 'naval',
      side: 'british',
      models: 6,
    },
    {
      id: 'saint-paul-british-landing-force',
      name: 'British landing force under Keating',
      medium: 'land',
      side: 'british',
      models: 1,
    },
    {
      id: 'saint-paul-french-naval-force',
      name: 'French naval defenders at Saint-Paul',
      medium: 'naval',
      side: 'french',
      models: 10,
    },
    {
      id: 'saint-paul-french-shore-defenders',
      name: 'French shore defenders at Saint-Paul',
      medium: 'land',
      side: 'french',
      models: 10,
    },
  ];
  expect(battle.participants.map((force) => force.id)).toEqual(
    expectedForces.map((force) => force.id),
  );
  expect(battle.participants[0].strength).toHaveLength(1);
  expect(battle.participants[0].strength[0]).toMatchObject({
    value: 6,
    counts: 'ships',
    scope: 'participant',
    renderable: true,
  });
  expect(battle.participants[1].strength).toHaveLength(1);
  expect(battle.participants[1].strength[0]).toMatchObject({
    value: 600,
    approximate: true,
    counts: 'soldiers',
    scope: 'participant',
    renderable: true,
  });
  for (let i = 0; i < expectedForces.length; i++) {
    const force = battle.participants[i];
    expect(force.medium).toBe(expectedForces[i].medium);
    expect(force.sideId).toBe(expectedForces[i].side);
    expect(force.casualties).toEqual([]);
    expect(force.deaths).toEqual([]);
    if (i >= 2) expect(force.strength).toEqual([]);
  }
  expect(battle.totals).toEqual({ strength: [], casualties: [], deaths: [] });
  for (const observations of Object.values(battle.unassigned ?? {}))
    expect(observations).toEqual([]);

  await page.goto(
    '/?battle=1&e=Q2869902&y=1809&lon=55.266666666667&lat=-21&z=15.5&pitch=60&lang=en',
  );
  const map = page.locator('[data-battle-status]');
  await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
  await expect(map).toHaveAttribute('data-battle-rendered', 'true');
  await expect(map).toHaveAttribute('data-battle-models', '27');
  const detail = page.getByTestId('battle-detail');
  await expect(detail).toHaveAttribute('data-battle-id', 'Q2869902');
  await expect(detail.getByTestId('battle-unknown-strength-notice')).toContainText(
    'unknown strength, no historical proportions',
  );
  const rows = detail.getByTestId('battle-army');
  await expect(rows).toHaveCount(4);
  const state = (i: number) => rows.nth(i).getByTestId('battle-model-states').locator('dd');
  for (let i = 0; i < expectedForces.length; i++) {
    await expect(rows.nth(i).getByRole('heading', { name: expectedForces[i].name })).toBeVisible();
    await expect(state(i)).toHaveText([String(expectedForces[i].models), '0', '0']);
    await expect(rows.nth(i).locator('.battle-unknown')).toHaveCount(i < 2 ? 2 : 3);
    if (i >= 2) {
      await expect(rows.nth(i).getByTestId('battle-scale')).toContainText('unknown strength');
      await expect(rows.nth(i).locator('.battle-quantity')).toHaveCount(0);
    }
  }
  await expect(rows.nth(0).locator('.battle-quantity > a')).toHaveText('6 ships');
  await expect(rows.nth(1).locator('.battle-quantity > a')).toHaveText('≈ 600 soldiers');
  await expect(rows.nth(0).getByTestId('battle-scale')).toContainText('1 ships');
  await expect(rows.nth(1).getByTestId('battle-scale')).toContainText('600 soldiers');
  await expect(detail.getByTestId('battle-loss-share')).toHaveCount(0);

  await page.getByRole('slider', { name: 'Animation progress' }).fill('1000');
  for (let i = 0; i < expectedForces.length; i++)
    await expect(state(i)).toHaveText([String(expectedForces[i].models), '0', '0']);
  await expect(detail.getByTestId('battle-loss-share')).toHaveCount(0);
});

// Dates and rejected points are literal reviewed expectations, not values copied
// from whichever production JSON happens to be served during the test.
const withdrawnLocations = [
  {
    id: 'Q51103517',
    title: 'Combate aeronaval de Coquimbo',
    testName:
      'Coquimbo keeps its separate air and naval groups without a city marker or invented battle position',
    start: { year: 1931, month: 9, day: 6 },
    beforeStart: { year: 1931, month: 9, day: 6 },
    beforeCoords: [-71.338, -29.9532],
    reviewFields: ['coords'],
    note: /Withdraw the inherited municipality point for Coquimbo/i,
    basis: /without substituting a bay centre/i,
    sourceUrl:
      'https://www.museohistoricolaserena.gob.cl/noticias/historia-de-acorazados-y-aviones',
  },
  {
    id: 'Q11457942',
    title: 'Battle of Teradomari',
    testName:
      'Teradomari retains 13 July 1868 with its municipality point withdrawn and no animation or marker',
    start: { year: 1868, month: 7, day: 13 },
    beforeStart: { year: 1868, month: 7, day: 13 },
    beforeCoords: [138.77022222222223, 37.64497222222222],
    reviewFields: ['coords'],
    note: /Withdraw the inherited coordinate of Teradomari municipality/i,
    basis: /neither the town centre, the present harbour centre nor the museum location/i,
    sourceUrl:
      'https://qa.city.nagaoka.niigata.jp/faq/show/1857?category_id=483&site_domain=default',
  },
  {
    id: 'Q137822090',
    title: '가덕도 해전',
    testName:
      'Gadeokdo shows the corrected year 1597 with its island point withdrawn and no animation or marker',
    start: { year: 1597 },
    beforeStart: { year: 1957, month: 7, day: 14 },
    beforeCoords: [128.83, 35.03],
    reviewFields: ['start', 'coords'],
    note: /Correct the erroneous source year 1957 to 1597/i,
    basis: /do not substitute the island centre, fortress or later memorial/i,
    sourceUrl: 'https://encykorea.aks.ac.kr/Article/E0000076',
  },
];

for (const reviewed of withdrawnLocations) {
  test(reviewed.testName, async ({ page, request }) => {
    const response = await request.get(`/data/battles/events/${reviewed.id}.json`);
    expect(response.ok()).toBe(true);
    const battle: BattleRecord = await response.json();
    const index: BattleIndex = await (await request.get('/data/battles/index.json')).json();
    const entry = index.battles.find((item) => item.id === reviewed.id);
    expect(entry).toBeDefined();
    for (const published of [battle, entry!]) {
      expect(published.start).toEqual(reviewed.start);
      expect(published.end).toBeUndefined();
      expect(published.coords).toBeUndefined();
      expect(published.region).toBeUndefined();
    }
    expect(battle.coordinateSource).toBeUndefined();
    expect(battle.missing).toContain('missing-coordinates');
    expect(battle.metadataReview).toMatchObject({
      fields: reviewed.reviewFields,
      before: { start: reviewed.beforeStart, end: null, coords: reviewed.beforeCoords },
    });
    expect(battle.inclusionReview).toMatchObject({
      type: 'naval',
      expectedInstanceOf: ['Q876274'],
    });
    expect(battle.sources.map((source) => source.url)).toContain(reviewed.sourceUrl);
    if (reviewed.id === 'Q51103517') {
      expect(battle.participants.map((army) => army.medium)).toEqual(['air', 'naval']);
      expect(new Set(battle.participants.map((army) => army.sideId)).size).toBe(2);
      for (const army of battle.participants) {
        expect(army.strength).toEqual([]);
        expect(army.casualties).toEqual([]);
        expect(army.deaths).toEqual([]);
      }
    }

    await page.goto('/?battle=1&lang=en');
    await page.getByRole('textbox', { name: 'Search all battles…' }).fill(reviewed.id);
    const result = page.getByTestId(`battle-open-${reviewed.id}`);
    await expect(result).toContainText(reviewed.title);
    await expect(result.locator('.battle-list-year')).toHaveText(String(reviewed.start.year));
    await expect(result).toContainText('Date or location missing');
    await result.click();
    const detail = page.getByTestId('battle-detail');
    await expect(detail).toHaveAttribute('data-battle-id', reviewed.id);
    await expect(detail.getByRole('heading', { name: reviewed.title, exact: true })).toBeVisible();
    await expect(detail.locator('.battle-date')).toHaveText(String(reviewed.start.year));
    await expect(page.getByTestId('year-slider')).toHaveAttribute(
      'aria-valuetext',
      String(reviewed.start.year),
    );
    await expect(detail).toContainText('Date or location missing');
    await expect(detail).toContainText(reviewed.note);
    await expect(detail.locator('.battle-location')).toContainText(reviewed.basis);
    await expect(detail.locator('.battle-location')).not.toContainText('°');
    await expect(detail.getByTestId('battle-playback')).toHaveCount(0);
    await expect(detail.getByTestId('battle-play')).toHaveCount(0);
    await expect(detail.getByTestId('battle-scale')).toHaveCount(0);
    const map = page.locator('[data-battle-status]');
    await expect(map).toHaveAttribute('data-battle-status', 'empty', { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-battle-models', '0');
    await expect(page.locator('[data-battle-rendered="true"]')).toHaveCount(0);
    await expect.poll(() => catalogueMarkerIds(page, [reviewed.id])).toEqual([]);

    const sources = detail.locator('details.battle-sources').filter({
      has: page.locator('summary', { hasText: /^Sources ·/ }),
    });
    await sources.locator('summary').click();
    await expect(sources.locator(`a[href="${reviewed.sourceUrl}"]`)).toBeVisible();
  });
}
