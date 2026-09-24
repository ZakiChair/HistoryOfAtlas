import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Campaign, HistoricalEvent, Story } from '../../lib/schema';

async function sourcedEvent(request: APIRequestContext): Promise<HistoricalEvent> {
  const manifest = await (await request.get('/data/manifest.json')).json();
  const chunks = manifest.chunks.filter(
    (item: { start: number; end: number }) => item.start <= 1815 && item.end >= 1815,
  );
  expect(
    chunks.length,
    'A source chunk intersecting the requested year is required',
  ).toBeGreaterThan(0);
  const events: HistoricalEvent[] = (
    await Promise.all(
      chunks.map(async (chunk: { path: string }) => (await request.get(chunk.path)).json()),
    )
  ).flat();
  const event = events.find((item) => item.type === 'battle' && /waterloo/i.test(item.name.en));
  expect(
    event,
    'Waterloo must come from the ingested source, never an inline fixture',
  ).toBeTruthy();
  return event!;
}

async function editYear(page: Page, value: string) {
  await page.locator('.timeline-year').click();
  await page.getByRole('textbox', { name: /^(Année|Year)$/ }).fill(value);
  await page.getByRole('textbox', { name: /^(Année|Year)$/ }).press('Enter');
}

/** Phones show the map first: open the folded notebook when a test reads its contents. */
async function openNotebook(page: Page) {
  // The notebook state is settled once the atlas has read its URL.
  await expect(page.locator('.atlas-app:not(.is-hydrating)')).toBeAttached();
  const reopen = page.getByRole('button', { name: /^(Ouvrir le carnet|Open notebook)$/ });
  if (await reopen.isVisible()) await reopen.click();
  await expect(page.locator('.exploration-panel')).toBeVisible();
}

