import { expect, test } from '@playwright/test';
import type { BattleIndex, BattleRecord } from '../../lib/battles/schema';

type RecoveredBattle = {
  id: string;
  search: string;
  title: string;
  start: NonNullable<BattleRecord['start']>;
  end: BattleRecord['end'];
  coords: [number, number];
  visibleLocation: string;
  coordinateSourceUrl: string;
  historicalSourceUrl: string;
  locationLimit: RegExp;
  forces: { id: string; name: string; sideId: string }[];
  chronologyNotes?: RegExp[];
};

// These literal expectations come from the reviewed sources and staging review,
// independently of the index and event JSON served by the application.
const battles: RecoveredBattle[] = [
  {
    id: 'Q2889112',
    search: 'Las Piedras',
    title: 'Battle of Las Piedras',
    start: { year: 1811, month: 5, day: 18 },
    end: { year: 1811, month: 5, day: 18 },
    coords: [-56.2014, -34.726],
    visibleLocation: '-34.7260°, -56.2014°',
    coordinateSourceUrl:
      'https://www.museos.gub.uy/index.php/museos/museos-por-localidad/canelones/item/985-museo-a-cielo-abierto-batalla-de-las-piedras',
    historicalSourceUrl: 'https://archivo.presidencia.gub.uy/_web/noticias/2009/05/2009051804.htm',
    locationLimit: /no error radius or exact battle centre is asserted/i,
    forces: [
      {
        id: 'Q2889112:artiguist-forces',
        name: 'Artigas’s forces at Las Piedras',
        sideId: 'artiguist',
      },
      {
        id: 'Q2889112:spanish-royalist-forces',
        name: 'Spanish royalist forces at Las Piedras',
        sideId: 'royalist',
      },
    ],
  },
  {
    id: 'Q4872580',
    search: 'Toverud',
    title: 'Battle of Toverud',
    start: { year: 1808, month: 4, day: 19 },
    end: { year: 1808, month: 4, day: 20 },
    coords: [11.4878, 59.9182],
    visibleLocation: '59.9182°, 11.4878°',
    coordinateSourceUrl:
      'https://www.aurskog-holand.kommune.no/innhold/naring-etablering-og-landbruk/turisme/opplevaurskogholand/',
    historicalSourceUrl:
      'https://www.aurskog-holand.kommune.no/globalassets/bilder-og-dokumenter/kultur-idrett-og-fritid/dokumenter/romskog-bygdebok/bind2.pdf',
    locationLimit:
      /representative site locator, not proof of the exact fighting or surrender position/i,
    forces: [
      {
        id: 'Q4872580:norwegian-forces',
        name: 'Norwegian forces at Toverud',
        sideId: 'danish-norwegian',
      },
      {
        id: 'Q4872580:swedish-forces',
        name: 'Swedish forces at Toverud',
        sideId: 'swedish',
      },
    ],
    chronologyNotes: [
      /Chronology remains uncertain/i,
      /Store norske leksikon gives 19 April 1808.*Rømskog history gives 20 April/i,
      /does not independently establish that combat lasted across both dates/i,
    ],
  },
  {
    id: 'Q4872585',
    search: 'Trangen',
    title: 'Battle of Trangen',
    start: { year: 1808, month: 4, day: 25 },
    end: undefined,
    coords: [12.1368, 60.6534],
    visibleLocation: '60.6534°, 12.1368°',
    coordinateSourceUrl:
      'https://api.kartverket.no/stedsnavn/v1/sted?stedsnummer=796072&utkoordsys=4258',
    historicalSourceUrl:
      'https://www.asnes.kommune.no/_f/p1/i932152e9-25c2-4701-b401-60709772c64d/kulturminneplan-asnes-030225-med-innholdsfortegnelse.pdf',
    locationLimit:
      /valley reference point, not an averaged geometry.*calibrated battle-centre estimate/i,
    forces: [
      {
        id: 'Q4872585:norwegian-forces',
        name: 'Norwegian forces at Trangen',
        sideId: 'danish-norwegian',
      },
      {
        id: 'Q4872585:swedish-forces',
        name: 'Swedish forces at Trangen',
        sideId: 'swedish',
      },
    ],
  },
  {
    id: 'Q112665883',
    search: 'Mount Street',
    title: 'Battle of Mount Street Bridge',
    start: { year: 1916, month: 4, day: 26 },
    end: undefined,
    coords: [-6.2403, 53.3375],
    visibleLocation: '53.3375°, -6.2403°',
    coordinateSourceUrl:
      'https://www.buildingsofireland.ie/buildings-search/building/50100535/mckenny-bridge-mount-street-lower-northumberland-road-dublin-2-dublin',
    historicalSourceUrl: 'https://mountstreet1916.ie/battle-of-mount-st/',
    locationLimit: /bridge-sector reference point, not a surveyed troop position/i,
    forces: [
      {
        id: 'Q112665883:irish-volunteers',
        name: 'Irish Volunteers at Mount Street Bridge',
        sideId: 'irish-volunteers',
      },
      {
        id: 'Q112665883:british-forces',
        name: 'British forces at Mount Street Bridge',
        sideId: 'british',
      },
    ],
  },
];