/** The control is drawn on top at its centre, not covered by a drawer, a card or the timeline. */
async function expectOnTop(control: Locator) {
  const box = await control.boundingBox();
  expect(box).toBeTruthy();
  const onTop = await control.evaluate(
    (element, point) => {
      const hit = document.elementFromPoint(point.x, point.y);
      return Boolean(hit && element.contains(hit));
    },
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
  );
  expect(onTop, (await control.getAttribute('aria-label')) ?? 'control').toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('normal timeline navigation loads temporal tiles rather than the all-era archive', async ({
  page,
  request,
}, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 960 });
  const manifest: {
    eventsPmtiles: string;
    eventShards: { start: number; end: number; path: string }[];
  } = await (await request.get('/data/manifest.json')).json();
  const first = manifest.eventShards.find((shard) => shard.start <= 1812 && shard.end >= 1812)!;
  const second = manifest.eventShards.find((shard) => shard.start <= 1944 && shard.end >= 1944)!;
  expect(first).toBeTruthy();
  expect(second).toBeTruthy();
  const requested = new Set<string>();
  page.on('request', (request) => requested.add(new URL(request.url()).pathname));
  await page.goto('/?lang=fr&y=1812');
  // Wait for the actual map data before checking the deferred notebook. This is
  // a data-loading invariant; hardware timing is covered by the separate audits.
  await expect.poll(() => requested.has(first.path), { timeout: 30_000 }).toBe(true);
  await openNotebook(page);
  await expect(page.locator('.territory-list button').first()).toBeAttached();
  expect(requested.has(manifest.eventsPmtiles)).toBe(false);
  expect([...requested].some((path) => path.startsWith('/data/chunks/'))).toBe(false);
  const reveal = page.getByRole('button', {
    name: 'Voir les événements de cette période',
    exact: true,
  });
  await reveal.scrollIntoViewIfNeeded();
  expect([...requested].some((path) => path.startsWith('/data/chunks/'))).toBe(false);
  await reveal.click();
  await expect(
    page.getByRole('button', { name: 'Masquer les événements de cette période', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true');
  await expect
    .poll(() => [...requested].some((path) => path.startsWith('/data/chunks/')))
    .toBe(true);
  await editYear(page, '1944');
  await expect.poll(() => requested.has(second.path)).toBe(true);
  expect(requested.has(manifest.eventsPmtiles)).toBe(false);
  await page.goto('/?lang=fr&y=1944&from=1900&to=2000');
  await expect.poll(() => requested.has(manifest.eventsPmtiles)).toBe(true);
});

test('war list includes sourced battles nested through intermediate campaigns', async ({
  page,
  request,
}) => {
  const catalog: {
    id: string;
    name: { en: string };
    start: { year: number };
    end: { year: number };
    path: string;
  }[] = await (await request.get('/data/wars.json')).json();
  const war = catalog.find((entry) => entry.name.en === 'World War II');
  expect(war, 'The parent conflict must come from the published catalog').toBeTruthy();
  const events: HistoricalEvent[] = await (await request.get(war!.path)).json();
  expect(events.some((event) => event.parentWar !== war!.id)).toBe(true);
  const query = new URLSearchParams({
    y: String(war!.start.year),
    from: String(war!.start.year),
    to: String(war!.end.year),
    war: war!.id,
    mode: 'list',
    lang: 'en',
  });
  await page.goto(`/?${query}`);
  await expect(page.locator('.event-list-full .count-badge')).toHaveText(String(events.length));
});

test('timeline crosses astronomical zero and accepts an explicit BCE year', async ({ page }) => {
  await page.goto('/?lang=fr&y=0');
  const slider = page.getByTestId('year-slider');
  await expect(slider).toHaveAttribute('aria-valuetext', '1 av. J.-C.');
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', '1');
  await slider.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuetext', '1 av. J.-C.');
  await editYear(page, '331 BCE');
  await expect(slider).toHaveAttribute('aria-valuetext', '331 av. J.-C.');
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('-330');
});

test('a sourced event opens from the list with consultable provenance', async ({
  page,
  request,
}) => {
  const event = await sourcedEvent(request);
  await page.goto(`/?lang=fr&y=${event.start.year}&mode=list`);
  await page
    .locator('.event-row')
    .filter({ hasText: event.name.fr ?? event.name.en })
    .first()
    .click();
  const panel = page.getByTestId('event-panel');
  await expect(
    panel.getByRole('heading', { name: event.name.fr ?? event.name.en, exact: true }),
  ).toBeVisible();
  await expect(
    panel.locator('.sources-list a[href="https://www.wikidata.org/wiki/' + event.id + '"]'),
  ).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('e')).toBe(event.id);
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe(String(event.start.year));
});

test('fuzzy search changes both the selected event and timeline', async ({ page, request }) => {
  const event = await sourcedEvent(request);
  await page.goto('/?lang=fr&y=-330');
  await page.getByRole('button', { name: 'Rechercher dans l’atlas', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Rechercher dans l’atlas' });
  await input.fill('Waterlo');
  await page
    .getByRole('option')
    .filter({ hasText: event.name.fr ?? event.name.en })
    .first()
    .click();
  await expect(
    page.getByTestId('event-panel').getByRole('heading', { name: event.name.fr ?? event.name.en }),
  ).toBeVisible();
  await expect(page.getByTestId('year-slider')).toHaveAttribute(
    'aria-valuetext',
    String(event.start.year),
  );
});

test('participant filter uses sourced entities and updates the visible events', async ({
  page,
  request,
}) => {
  const event = await sourcedEvent(request);
  expect(event.belligerents.length).toBeGreaterThan(0);
  const participant = event.belligerents[0];
  const manifest = await (await request.get('/data/manifest.json')).json();
  const chunks = manifest.chunks.filter(
    (item: { start: number; end: number }) =>
      item.start <= event.start.year + 3 && item.end >= event.start.year - 3,
  );
  const records: HistoricalEvent[] = (
    await Promise.all(
      chunks.map(async (chunk: { path: string }) => (await request.get(chunk.path)).json()),
    )
  ).flat();
  const matching = [...new Map(records.map((record) => [record.id, record])).values()].filter(
    (record) =>
      record.start.year <= event.start.year + 3 &&
      (record.end?.year ?? record.start.year) >= event.start.year - 3 &&
      record.belligerents.some((item) => item.entityId === participant.entityId),
  );
  await page.goto(`/?lang=fr&y=${event.start.year}&mode=list`);
  const rows = page.locator('.event-row');
  await expect(rows.first()).toBeVisible();
  const initialCount = await rows.count();
  const picker = page.getByRole('combobox', { name: 'Entité impliquée', exact: true });
  await expect(picker.locator(`option[value="${participant.entityId}"]`)).toBeAttached();
  await picker.selectOption(participant.entityId);
  await expect
    .poll(() => JSON.parse(new URL(page.url()).searchParams.get('filters') ?? '{}').entity)
    .toBe(participant.entityId);
  await expect(rows.filter({ hasText: event.name.fr ?? event.name.en }).first()).toBeVisible();
  await expect(rows).toHaveCount(Math.min(30, matching.length));
  const matchingNames = new Set(matching.map((record) => record.name.fr ?? record.name.en));
  expect(
    (await rows.locator('strong').allTextContents()).every((name) => matchingNames.has(name)),
  ).toBe(true);
  await picker.selectOption('');
  await expect(rows).toHaveCount(initialCount);
});

test('a rendered polity opens sourced area observations and can be followed and stopped', async ({
  page,
  request,
}) => {
  type Territory = { id: string; name: string };
  type Polity = {
    id: string;
    name: string;
    source: string;
    observations: { fromYear: number; toYear: number; areaKm2: number }[];
  };
  await page.addInitScript(() => {
    (window as unknown as { qaPolities: Territory[] }).qaPolities = [];
    window.addEventListener('atlas:territories', (event) => {
      (window as unknown as { qaPolities: Territory[] }).qaPolities = (
        event as CustomEvent<Territory[]>
      ).detail;
    });
  });
  const event = await sourcedEvent(request);
  expect(event.coords).toBeTruthy();
  await page.goto(
    `/?lang=fr&y=${event.start.year}&lon=${event.coords![0]}&lat=${event.coords![1]}&z=3&projection=mercator`,
  );
  await openNotebook(page);
  await expect(page.locator('.territory-list button').first()).toBeVisible();
  const candidates = await page.evaluate(() =>
    (window as unknown as { qaPolities: Territory[] }).qaPolities.slice(0, 5),
  );
  let polity: Polity | undefined;
  for (const candidate of candidates) {
    const data: Polity = await (await request.get(`/geo/polities/${candidate.id}.json`)).json();
    const first = Math.min(...data.observations.map((item) => item.fromYear));
    const last = Math.max(...data.observations.map((item) => item.toYear));
    if (data.observations.length >= 2 && last - first > 10) {
      polity = data;
      break;
    }
  }
  expect(
    polity,
    'The rendered source must supply a polity with a documented time series',
  ).toBeTruthy();
  const selected = polity!;
  await page
    .locator('.territory-list')
    .getByRole('button', { name: selected.name, exact: true })
    .click();
  const panel = page.getByTestId('entity-panel');
  await expect(panel.getByRole('heading', { name: selected.name, exact: true })).toBeVisible();
  await expect(
    panel.locator('.entity-sources a').filter({ hasText: 'Cliopatria' }).first(),
  ).toHaveAttribute('href', selected.source);
  await expect(panel.getByRole('img', { name: /Superficie aux dates documentées/ })).toBeVisible();
  await expect(panel.locator('.area-chart path')).toHaveAttribute('d', /M.+L/);
  const observation = selected.observations.at(-1)!;
  await panel
    .getByRole('combobox', { name: 'Observation territoriale' })
    .selectOption(String(observation.fromYear));
  await expect
    .poll(() => new URL(page.url()).searchParams.get('y'))
    .toBe(String(observation.fromYear));
  await page.getByRole('button', { name: '1× — 1 ans par seconde', exact: true }).click();
  const firstYear = Math.min(...selected.observations.map((item) => item.fromYear));
  const follow = panel.getByTestId('follow-entity');
  await follow.click();
  await expect(follow).toContainText('Arrêter le parcours');
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('y')), { timeout: 10_000 })
    .toBeGreaterThan(firstYear);
  await expect.poll(() => new URL(page.url()).searchParams.get('follow')).toBe('1');
  const resumedYear = Number(new URL(page.url()).searchParams.get('y'));
  await page.reload();
  await expect(follow).toContainText('Arrêter le parcours');
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('y')))
    .toBeGreaterThanOrEqual(resumedYear);
  await follow.click();
  await expect(follow).toContainText('Suivre ce territoire');
  await expect(page.getByTestId('timeline-play')).toHaveAttribute(
    'aria-label',
    'Lire la chronologie',
  );
  await expect.poll(() => new URL(page.url()).searchParams.has('play')).toBe(false);
  const lastYear = Math.max(...selected.observations.map((item) => item.toYear));
  await page.goto(`/?lang=fr&entity=${selected.id}&follow=1&y=${lastYear - 1}&speed=100`);
  await expect(follow).toContainText('Suivre ce territoire');
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('y'))).toBe(lastYear);
  await expect.poll(() => new URL(page.url()).searchParams.has('follow')).toBe(false);
  await expect(page.getByTestId('timeline-play')).toHaveAttribute(
    'aria-label',
    'Lire la chronologie',
  );
});

test('campaign playback resumes from its URL and stops when its context is left', async ({
  page,
  request,
}) => {
  const campaigns: Campaign[] = await (await request.get('/data/campaigns.json')).json();
  const campaign = campaigns.find((item) => item.steps.length >= 3)!;
  expect(campaign).toBeTruthy();
  await page.goto(
    `/?lang=fr&campaign=${campaign.id}&step=0&cplay=1&y=${campaign.steps[0].date.year}`,
  );
  const pause = page
    .locator('.campaign-controls')
    .getByRole('button', { name: 'Pause', exact: true });
  await expect(pause).toBeVisible();
  await page.reload();
  await expect(pause).toBeVisible();
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('step')), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(1);
  await expect.poll(() => new URL(page.url()).searchParams.get('cplay')).toBe('1');
  await page.getByRole('button', { name: 'Parcours', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has('cplay')).toBe(false);
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();
  await expect(
    page
      .locator('.campaign-controls')
      .getByRole('button', { name: 'Lire la campagne', exact: true }),
  ).toBeVisible();
});

test('a sourced guided story drives the timeline through its documented steps', async ({
  page,
  request,
}) => {
  const stories: Story[] = await (await request.get('/data/stories.json')).json();
  const story = stories.find((item) => item.steps.length >= 2)!;
  expect(story).toBeTruthy();
  const events: HistoricalEvent[] = await Promise.all(
    story.steps
      .slice(0, 2)
      .map(async (step) => (await request.get(`/data/events/${step.eventId}.json`)).json()),
  );
  await page.goto('/?lang=fr');
  await openNotebook(page);
  await page.getByRole('button', { name: 'Parcours', exact: true }).click();
  await page
    .locator('.story-card')
    .filter({ hasText: story.title.fr ?? story.title.en })
    .click();
  await expect(page.locator('.story-title')).toHaveText(story.title.fr ?? story.title.en);
  await expect.poll(() => new URL(page.url()).searchParams.get('story')).toBe(story.id);
  await expect
    .poll(() => new URL(page.url()).searchParams.get('y'))
    .toBe(String(events[0].start.year));
  await expect(page.getByTestId('event-panel')).not.toBeVisible();
  const next = page.locator('.story-step[data-step="1"]');
  await next.getByRole('button', { name: 'Explorer cette étape', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('chapter')).toBe('1');
  await expect
    .poll(() => new URL(page.url()).searchParams.get('y'))
    .toBe(String(events[1].start.year));
  await expect(next).toHaveClass(/active/);
  await expect(next).toContainText(story.steps[1].text.fr ?? story.steps[1].text.en);
  await expect(
    next.locator(`a[href="https://www.wikidata.org/wiki/${events[1].id}"]`),
  ).toBeVisible();
  await next.getByRole('button', { name: 'Lire la fiche', exact: true }).click();
  const detail = page.getByTestId('event-panel');
  await expect(
    detail.getByRole('heading', { name: events[1].name.fr ?? events[1].name.en, exact: true }),
  ).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('e')).toBe(events[1].id);
  await page.reload();
  await expect(
    detail.getByRole('heading', { name: events[1].name.fr ?? events[1].name.en, exact: true }),
  ).toBeVisible();
  await detail.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(
    next.getByRole('button', { name: 'Explorer cette étape', exact: true }),
  ).toBeVisible();
  await expect(next).toBeInViewport({ ratio: 0.65 });
  await expect(next).toHaveClass(/active/);
  await expect.poll(() => new URL(page.url()).searchParams.get('chapter')).toBe('1');
});