for (const reviewed of battles) {
  test(`catalogue opens ${reviewed.title} at its reviewed site with two unquantified camps`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const response = await request.get(`/data/battles/events/${reviewed.id}.json`);
    expect(response.ok()).toBe(true);
    const battle: BattleRecord = await response.json();
    const indexResponse = await request.get('/data/battles/index.json');
    expect(indexResponse.ok()).toBe(true);
    const index: BattleIndex = await indexResponse.json();
    const entry = index.battles.find((item) => item.id === reviewed.id);
    expect(entry).toBeDefined();
    for (const record of [battle, entry!]) {
      expect(record.start).toEqual(reviewed.start);
      expect(record.end).toEqual(reviewed.end);
      expect(record.coords).toEqual(reviewed.coords);
    }
    expect(entry!.documented).toBe(false);
    expect(battle.missing ?? []).not.toContain('missing-coordinates');
    expect(battle.metadataReview).toMatchObject({
      fields: ['coords'],
      before: { start: reviewed.start, end: reviewed.end ?? null, coords: null },
    });
    expect(battle.coordinateSource).toMatchObject({
      kind: 'reviewed',
      url: reviewed.coordinateSourceUrl,
    });
    expect(battle.participants.map(({ id, sideId }) => ({ id, sideId }))).toEqual(
      reviewed.forces.map(({ id, sideId }) => ({ id, sideId })),
    );
    expect(battle.profileId).toBeUndefined();
    for (const army of battle.participants) {
      expect(army.kind).toBe('military-unit');
      expect(army.medium).toBe('land');
      expect(army.strength).toEqual([]);
      expect(army.deaths).toEqual([]);
      expect(army.casualties).toEqual([]);
      expect(army.profileId).toBeUndefined();
      expect(army.equipmentIdentity).toBeUndefined();
    }
    expect(battle.totals).toEqual({ strength: [], deaths: [], casualties: [] });
    for (const quantities of Object.values(battle.unassigned ?? {})) expect(quantities).toEqual([]);

    // Catalogue navigation must recover the site without camera coordinates
    // supplied by the test, including the correct 1811 Las Piedras engagement.
    await page.goto('/?battle=1&lang=en');
    await page.getByRole('textbox', { name: 'Search all battles…' }).fill(reviewed.search);
    const result = page.getByTestId(`battle-open-${reviewed.id}`);
    await expect(result).toContainText(reviewed.title);
    await expect(result.locator('.battle-list-year')).toHaveText(String(reviewed.start.year));
    await expect(result).not.toContainText('Date or location missing');
    await result.click();

    const detail = page.getByTestId('battle-detail');
    await expect(detail).toHaveAttribute('data-battle-id', reviewed.id);
    await expect(detail.getByRole('heading', { name: reviewed.title, exact: true })).toBeVisible();
    await expect(page.getByTestId('year-slider')).toHaveAttribute(
      'aria-valuetext',
      String(reviewed.start.year),
    );
    const map = page.locator('[data-battle-status]');
    await expect(map).toHaveAttribute('data-battle-event', reviewed.id);
    await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
    await expect(map).toHaveAttribute('data-battle-rendered', 'true');
    await expect(map).toHaveAttribute('data-battle-models', '20');
    await expect
      .poll(() => Number(new URL(page.url()).searchParams.get('lon')))
      .toBeCloseTo(reviewed.coords[0], 3);
    await expect
      .poll(() => Number(new URL(page.url()).searchParams.get('lat')))
      .toBeCloseTo(reviewed.coords[1], 3);
    await expect(detail.getByTestId('battle-unknown-strength-notice')).toContainText(
      'unknown strength, no historical proportions',
    );

    const rows = detail.getByTestId('battle-army');
    await expect(rows).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(
        rows.nth(i).getByRole('heading', { name: reviewed.forces[i].name }),
      ).toBeVisible();
      await expect(rows.nth(i).locator('.battle-army-dot')).toHaveClass(
        `battle-army-dot army-${i}`,
      );
      await expect(rows.nth(i).locator('.battle-quantity')).toHaveCount(0);
      await expect(rows.nth(i).locator('.battle-unknown')).toHaveCount(3);
      await expect(rows.nth(i).getByTestId('battle-scale')).toContainText('unknown strength');
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

    const location = detail.locator('.battle-location');
    await expect(location).toContainText(reviewed.visibleLocation);
    await expect(location).toContainText(reviewed.locationLimit);
    await expect(location.locator(`a[href="${reviewed.coordinateSourceUrl}"]`)).toBeVisible();
    for (const note of reviewed.chronologyNotes ?? []) await expect(detail).toContainText(note);
    const sources = detail.locator('details.battle-sources').filter({
      has: page.locator('summary', { hasText: /^Sources ·/ }),
    });
    await sources.locator('summary').click();
    await expect(sources.locator(`a[href="${reviewed.historicalSourceUrl}"]`)).toBeVisible();
  });
}