test('URL reload restores camera, event, range and filters', async ({ page, request }) => {
  const event = await sourcedEvent(request);
  const parameters = new URLSearchParams({
    y: String(event.start.year),
    lon: '4.412222',
    lat: '50.678055',
    z: '4.5',
    bearing: '22.5',
    pitch: '18',
    e: event.id,
    lang: 'en',
    theme: 'light',
    projection: 'mercator',
    borders: 'historical-basemaps',
    mode: 'events',
    from: '1800',
    to: '1820',
    trails: '1',
    speed: '25',
    filters: JSON.stringify({
      types: ['battle'],
      regions: ['europe'],
      eras: ['19th-century'],
      entity: null,
      minImportance: 35,
    }),
  });
  await page.goto(`/?${parameters}`);
  await expect
    .poll(async () => (await page.locator('.world-map').boundingBox())?.height ?? 0)
    .toBeGreaterThan(300);
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
  await expect(
    page.getByTestId('event-panel').getByRole('heading', { name: event.name.en }),
  ).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('pitch')).toBe('18');
  const before = Object.fromEntries(new URL(page.url()).searchParams);
  await page.reload();
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
  await expect(
    page.getByTestId('event-panel').getByRole('heading', { name: event.name.en }),
  ).toBeVisible();
  await expect.poll(() => Object.fromEntries(new URL(page.url()).searchParams)).toEqual(before);
  const restored = new URL(page.url()).searchParams;
  for (const key of [
    'y',
    'e',
    'lang',
    'theme',
    'projection',
    'borders',
    'from',
    'to',
    'trails',
    'speed',
  ])
    expect(restored.get(key)).toBe(parameters.get(key));
  expect(JSON.parse(restored.get('filters') ?? '{}')).toEqual(
    JSON.parse(parameters.get('filters') ?? '{}'),
  );
  for (const key of ['lat', 'lon', 'z', 'bearing', 'pitch'])
    expect(Number(restored.get(key))).toBeCloseTo(Number(parameters.get(key)), 6);
});

test('language switching translates timeline and event names', async ({ page, request }) => {
  const event = await sourcedEvent(request);
  await page.goto(`/?lang=fr&y=${event.start.year}&e=${event.id}`);
  await page.getByTestId('language-select').selectOption('en');
  await expect(
    page.getByTestId('event-panel').getByRole('heading', { name: event.name.en }),
  ).toBeVisible();
  await expect(page.getByTestId('year-slider')).toHaveAttribute('aria-label', 'Year');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByTestId('language-select').selectOption('fr');
  await expect(page.getByTestId('year-slider')).toHaveAttribute('aria-label', 'Année');
});

test('campaign playback advances a real sourced step', async ({ page, request }) => {
  const campaigns: Campaign[] = await (await request.get('/data/campaigns.json')).json();
  const campaign = campaigns.find(
    (item) => item.steps.length >= 2 && item.steps[0].date.year !== item.steps[1].date.year,
  )!;
  expect(campaign).toBeTruthy();
  await page.goto(`/?lang=fr&campaign=${campaign.id}&step=0&y=${campaign.steps[0].date.year}`);
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();
  await page.getByRole('button', { name: 'Lire la campagne', exact: true }).click();
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('step')), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(1);
  await page
    .locator('.campaign-controls')
    .getByRole('button', { name: 'Pause', exact: true })
    .click();
  await expect(
    page
      .locator('.campaign-controls')
      .getByRole('button', { name: 'Lire la campagne', exact: true }),
  ).toBeVisible();
  const stoppedNumber = await page
    .locator('.campaign-steps [aria-current="step"] .step-number')
    .textContent();
  const stoppedIndex = Number(stoppedNumber) - 1;
  expect(stoppedIndex).toBeGreaterThanOrEqual(1);
  expect(stoppedIndex).toBeLessThan(campaign.steps.length);
  await expect(page.locator('.campaign-steps [aria-current="step"]')).toContainText(
    campaign.steps[stoppedIndex].name?.fr ??
      campaign.steps[stoppedIndex].name?.en ??
      campaign.steps[stoppedIndex].label,
  );
  await expect.poll(() => new URL(page.url()).searchParams.get('step')).toBe(String(stoppedIndex));
  await expect
    .poll(() => new URL(page.url()).searchParams.get('y'))
    .toBe(String(campaign.steps[stoppedIndex].date.year));
  await expect(page.locator('.source-note')).toContainText(
    'ne représentent pas un itinéraire militaire attesté',
  );
});

test('an out-of-range campaign deep link opens its last documented step', async ({
  page,
  request,
}) => {
  const campaigns: Campaign[] = await (await request.get('/data/campaigns.json')).json();
  const campaign = campaigns.find((item) => item.steps.length >= 2)!;
  expect(campaign).toBeTruthy();
  const last = campaign.steps.at(-1)!;
  await page.goto(`/?lang=fr&campaign=${campaign.id}&step=99999&y=${campaign.steps[0].date.year}`);
  await expect
    .poll(() => new URL(page.url()).searchParams.get('step'))
    .toBe(String(campaign.steps.length - 1));
  await expect(page.locator('.campaign-steps [aria-current="step"]')).toContainText(
    last.name?.fr ?? last.name?.en ?? last.label,
  );
  await expect(
    page.locator('.campaign-controls').getByRole('button', { name: 'Étape suivante', exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .locator('.campaign-controls')
      .getByRole('button', { name: 'Étape précédente', exact: true }),
  ).toBeEnabled();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe(String(last.date.year));
});

test('changing the year changes actual rendered historical territories', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { qaTerritories: string[] }).qaTerritories = [];
    window.addEventListener('atlas:territories', (event) => {
      const detail = (event as CustomEvent<{ id: string }[]>).detail;
      (window as unknown as { qaTerritories: string[] }).qaTerritories = detail
        .map((item) => item.id)
        .sort();
    });
  });
  await page.goto('/?lang=fr&y=1812&lon=12&lat=43&z=3&projection=mercator');
  await expect
    .poll(async () => (await page.locator('.world-map').boundingBox())?.height ?? 0)
    .toBeGreaterThan(300);
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { qaTerritories: string[] }).qaTerritories.length,
        ),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  const before = await page.evaluate(
    () => (window as unknown as { qaTerritories: string[] }).qaTerritories,
  );
  await editYear(page, '1914');
  await expect
    .poll(
      () => page.evaluate(() => (window as unknown as { qaTerritories: string[] }).qaTerritories),
      { timeout: 30_000 },
    )
    .not.toEqual(before);
  await expect(page.getByTestId('year-slider')).toHaveAttribute('aria-valuetext', '1914');
});

test('mobile event drawer and timeline remain usable without horizontal overflow', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const event = await sourcedEvent(request);
  await page.goto(`/?lang=fr&y=${event.start.year}&e=${event.id}`);
  await expect(
    page.getByTestId('event-panel').getByRole('heading', { name: event.name.fr ?? event.name.en }),
  ).toBeVisible();
  const slider = page.getByTestId('year-slider');
  await expect(slider).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page
    .getByTestId('event-panel')
    .getByRole('button', { name: 'Fermer', exact: true })
    .click();
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', String(event.start.year + 1));
});

test('on a phone the map comes first, with its tools above the folded notebook', async ({
  page,
}) => {
  // iPhone 13 once the browser bars are drawn.
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/?lang=fr&y=1812');
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true', {
    timeout: 45_000,
  });
  const reopen = page.getByRole('button', { name: 'Ouvrir le carnet', exact: true });
  await expect(reopen).toBeVisible();
  await expect(page.locator('.exploration-panel')).not.toBeAttached();
  const bar = await reopen.boundingBox();
  expect(bar!.height).toBeGreaterThanOrEqual(44);
  expect(bar!.height).toBeLessThanOrEqual(60);

  // Zoom, compass, theme and fullscreen stay reachable just above the folded notebook.
  const toolbar = page.getByRole('toolbar', { name: 'Commandes de la carte', exact: true });
  const tools = await toolbar.getByRole('button').all();
  expect(tools.length).toBeGreaterThan(8);
  for (const tool of tools) await expectOnTop(tool);
  await expectOnTop(reopen);
  const toolsBox = await toolbar.boundingBox();
  expect(toolsBox!.y + toolsBox!.height).toBeLessThanOrEqual(bar!.y);

  // The layer chips share one row, which scrolls sideways when the labels are long.
  const chipRows = await page
    .locator('.map-layer-controls button')
    .evaluateAll(
      (buttons) =>
        new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top))).size,
    );
  expect(chipRows).toBe(1);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);

  // More than half of the screen shows the map itself, not controls drawn over it.
  const mapShare = await page.evaluate(() => {
    const canvas = document.querySelector('.maplibregl-canvas');
    let map = 0;
    let total = 0;
    for (let y = 2; y < innerHeight; y += 4)
      for (let x = 2; x < innerWidth; x += 4) {
        total++;
        if (document.elementFromPoint(x, y) === canvas) map++;
      }
    return map / total;
  });
  expect(mapShare).toBeGreaterThan(0.5);

  await reopen.click();
  await expect(page.locator('.exploration-panel')).toBeVisible();
  await expect(page.locator('.territory-list button').first()).toBeAttached();
  // A link to something the notebook shows keeps it open.
  await page.goto('/?lang=fr&y=1812&mode=list');
  await expect(page.locator('.exploration-panel')).toBeVisible();
  await expect(page.locator('.event-list-full')).toBeVisible();
});

test('a first visit lands on 1812 with three ways in and a help sheet', async ({ page }) => {
  await page.goto('/');
  const card = page.getByTestId('start-card');
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Where to begin?', exact: true })).toBeVisible();
  await expect(card.locator('.start-door')).toHaveCount(3);
  await expect(page.getByTestId('year-slider')).toHaveAttribute('aria-valuetext', '1812');
  const audit = await new AxeBuilder({ page })
    .include('[data-testid="start-card"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);

  const help = page.getByRole('button', { name: 'Help and shortcuts', exact: true });
  await help.click();
  const sheet = page.getByRole('dialog', { name: 'How to read the atlas', exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('timeline');
  const shortcuts = sheet.getByTestId('help-shortcuts');
  for (const key of ['Space', '←', '→', '⌘ K', 'Ctrl K', 'Esc'])
    await expect(shortcuts.locator('kbd').filter({ hasText: key })).toBeVisible();
  const layers = sheet.getByTestId('help-layers');
  for (const layer of ['Battles', 'Strategic resources', 'Religions'])
    await expect(layers.locator('dt').filter({ hasText: layer })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeAttached();
  await expect(help).toBeFocused();
  // Closing the sheet leaves the start card in place; closing the card is remembered.
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Close and explore freely', exact: true }).click();
  await expect(card).not.toBeAttached();
  // Focus goes back to the header rather than falling to the page body.
  await expect(help).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('atlas-start-card'))).toBe('dismissed');
  await page.goto('/');
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true', {
    timeout: 45_000,
  });
  await expect(page.getByTestId('start-card')).not.toBeAttached();
  // The three ways in stay available from the help sheet.
  await help.click();
  await page.getByRole('button', { name: 'Show the three ways in again', exact: true }).click();
  await expect(page.getByTestId('start-card')).toBeVisible();
});

for (const door of [
  {
    id: 'campaign',
    query: { campaign: 'Q78994' },
    panel: '.campaign-panel',
  },
  {
    id: 'battle',
    query: { battle: '1', e: 'Q48314', y: '1815' },
    panel: '[data-testid="battle-detail"]',
  },
  {
    id: 'religion',
    query: { religions: '1', religion: 'buddhism', y: '-449' },
    panel: '[data-testid="religions-layer-toggle"][aria-pressed="true"]',
  },
]) {
  test(`the ${door.id} way in opens its shareable view`, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(`start-door-${door.id}`).click();
    await expect(page.getByTestId('start-card')).not.toBeAttached();
    await expect
      .poll(() => {
        const query = new URL(page.url()).searchParams;
        return Object.fromEntries(Object.keys(door.query).map((key) => [key, query.get(key)]));
      })
      .toEqual(door.query);
    await expect(page.locator(door.panel)).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => localStorage.getItem('atlas-start-card'))).toBe('dismissed');
  });
}

test('the opening montage lands on 1812 over Europe, then offers the ways in', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.getByTestId('start-card')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('year-slider')).toHaveAttribute('aria-valuetext', '1812');
  await expect
    .poll(
      () => {
        const query = new URL(page.url()).searchParams;
        const lon = Number(query.get('lon'));
        const lat = Number(query.get('lat'));
        return query.get('y') === '1812' && lon > -10 && lon < 30 && lat > 40 && lat < 60;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
});
