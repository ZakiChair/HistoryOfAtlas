import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { resourceKnowledge } from '../../lib/resources/time';
import {
  RESOURCE_CATEGORIES,
  type ResourceCategory,
  type ResourceDataset,
  type ResourceSite,
} from '../../lib/resources/types';

const RESOURCE_PATH = '/data/resources/sites.json';
let cachedDataset: ResourceDataset | undefined;
const browserErrors = new WeakMap<Page, string[]>();

function resourceDataset(): ResourceDataset {
  cachedDataset ??= JSON.parse(
    readFileSync(new URL('../../public/data/resources/sites.json', import.meta.url), 'utf8'),
  ) as ResourceDataset;
  return cachedDataset;
}

function quincySite(): ResourceSite {
  const site = resourceDataset().sites.find(
    (candidate) => candidate.id === 'historical:quincy-copper-mine',
  );
  expect(site, 'Use the published NPS-backed Quincy chronology').toBeTruthy();
  expect(site!.periods.map(({ fromYear, toYear }) => [fromYear, toYear])).toEqual([
    [1856, 1931],
    [1937, 1945],
  ]);
  return site!;
}

function siteUrl(
  site: ResourceSite,
  resources = false,
  year = resourceKnowledge(site)[0].fromYear,
): string {
  return `/?${new URLSearchParams({
    lang: 'en',
    y: String(year),
    lon: String(site.coordinates[0]),
    lat: String(site.coordinates[1]),
    z: '10',
    projection: 'mercator',
    battles: '0',
    ...(resources ? { resources: '1' } : {}),
  })}`;
}

function knownSiteIds(from: number, to = from): string[] {
  return resourceDataset()
    .sites.filter((site) => resourceKnowledge(site).some((evidence) => evidence.fromYear <= to))
    .map((site) => site.id)
    .sort();
}

function categorySiteIds(year: number, category: ResourceCategory): string[] {
  return resourceDataset()
    .sites.filter((site) =>
      resourceKnowledge(site).some(
        (evidence) => evidence.fromYear <= year && evidence.categories.includes(category),
      ),
    )
    .map((site) => site.id)
    .sort();
}

async function editYear(page: Page, value: number) {
  await page.locator('.timeline-year').click();
  const year = page.getByRole('textbox', { name: 'Year', exact: true });
  await year.fill(String(value));
  await year.press('Enter');
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe(String(value));
}

async function observeResourceBatches(
  page: Page,
  onIcons?: (icons: string[]) => void,
): Promise<string[][]> {
  const batches: string[][] = [];
  await page.exposeFunction('recordResourceBatch', (ids: string[], icons: string[]) => {
    batches.push(ids);
    onIcons?.(icons);
  });
  // Inspect actual GeoJSON passed to MapLibre's worker before it clusters the
  // source. This test instrumentation adds no hooks to the application.
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, argumentsList) {
        const worker = Reflect.construct(target, argumentsList) as Worker;
        worker.postMessage = new Proxy(worker.postMessage, {
          apply(target, receiver, argumentsList) {
            const message = argumentsList[0] as
              | {
                  data?: {
                    source?: string;
                    data?: {
                      type?: string;
                      features?: { properties?: { id?: string; iconKey?: string } }[];
                    };
                  };
                }
              | undefined;
            const collection = message?.data?.data;
            if (
              message?.data?.source === 'strategic-resources' &&
              collection?.type === 'FeatureCollection'
            ) {
              void (
                window as unknown as {
                  recordResourceBatch: (ids: string[], icons: string[]) => Promise<void>;
                }
              ).recordResourceBatch(
                (collection.features ?? []).map((feature) => String(feature.properties?.id)).sort(),
                (collection.features ?? []).map((feature) => String(feature.properties?.iconKey)),
              );
            }
            return Reflect.apply(target, receiver, argumentsList);
          },
        });
        return worker;
      },
    });
  });
  return batches;
}

async function observeResourceImages(page: Page): Promise<Set<string>> {
  const images = new Set<string>();
  await page.exposeFunction('recordResourceImages', (ids: string[]) => {
    for (const id of ids) images.add(id);
  });
  // Observe images requested by real rendered tiles, without replacing worker
  // messages, sprite pixels, source data or any application behavior.
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, argumentsList) {
        const worker = Reflect.construct(target, argumentsList) as Worker;
        worker.addEventListener('message', (event: MessageEvent) => {
          const message = event.data as {
            type?: string;
            data?: { source?: string; icons?: string[] };
          };
          if (message.type === 'GI' && message.data?.source === 'strategic-resources')
            void (
              window as unknown as { recordResourceImages: (ids: string[]) => Promise<void> }
            ).recordResourceImages(message.data.icons ?? []);
        });
        return worker;
      },
    });
  });
  return images;
}

function mercatorY(latitude: number): number {
  return (1 - Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)) / Math.PI) / 2;
}

async function canvasPosition(page: Page, coordinates: [number, number]) {
  const parameters = new URL(page.url()).searchParams;
  const bounds = await page.locator('.maplibregl-canvas').boundingBox();
  expect(bounds).toBeTruthy();
  const worldSize = 512 * 2 ** Number(parameters.get('z'));
  return {
    x: bounds!.width / 2 + ((coordinates[0] - Number(parameters.get('lon'))) / 360) * worldSize,
    y:
      bounds!.height / 2 +
      (mercatorY(coordinates[1]) - mercatorY(Number(parameters.get('lat')))) * worldSize,
  };
}

async function mapReady(page: Page) {
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true', {
    timeout: 45_000,
  });
}

async function resourcesReady(page: Page) {
  const status = page.getByTestId('resources-status');
  await expect(status).toContainText('Known resources');
  await expect(page.getByTestId('resources-loading')).not.toBeAttached({ timeout: 30_000 });
  await expect(status.getByRole('alert')).not.toBeAttached();
}

async function collapseNotebook(page: Page) {
  const collapse = page.getByRole('button', { name: 'Collapse notebook', exact: true });
  if (await collapse.isVisible()) await collapse.click();
  await expect(page.getByRole('button', { name: 'Open notebook', exact: true })).toBeVisible();
  await expect(page.locator('.exploration-panel')).not.toBeAttached();
}

async function openCenteredSite(page: Page, site: ResourceSite) {
  const canvas = page.locator('.maplibregl-canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).toBeTruthy();
  // At pitch/bearing zero the sourced camera centre is the centre of the map canvas.
  // Retry the user action while MapLibre's GeoJSON worker makes the source queryable.
  await expect(async () => {
    // A click that lands before the site is queryable selects the territory beneath it. On
    // phones that drawer covers the canvas centre, so close it before the next attempt.
    const territory = page.getByTestId('entity-panel');
    if (await territory.isVisible())
      await territory.getByRole('button', { name: 'Close territory panel', exact: true }).click();
    await canvas.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
    await expect(
      page.getByTestId('resource-detail').getByRole('heading', { name: site.name, exact: true }),
    ).toBeVisible({ timeout: 750 });
  }).toPass({ timeout: 15_000 });
}

async function expectSeparate(first: Locator, second: Locator) {
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  expect(a).toBeTruthy();
  expect(b).toBeTruthy();
  const width = Math.min(a!.x + a!.width, b!.x + b!.width) - Math.max(a!.x, b!.x);
  const height = Math.min(a!.y + a!.height, b!.y + b!.height) - Math.max(a!.y, b!.y);
  expect(
    width > 1 && height > 1,
    'Both controls must remain visible without covering each other',
  ).toBe(false);
}

test.beforeEach(async ({ page }, testInfo) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const expectedRetryFailure =
      testInfo.title.startsWith('a failed resource request') &&
      message.location().url?.endsWith(RESOURCE_PATH) &&
      message.text().includes('503');
    if (!expectedRetryFailure) errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 960 });
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? [], 'The map must not hide browser or renderer errors').toEqual(
    [],
  );
});

test('layer controls defer resource data, share both choices and keep the notebook usable', async ({
  page,
}, testInfo) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(new URL(request.url()).pathname));
  await page.goto('/?lang=en&y=1500&projection=mercator');
  await mapReady(page);
  // Phones start with the notebook folded; open it to check it stays usable beside the layers.
  const reopen = page.getByRole('button', { name: 'Open notebook', exact: true });
  if (await reopen.isVisible()) await reopen.click();
  await expect(page.locator('.exploration-panel')).toBeVisible();
  const battles = page.getByTestId('battles-layer-toggle');
  const resources = page.getByTestId('resources-layer-toggle');
  await expect(battles).toHaveAttribute('aria-pressed', 'true');
  await expect(resources).toHaveAttribute('aria-pressed', 'false');
  expect(requested).not.toContain(RESOURCE_PATH);

  await battles.click();
  await expect(battles).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => new URL(page.url()).searchParams.get('battles')).toBe('0');
  expect(requested).not.toContain(RESOURCE_PATH);
  await resources.click();
  await expect(resources).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.get('resources')).toBe('1');
  await resourcesReady(page);
  expect(requested.filter((path) => path === RESOURCE_PATH)).toHaveLength(1);

  const legendButton = page.getByTestId('resources-legend-toggle');
  await legendButton.click();
  const legend = page.getByTestId('resource-legend');
  await expect(legend).toContainText(
    `${knownSiteIds(1500).length.toLocaleString('en')} sites known by this period`,
  );
  await expect(legend.locator('.resource-legend-list > li')).toHaveCount(
    RESOURCE_CATEGORIES.length,
  );
  await expectSeparate(page.locator('.map-layer-controls'), page.locator('.exploration-panel'));
  await expectSeparate(legend, page.locator('.exploration-panel'));
  await expectSeparate(legend, page.locator('.timeline'));
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('map-layers-legend.png'), fullPage: true });

  await legend.locator('summary').click();
  for (const source of resourceDataset().sources)
    await expect(
      legend.getByRole('link', { name: `${source.name} · ${source.year}`, exact: true }),
    ).toHaveAttribute('href', source.url);
  await legend.getByRole('heading', { name: 'Legend and sources', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(legend).not.toBeAttached();
  await expect(legendButton).toBeFocused();

  await page.reload();
  await mapReady(page);
  await resourcesReady(page);
  await expect(battles).toHaveAttribute('aria-pressed', 'false');
  await expect(resources).toHaveAttribute('aria-pressed', 'true');
  await resources.click();
  await expect(resources).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('resources-status')).not.toBeAttached();
  await expect(legendButton).not.toBeAttached();
  await expect.poll(() => new URL(page.url()).searchParams.has('resources')).toBe(false);
  await battles.click();
  await expect.poll(() => new URL(page.url()).searchParams.has('battles')).toBe(false);
  await expect(page.getByTestId('battle-detail')).not.toBeAttached();
});

test('discovery reveals a resource before production and keeps unmined projects known afterwards', async ({
  page,
}, testInfo) => {
  const discovered = (id: string, fromYear: number, longitude: number): ResourceSite => ({
    id,
    name: id,
    coordinates: [longitude, 20],
    categories: ['copper'],
    sourceId: 'discovery-fixture',
    sourceYear: 2026,
    sourceUrl: 'https://example.org/mineral-register',
    knowledge: [
      {
        fromYear,
        kind: 'discovery',
        categories: ['copper'],
        sourceUrl: `https://example.org/discovery/${encodeURIComponent(id)}`,
      },
    ],
    periods: [],
  });
  const mine = discovered('Later-producing mine', 1880, 10);
  mine.periods = [
    {
      fromYear: 1900,
      toYear: 1910,
      categories: ['copper'],
      sourceUrl: 'https://example.org/production',
    },
  ];
  const project = discovered('Unmined deposit', 1915, 10.5);
  const future = discovered('Later discovery', 1940, 11);
  const fixture: ResourceDataset = {
    version: 1,
    downloadedAt: '2026-09-23',
    description: 'Independent discovery and exploitation evidence',
    sources: [
      {
        id: 'discovery-fixture',
        name: 'Dated evidence fixture',
        year: 2026,
        url: 'https://example.org/mineral-register',
        license: 'Test data',
      },
    ],
    sites: [mine, project, future],
  };
  await page.route(`**${RESOURCE_PATH}`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    }),
  );
  const batches = await observeResourceBatches(page);
  await page.goto(siteUrl(mine, true, 1879));
  await mapReady(page);
  await collapseNotebook(page);
  await resourcesReady(page);
  await expect.poll(() => batches.at(-1)).toEqual([]);
  await editYear(page, 1880);
  await expect.poll(() => batches.at(-1)).toEqual([mine.id]);
  await openCenteredSite(page, mine);
  const detail = page.getByTestId('resource-detail');
  await expect(detail.getByTestId('resource-knowledge')).toContainText('Discovery · 1880');
  await expect(detail.getByTestId('resource-knowledge').getByRole('link')).toHaveAttribute(
    'href',
    mine.knowledge![0].sourceUrl,
  );
  await expect(detail.getByTestId('resource-exploitation-status')).toHaveAttribute(
    'data-exploitation',
    'unattested',
  );
  await editYear(page, 1905);
  await expect(detail.getByTestId('resource-exploitation-status')).toHaveAttribute(
    'data-exploitation',
    'attested',
  );
  await editYear(page, 1911);
  await expect.poll(() => batches.at(-1)).toEqual([mine.id]);
  await expect(detail.getByTestId('resource-exploitation-status')).toHaveAttribute(
    'data-exploitation',
    'unattested',
  );
  await expect(detail.getByTestId('resource-periods')).toContainText('1900 — 1910');
  await editYear(page, 1915);
  await expect.poll(() => batches.at(-1)).toEqual([mine.id, project.id].sort());
  expect(batches.at(-1)).not.toContain(future.id);

  await page.goto(siteUrl(project, true, 1915));
  await mapReady(page);
  await collapseNotebook(page);
  await resourcesReady(page);
  await openCenteredSite(page, project);
  await expect(detail.getByTestId('resource-knowledge')).toContainText('Discovery · 1915');
  await expect(detail.getByTestId('resource-no-exploitation')).toHaveText(
    'No exploitation periods documented.',
  );
  await expect(detail.getByTestId('resource-periods').locator('li')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('known-unmined-deposit.png'), fullPage: true });
  await editYear(page, 1940);
  await expect.poll(() => batches.at(-1)).toEqual([mine.id, project.id, future.id].sort());
  await expect(detail).toBeVisible();
  await editYear(page, 1914);
  await expect.poll(() => batches.at(-1)).toEqual([mine.id]);
  await expect(detail).not.toBeAttached();
});

test('the real Yme oil discovery appears in 1987 before production and persists through its shutdown', async ({
  page,
}, testInfo) => {
  const site = resourceDataset().sites.find((candidate) => candidate.id === 'sodir:43807')!;
  expect(site.name).toBe('YME');
  expect(site.knowledge).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ fromYear: 1987, kind: 'discovery', categories: ['oil'] }),
    ]),
  );
  expect(site.periods.map(({ fromYear, toYear }) => [fromYear, toYear])).toEqual([
    [1996, 2001],
    [2021, 2026],
  ]);
  const batches = await observeResourceBatches(page);
  const images = await observeResourceImages(page);
  await page.goto(siteUrl(site, true, 1986));
  await mapReady(page);
  await collapseNotebook(page);
  await resourcesReady(page);
  await expect.poll(() => batches.at(-1)?.includes(site.id)).toBe(false);

  await editYear(page, 1987);
  await expect.poll(() => batches.at(-1)?.includes(site.id)).toBe(true);
  await expect.poll(() => images.has('resource-site-oil')).toBe(true);
  await openCenteredSite(page, site);
  const detail = page.getByTestId('resource-detail');
  await expect(detail.getByTestId('resource-knowledge')).toContainText('Discovery · 1987');
  const discoverySource = detail.getByTestId('resource-knowledge').getByRole('link');
  await expect(discoverySource).toHaveAttribute(
    'href',
    'https://factpages.sodir.no/field/pageview/all/43807',
  );
  await expect(detail.getByTestId('resource-exploitation-status')).toHaveText(
    'No exploitation documented for 1987',
  );
  await discoverySource.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('yme-discovery-1987.png'), fullPage: true });

  for (const [year, status] of [
    [1996, 'attested'],
    [2002, 'unattested'],
    [2021, 'attested'],
  ] as const) {
    await editYear(page, year);
    await expect.poll(() => batches.at(-1)?.includes(site.id)).toBe(true);
    await expect(detail).toBeVisible();
    await expect(detail.getByTestId('resource-exploitation-status')).toHaveAttribute(
      'data-exploitation',
      status,
    );
    await expect(detail.getByTestId('resource-periods').locator('li')).toHaveCount(2);
    await expect(detail.getByTestId('resource-periods')).toContainText('1996 — 2001');
    await expect(detail.getByTestId('resource-periods')).toContainText('2021 — 2026');
  }
  await editYear(page, 1986);
  await expect.poll(() => batches.at(-1)?.includes(site.id)).toBe(false);
  await expect(detail).not.toBeAttached();
});

test('the real Aurora gas discovery is selectable without any invented production period', async ({
  page,
}, testInfo) => {
  const site = resourceDataset().sites.find(
    (candidate) => candidate.id === 'sodir-discovery:1333027',
  )!;
  expect(site.name).toBe('35/8-3 (Aurora)');
  expect(site.periods).toEqual([]);
  expect(site.knowledge).toEqual([
    expect.objectContaining({ fromYear: 1988, kind: 'discovery', categories: ['gas'] }),
  ]);
  const batches = await observeResourceBatches(page);
  const images = await observeResourceImages(page);
  await page.goto(siteUrl(site, true, 1987));
  await mapReady(page);
  await collapseNotebook(page);
  await resourcesReady(page);
  await expect.poll(() => batches.at(-1)?.includes(site.id)).toBe(false);
  await editYear(page, 1988);
  await expect.poll(() => batches.at(-1)?.includes(site.id)).toBe(true);
  await expect.poll(() => images.has('resource-site-gas')).toBe(true);
  await openCenteredSite(page, site);
  const detail = page.getByTestId('resource-detail');
  await expect(detail.getByTestId('resource-knowledge')).toContainText('Discovery · 1988');
  await expect(detail.getByTestId('resource-knowledge').getByRole('link')).toHaveAttribute(
    'href',
    'https://factpages.sodir.no/discovery/pageview/all/1333027',
  );
  await expect(detail.getByTestId('resource-exploitation-status')).toHaveText(
    'No exploitation documented for 1988',
  );
  await expect(detail.getByTestId('resource-no-exploitation')).toHaveText(
    'No exploitation periods documented.',
  );
  await expect(detail.getByTestId('resource-periods').locator('li')).toHaveCount(0);
  await detail.getByTestId('resource-no-exploitation').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('aurora-gas-discovery-1988.png'),
    fullPage: true,
  });
  await editYear(page, 2026);
  await expect.poll(() => batches.at(-1)?.includes(site.id)).toBe(true);
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId('resource-exploitation-status')).toHaveText(
    'No exploitation documented for 2026',
  );
  await editYear(page, 1987);
  await expect.poll(() => batches.at(-1)?.includes(site.id)).toBe(false);
  await expect(detail).not.toBeAttached();
});

test('a known mine persists through shutdowns while its exploitation evidence stays bounded', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const site = quincySite();
  const firstKnown = resourceKnowledge(site)[0].fromYear;
  const batches = await observeResourceBatches(page);
  await page.goto(siteUrl(site, true, firstKnown - 1));
  await mapReady(page);
  await collapseNotebook(page);
  await resourcesReady(page);
  for (const year of [firstKnown - 1, firstKnown, 1856, 1931, 1932, 1936, 1937, 1945, 1946]) {
    if (year !== firstKnown - 1) await editYear(page, year);
    await expect.poll(() => batches.at(-1), { timeout: 15_000 }).toEqual(knownSiteIds(year));
    expect(batches.at(-1)!.includes(site.id)).toBe(year >= firstKnown);
    if (year >= firstKnown) {
      if (!(await page.getByTestId('resource-detail').isVisible()))
        await openCenteredSite(page, site);
      const detail = page.getByTestId('resource-detail');
      await expect(detail).toBeVisible();
      const operating = site.periods.some(
        (period) => period.fromYear <= year && period.toYear >= year,
      );
      await expect(detail.getByTestId('resource-exploitation-status')).toHaveAttribute(
        'data-exploitation',
        operating ? 'attested' : 'unattested',
      );
      await expect(detail.getByTestId('resource-knowledge')).toContainText(String(firstKnown));
      await expect(detail.getByTestId('resource-periods').locator('li')).toHaveCount(2);
      await expect(detail.getByTestId('resource-periods')).toContainText('1856 — 1931');
      await expect(detail.getByTestId('resource-periods')).toContainText('1937 — 1945');
      await expect(
        detail.getByRole('link', { name: 'Location source', exact: true }),
      ).toHaveAttribute('href', site.coordinateSourceUrl ?? site.sourceUrl);
      for (const period of site.periods)
        await expect(
          detail.getByRole('link', {
            name: `Source for these dates · ${period.fromYear} — ${period.toYear}`,
            exact: true,
          }),
        ).toHaveAttribute('href', period.sourceUrl);
      if (year === 1856)
        await page.screenshot({ path: testInfo.outputPath('resource-source.png'), fullPage: true });
      // Keep the dossier selected across shutdowns. Its status changes while
      // the known resource and the original sourced intervals remain available.
    } else {
      await expect(page.getByTestId('resource-detail')).not.toBeAttached();
    }
  }
  await editYear(page, firstKnown - 1);
  await expect(page.getByTestId('resource-detail')).not.toBeAttached();
});

test('a displayed range filters source data before clustering and survives layer toggles', async ({
  page,
}) => {
  const site = quincySite();
  const batches = await observeResourceBatches(page);
  await page.goto('/?lang=en&y=1934&resources=1&z=1.8');
  await mapReady(page);
  await resourcesReady(page);
  await expect.poll(() => batches.at(-1)).toEqual(knownSiteIds(1934));
  expect(batches.at(-1)!.includes(site.id)).toBe(true);
  await page.getByRole('button', { name: 'Period', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('from')).toBe('1884');
  await expect.poll(() => new URL(page.url()).searchParams.get('to')).toBe('1984');
  await expect.poll(() => batches.at(-1)).toEqual(knownSiteIds(1884, 1984));
  expect(batches.at(-1)!.includes(site.id)).toBe(true);
  await page.getByTestId('resources-legend-toggle').click();
  await expect(page.getByTestId('resource-visible-count')).toHaveText(
    `${knownSiteIds(1884, 1984).length.toLocaleString('en')} sites known by this period`,
  );
  await expect(page.getByTestId('resource-total-count')).toHaveText(
    `${resourceDataset().sites.length.toLocaleString('en')} dated sites in the full dataset`,
  );
  await page.getByTestId('resources-layer-toggle').click();
  await expect(page.getByTestId('resource-legend')).not.toBeAttached();
  await page.getByTestId('resources-layer-toggle').click();
  await resourcesReady(page);
  await expect(page.getByTestId('battles-layer-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.get('from')).toBe('1884');
  await page.getByRole('button', { name: 'Clear period', exact: true }).click();
  await expect.poll(() => batches.at(-1)).toEqual(knownSiteIds(1934));
  expect(batches.at(-1)!.includes(site.id)).toBe(true);
});

test('automatic playback keeps resource symbols visible with normal motion and settles the paused year', async ({
  page,
}, testInfo) => {
  // The normal 350ms symbol fade exposed a regression hidden by reduced-motion
  // tests: hiding all layers on every new year continually reset their placement.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const site = resourceDataset().sites.find((candidate) => /falun/i.test(candidate.name))!;
  const batches = await observeResourceBatches(page);
  const hiddenLayers: { year?: string; ids: string[] }[] = [];
  await page.exposeFunction(
    'recordHiddenResourceLayers',
    (record: { year?: string; ids: string[] }) => hiddenLayers.push(record),
  );
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, argumentsList) {
        const worker = Reflect.construct(target, argumentsList) as Worker;
        worker.postMessage = new Proxy(worker.postMessage, {
          apply(target, receiver, argumentsList) {
            const message = argumentsList[0] as {
              type?: string;
              data?: { layers?: { id: string; layout?: { visibility?: string } }[] };
            };
            const ids = message.data?.layers
              ?.filter(
                (layer) => layer.id.startsWith('resource-') && layer.layout?.visibility === 'none',
              )
              .map((layer) => layer.id);
            if (message.type === 'UL' && ids?.length)
              void (
                window as unknown as {
                  recordHiddenResourceLayers: (record: {
                    year?: string;
                    ids: string[];
                  }) => Promise<void>;
                }
              ).recordHiddenResourceLayers({
                year: document.querySelector('.timeline-year')?.textContent ?? undefined,
                ids,
              });
            return Reflect.apply(target, receiver, argumentsList);
          },
        });
        return worker;
      },
    });
  });
  await page.goto(`${siteUrl(site, true, 1900)}&speed=100`);
  await mapReady(page);
  await collapseNotebook(page);
  await resourcesReady(page);
  await openCenteredSite(page, site);
  await page
    .getByTestId('resource-detail')
    .getByRole('button', { name: 'Close resource information', exact: true })
    .click();
  await page.getByTestId('timeline-play').click();
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('y')), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(1905);
  await page.screenshot({ path: testInfo.outputPath('resources-playing.png'), fullPage: true });
  await page.getByTestId('timeline-play').click();
  await expect(page.getByTestId('timeline-play')).toHaveAttribute('aria-label', 'Play timeline');
  const pausedYear = Number((await page.locator('.timeline-year').innerText()).match(/\d+/)?.[0]);
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe(String(pausedYear));
  await expect.poll(() => batches.at(-1)).toEqual(knownSiteIds(pausedYear));
  expect(batches.at(-1)).toContain(site.id);
  await openCenteredSite(page, site);
  await editYear(page, 1993);
  await expect.poll(() => batches.at(-1)).toEqual(knownSiteIds(1993));
  await expect(page.getByTestId('resource-detail')).toBeVisible();
  await expect(page.getByTestId('resource-exploitation-status')).toHaveText(
    'No exploitation documented for 1993',
  );
  expect(batches.at(-1)).toContain(site.id);
  expect(
    hiddenLayers,
    'Year updates must preserve symbol placement instead of hiding every layer',
  ).toEqual([]);
});

test('a resource cluster pictogram and its counter lead to selectable sourced site icons', async ({
  page,
}, testInfo) => {
  const falun = resourceDataset().sites.find((site) => /falun/i.test(site.name))!;
  const roros = resourceDataset().sites.find((site) => /røros/i.test(site.name))!;
  expect(falun).toBeTruthy();
  expect(roros).toBeTruthy();
  expect(knownSiteIds(1700)).toEqual(expect.arrayContaining([falun.id, roros.id]));
  // Zoom 2 keeps this Scandinavian pair together while separating the newly
  // documented central-European mines. Centre their projected midpoint,
  // independently of the map API.
  const initialZoom = 2;
  const center: [number, number] = [
    (falun.coordinates[0] + roros.coordinates[0]) / 2,
    (Math.atan(
      Math.sinh(Math.PI * (1 - mercatorY(falun.coordinates[1]) - mercatorY(roros.coordinates[1]))),
    ) *
      180) /
      Math.PI,
  ];
  const parameters = new URLSearchParams({
    lang: 'en',
    y: '1700',
    lon: String(center[0]),
    lat: String(center[1]),
    z: String(initialZoom),
    projection: 'mercator',
    battles: '0',
    resources: '1',
  });
  const images = await observeResourceImages(page);
  await page.goto(`/?${parameters}`);
  await mapReady(page);
  await collapseNotebook(page);
  await resourcesReady(page);
  await expect.poll(() => images.has('resource-group-copper')).toBe(true);
  const canvas = page.locator('.maplibregl-canvas');
  const cluster = await canvasPosition(page, center);
  const counter = { x: cluster.x, y: cluster.y + 15 };
  await expect(async () => {
    await canvas.hover({ position: counter });
    await expect(canvas).toHaveCSS('cursor', 'pointer', { timeout: 750 });
  }).toPass({ timeout: 15_000 });
  await page.screenshot({ path: testInfo.outputPath('resource-cluster-icon.png'), fullPage: true });
  await canvas.click({ position: counter });
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('z')))
    .toBeGreaterThan(initialZoom);
  await expect(page.getByTestId('resource-detail')).not.toBeAttached();
  await expect(page.getByTestId('event-panel')).not.toBeAttached();
  await expect(page.getByTestId('entity-panel')).not.toBeAttached();
  await expect.poll(() => images.has('resource-site-copper')).toBe(true);
  await expect(async () => {
    await canvas.click({ position: await canvasPosition(page, falun.coordinates) });
    await expect(
      page.getByTestId('resource-detail').getByRole('heading', { name: falun.name, exact: true }),
    ).toBeVisible({ timeout: 750 });
  }).toPass({ timeout: 15_000 });
  const detail = page.getByTestId('resource-detail');
  await expect(
    detail.getByRole('link', { name: /^Source for these dates/ }).first(),
  ).toHaveAttribute('href', falun.periods[0].sourceUrl);
  await detail.getByRole('button', { name: 'Close resource information', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('resource-site-icons.png'), fullPage: true });
});

test('Mali gold adds modern mines while preserving known medieval regions', async ({
  page,
}, testInfo) => {
  const medieval = resourceDataset().sites.find((site) => site.id === 'west-africa:bambuk')!;
  const bure = resourceDataset().sites.find((site) => site.id === 'west-africa:bure')!;
  const modern = resourceDataset().sites.find((site) => site.id === 'west-africa:fekola')!;
  expect(medieval).toBeTruthy();
  expect(bure).toBeTruthy();
  expect(modern).toBeTruthy();
  const batches = await observeResourceBatches(page);
  await page.goto(siteUrl(medieval, true, 1324));
  await mapReady(page);
  await collapseNotebook(page);
  await resourcesReady(page);
  await expect.poll(() => batches.at(-1)).toEqual(knownSiteIds(1324));
  expect(batches.at(-1)).toEqual(expect.arrayContaining([medieval.id, bure.id]));
  expect(batches.at(-1)).not.toContain(modern.id);
  await openCenteredSite(page, medieval);
  const detail = page.getByTestId('resource-detail');
  await expect(detail.locator('abbr[title="Approximate dates"]').first()).toBeVisible();
  const medievalPeriod = medieval.periods.find(
    (period) => period.fromYear <= 1324 && period.toYear >= 1324,
  )!;
  await expect(
    detail.getByRole('link', {
      name: `Source for these dates · ${medievalPeriod.fromYear} — ${medievalPeriod.toYear}`,
      exact: true,
    }),
  ).toHaveAttribute('href', medievalPeriod.sourceUrl);
  await page.screenshot({ path: testInfo.outputPath('mali-gold-1324.png'), fullPage: true });

  await editYear(page, 2025);
  await expect.poll(() => batches.at(-1)).toEqual(knownSiteIds(2025));
  expect(batches.at(-1)).toContain(modern.id);
  expect(batches.at(-1)).toEqual(expect.arrayContaining([medieval.id, bure.id]));
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId('resource-exploitation-status')).toHaveText(
    'No exploitation documented for 2025',
  );

  await page.goto(siteUrl(modern, true, 2025));
  await mapReady(page);
  await collapseNotebook(page);
  await resourcesReady(page);
  await openCenteredSite(page, modern);
  const modernPeriod = modern.periods.find(
    (period) => period.fromYear <= 2025 && period.toYear >= 2025,
  )!;
  await expect(
    page.getByTestId('resource-detail').getByRole('link', {
      name: `Source for these dates · ${modernPeriod.fromYear} — ${modernPeriod.toYear}`,
      exact: true,
    }),
  ).toHaveAttribute('href', modernPeriod.sourceUrl);
  await page.screenshot({ path: testInfo.outputPath('mali-gold-2025.png'), fullPage: true });
  await editYear(page, 1324);
  await expect.poll(() => batches.at(-1)).toEqual(knownSiteIds(1324));
  await expect(page.getByTestId('resource-detail')).not.toBeAttached();
});

test('a resource filter reveals copper icons and preserves other category counts across periods', async ({
  page,
}, testInfo) => {
  const site = resourceDataset().sites.find((candidate) => /olympic dam/i.test(candidate.name))!;
  expect(site).toBeTruthy();
  const copperIds = (year: number) => categorySiteIds(year, 'copper');
  const icons: string[][] = [];
  const batches = await observeResourceBatches(page, (batch) => icons.push(batch));
  const images = await observeResourceImages(page);
  await page.goto(siteUrl(site, true, 2025).replace('z=10', 'z=1'));
  await mapReady(page);
  await collapseNotebook(page);
  await resourcesReady(page);
  await page.getByTestId('resources-legend-toggle').click();
  const coalCount = await page
    .getByTestId('resource-filter-coal')
    .locator('.resource-category-count')
    .innerText();
  await page.getByTestId('resource-filter-copper').click();
  await expect(page.getByTestId('resource-filter-copper')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => batches.at(-1)).toEqual(copperIds(2025));
  expect(icons.at(-1)).toEqual(copperIds(2025).map(() => 'copper'));
  await expect.poll(() => images.has('resource-group-copper')).toBe(true);
  await expect(page.getByTestId('resource-filtered-count')).toHaveText(
    `${copperIds(2025).length.toLocaleString('en')} sites shown · Copper`,
  );
  await expect(
    page.getByTestId('resource-filter-coal').locator('.resource-category-count'),
  ).toHaveText(coalCount);
  await expect(page.getByTestId('resource-visible-count')).toHaveText(
    `${knownSiteIds(2025).length.toLocaleString('en')} sites known by this period`,
  );
  await page.getByTestId('resources-legend-toggle').click();
  await page.getByTestId('resources-layer-toggle').click();
  await page.getByTestId('resources-layer-toggle').click();
  await resourcesReady(page);
  await expect(page.getByTestId('resources-active-filter')).toHaveText('Resource filter · Copper');
  await editYear(page, 1812);
  await expect.poll(() => batches.at(-1)).toEqual(copperIds(1812));
  await editYear(page, 2026);
  await page.getByTestId('resources-legend-toggle').click();
  for (const category of ['copper', 'lithium', 'rare-earths'] as const) {
    const expected = categorySiteIds(2026, category);
    expect(expected.length, `The current corpus documents ${category} in 2026`).toBeGreaterThan(0);
    await page.getByTestId(`resource-filter-${category}`).click();
    await expect.poll(() => batches.at(-1)).toEqual(expected);
    expect(icons.at(-1)).toEqual(expected.map(() => category));
    await expect(
      page.getByTestId(`resource-filter-${category}`).locator('.resource-category-count'),
    ).toHaveText(expected.length.toLocaleString('en'));
  }
  await page.getByTestId('resource-filter-copper').click();
  await page.getByTestId('resources-legend-toggle').click();
  await editYear(page, 2025);
  await expect.poll(() => batches.at(-1)).toEqual(copperIds(2025));

  for (let step = 0; step < 11; step++) {
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect
      .poll(() => Number(new URL(page.url()).searchParams.get('z')))
      .toBeGreaterThan(1 + step * 0.8);
  }
  await expect.poll(() => images.has('resource-site-copper')).toBe(true);
  await openCenteredSite(page, site);
  // Filtering the pictogram must retain all dated commodities in the dossier.
  await expect(page.getByTestId('resource-detail').locator('.resource-categories')).toContainText(
    'Uranium',
  );
  await page
    .getByTestId('resource-detail')
    .getByRole('button', { name: 'Close resource information', exact: true })
    .click();
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('fr');
  await page.getByTestId('resources-legend-toggle').click();
  await expect(page.getByTestId('resources-active-filter')).toHaveText('Filtre ressource · Cuivre');
  await expect(page.getByTestId('resource-filtered-count')).toContainText(
    'sites affichés · Cuivre',
  );
  await page.screenshot({
    path: testInfo.outputPath('resource-copper-filter.png'),
    fullPage: true,
  });
  await page.getByTestId('resource-filter-all').click();
  await expect.poll(() => batches.at(-1)).toEqual(knownSiteIds(2025));
  await expect(page.getByTestId('resource-filter-all')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('resources-active-filter')).not.toBeAttached();
});

test('the 2026 uranium filter includes the global corpus and opens a sourced Kazakhstan mine', async ({
  page,
}, testInfo) => {
  const site = resourceDataset().sites.find(
    (candidate) => candidate.id === 'current-uranium:inkai',
  );
  expect(site, 'The current corpus must include the producing Inkai mine').toBeTruthy();
  const expected = categorySiteIds(2026, 'uranium');
  expect(expected).toEqual(
    expect.arrayContaining([site!.id, 'current-uranium:rossing', 'current-major:cigar-lake']),
  );
  const icons: string[][] = [];
  const batches = await observeResourceBatches(page, (batch) => icons.push(batch));
  const images = await observeResourceImages(page);
  await page.goto(siteUrl(site!, true, 2026));
  await mapReady(page);
  await collapseNotebook(page);
  await resourcesReady(page);
  await page.getByTestId('resources-legend-toggle').click();
  const filter = page.getByTestId('resource-filter-uranium');
  await filter.scrollIntoViewIfNeeded();
  await filter.click();
  await expect(filter).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => batches.at(-1)).toEqual(expected);
  expect(icons.at(-1)).toEqual(expected.map(() => 'uranium'));
  await expect(filter.locator('.resource-category-count')).toHaveText(
    expected.length.toLocaleString('en'),
  );
  await expect.poll(() => images.has('resource-site-uranium')).toBe(true);
  await page.getByTestId('resources-legend-toggle').click();
  await page.screenshot({
    path: testInfo.outputPath('uranium-kazakhstan-map-2026.png'),
    fullPage: true,
  });
  await openCenteredSite(page, site!);
  const detail = page.getByTestId('resource-detail');
  await expect(detail.locator('.resource-facts')).toContainText('Kazakhstan');
  await expect(detail.locator('.resource-categories')).toContainText('Uranium');
  const evidence = detail.locator('[aria-current="date"]');
  await expect(evidence).toContainText('2026');
  await expect(
    evidence.getByRole('link', { name: 'Source for these dates · 2026', exact: true }),
  ).toHaveAttribute('href', 'https://www.kazatomprom.kz/storage/9f/6m_2026_ofr_eng.pdf');
  await page.screenshot({
    path: testInfo.outputPath('uranium-kazakhstan-2026.png'),
    fullPage: true,
  });
  await evidence.getByRole('link').scrollIntoViewIfNeeded();
  await expect(evidence.getByRole('link')).toBeVisible();
});

test('the 2026 rare-earth filter renders sourced mines in Australia China and Myanmar', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const sites = [
    resourceDataset().sites.find(
      (site) => site.name === 'Mount Weld' && site.country === 'Australia',
    ),
    resourceDataset().sites.find((site) => site.id === 'current-ree:maoniuping'),
    resourceDataset().sites.find(
      (site) => site.id === 'stimson-ree:ee8da6ef-aad9-44c7-92d9-04a0bd84eff6',
    ),
  ];
  for (const [index, country] of ['Australia', 'China', 'Myanmar'].entries())
    expect(
      sites[index],
      `The current corpus must include a reviewed ${country} rare-earth mine`,
    ).toBeTruthy();
  const expected = categorySiteIds(2026, 'rare-earths');
  expect(expected).toEqual(expect.arrayContaining(sites.map((site) => site!.id)));
  const icons: string[][] = [];
  const batches = await observeResourceBatches(page, (batch) => icons.push(batch));
  const images = await observeResourceImages(page);

  for (const site of sites as ResourceSite[]) {
    // A new document and fresh sprite observations prove each region renders;
    // previously observed Australian icons cannot satisfy the Myanmar check.
    images.clear();
    await page.goto(siteUrl(site, true, 2026).replace('z=10', 'z=12'));
    await mapReady(page);
    await collapseNotebook(page);
    await resourcesReady(page);
    await page.getByTestId('resources-legend-toggle').click();
    const filter = page.getByTestId('resource-filter-rare-earths');
    await filter.scrollIntoViewIfNeeded();
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => batches.at(-1)).toEqual(expected);
    expect(icons.at(-1)).toEqual(expected.map(() => 'rare-earths'));
    await expect(filter.locator('.resource-category-count')).toHaveText(
      expected.length.toLocaleString('en'),
    );
    await page.getByTestId('resources-legend-toggle').click();
    await expect.poll(() => images.has('resource-site-rare-earths')).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`rare-earths-${site.country!.toLowerCase()}-map-2026.png`),
      fullPage: true,
    });
    await openCenteredSite(page, site);
    const detail = page.getByTestId('resource-detail');
    await expect(detail.locator('.resource-facts')).toContainText(site.country!);
    const currentPeriods = site.periods.filter(
      (period) =>
        period.fromYear <= 2026 &&
        period.toYear >= 2026 &&
        (period.categories ?? site.categories).includes('rare-earths'),
    );
    expect(currentPeriods.length).toBeGreaterThan(0);
    const evidenceLinks = await detail
      .locator('[aria-current="date"] a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(evidenceLinks).toEqual(
      expect.arrayContaining(currentPeriods.map((period) => period.sourceUrl)),
    );
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`rare-earths-${site.country!.toLowerCase()}-2026.png`),
      fullPage: true,
    });
    const visibleSource = detail.locator('[aria-current="date"] a').first();
    await visibleSource.scrollIntoViewIfNeeded();
    await expect(visibleSource).toBeVisible();
  }
});

test('approximate ancient dates and empty periods distinguish missing evidence from activity', async ({
  page,
}, testInfo) => {
  const site = resourceDataset().sites.find((candidate) => /great orme/i.test(candidate.name))!;
  expect(site).toBeTruthy();
  expect(site.periods[0]).toMatchObject({ fromYear: -1699, toYear: -899, approximate: true });
  const batches = await observeResourceBatches(page);
  await page.goto(siteUrl(site, true, -1600));
  await mapReady(page);
  await collapseNotebook(page);
  await resourcesReady(page);
  await openCenteredSite(page, site);
  const detail = page.getByTestId('resource-detail');
  await expect(detail.getByTestId('resource-periods')).toContainText('1700 BCE — 900 BCE');
  await expect(
    detail.getByTestId('resource-periods').locator('abbr[title="Approximate dates"]'),
  ).toHaveText('≈');
  await page.screenshot({
    path: testInfo.outputPath('resource-ancient-period.png'),
    fullPage: true,
  });
  await detail.getByRole('button', { name: 'Close resource information', exact: true }).click();
  // Prefer a coverage gap with a valid event archive. Some unrelated ancient
  // singleton event shards have degenerate PMTiles bounds (for example -2500).
  const emptyYear = [-2700, -2000, -3000, 400, 600, -500].find(
    (year) => knownSiteIds(year).length === 0,
  );
  expect(
    emptyYear,
    'The source corpus must have a documented coverage gap for this check',
  ).toBeDefined();
  await editYear(page, emptyYear!);
  await expect.poll(() => batches.at(-1)).toEqual([]);
  await expect(page.getByTestId('resources-empty')).toHaveText(
    'No known sites documented by this period.',
  );
  await page.getByTestId('resources-legend-toggle').click();
  await expect(page.getByTestId('resource-legend')).toContainText(
    'Missing data does not establish an absence of activity.',
  );
  await expect(page.getByTestId('resource-visible-count')).toHaveText(
    '0 sites known by this period',
  );
  await expect(page.getByTestId('resource-total-count')).toHaveText(
    `${resourceDataset().sites.length.toLocaleString('en')} dated sites in the full dataset`,
  );
});

test('a delayed resource load stays hidden and uses the latest year before being reused', async ({
  page,
}) => {
  const site = quincySite();
  const batches = await observeResourceBatches(page);
  let release!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route(`**${RESOURCE_PATH}`, async (route) => {
    requests += 1;
    await paused;
    await route.continue();
  });
  await page.goto(siteUrl(site));
  await mapReady(page);
  await collapseNotebook(page);
  try {
    await page.getByTestId('resources-layer-toggle').click();
    await expect.poll(() => requests).toBe(1);
    await expect(page.getByTestId('resources-loading')).toBeVisible();
    await page.getByTestId('resources-layer-toggle').click();
    await expect(page.getByTestId('resources-status')).not.toBeAttached();
    await editYear(page, 1934);
    const response = page.waitForResponse(
      (response) => new URL(response.url()).pathname === RESOURCE_PATH,
    );
    release();
    await (await response).finished();
    await expect(page.getByTestId('resource-detail')).not.toBeAttached();
    await expect(page.getByTestId('resources-layer-toggle')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect.poll(() => new URL(page.url()).searchParams.has('resources')).toBe(false);
    await page.getByTestId('resources-layer-toggle').click();
    await resourcesReady(page);
    await expect.poll(() => batches.at(-1)).toEqual(knownSiteIds(1934));
    expect(batches.at(-1)!.includes(site.id)).toBe(true);
    await editYear(page, 1937);
    await expect.poll(() => batches.at(-1)).toEqual(knownSiteIds(1937));
    await openCenteredSite(page, site);
    expect(requests).toBe(1);
  } finally {
    release();
  }
});

test('a failed resource request can be retried without disabling the map or losing the layer choice', async ({
  page,
}) => {
  let requests = 0;
  // The client already retries a 5xx twice with backoff; the outage outlasts those attempts.
  const automaticAttempts = 3;
  await page.route(`**${RESOURCE_PATH}`, async (route) => {
    requests += 1;
    if (requests <= automaticAttempts)
      await route.fulfill({ status: 503, body: 'Temporarily unavailable' });
    else await route.continue();
  });
  await page.goto('/?lang=en&y=1500');
  await mapReady(page);
  await page.getByTestId('resources-layer-toggle').click();
  const status = page.getByTestId('resources-status');
  await expect(status.getByRole('alert')).toContainText('Resource locations could not be loaded.');
  expect(requests).toBe(automaticAttempts);
  await expect(page.getByTestId('resources-layer-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('year-slider')).toBeVisible();
  await status.getByRole('button', { name: 'Try again', exact: true }).click();
  await resourcesReady(page);
  await page.getByTestId('resources-legend-toggle').click();
  await expect(page.getByTestId('resource-legend')).toContainText(
    `${knownSiteIds(1500).length.toLocaleString('en')} sites known by this period`,
  );
  expect(requests).toBe(automaticAttempts + 1);
  await expect.poll(() => new URL(page.url()).searchParams.get('resources')).toBe('1');
});

test('hiding battles releases an animated reconstruction and showing them again stays paused', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/?battle=1&e=Q48314&y=1815&lon=4.4122&lat=50.6781&z=15.5&pitch=60&lang=en');
  const map = page.locator('[data-battle-status]');
  await expect(map).toHaveAttribute('data-battle-status', 'ready', { timeout: 45_000 });
  await page.getByTestId('battle-play').click();
  await expect
    .poll(async () => Number(await map.getAttribute('data-battle-progress')))
    .toBeGreaterThan(0.025);
  await page.getByTestId('battles-layer-toggle').click();
  await expect(page.getByTestId('battle-detail')).not.toBeAttached();
  await expect(map).toHaveAttribute('data-battle-status', 'empty');
  await expect(map).toHaveAttribute('data-battle-models', '0');
  await expect.poll(() => new URL(page.url()).searchParams.get('battles')).toBe('0');
  await expect.poll(() => new URL(page.url()).searchParams.has('battle')).toBe(false);
  await expect.poll(() => new URL(page.url()).searchParams.has('e')).toBe(false);
  await expect(page.getByTestId('timeline-play')).toHaveAttribute('aria-label', 'Play timeline');
  await page.getByTestId('battles-layer-toggle').click();
  await expect(page.getByTestId('battles-layer-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('battle-mode-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(map).toHaveAttribute('data-battle-models', '0');
  await expect(page.getByTestId('battle-play')).not.toBeAttached();
});

test('resource information remains actionable above an open historical dossier', async ({
  page,
}, testInfo) => {
  await page.goto('/?e=Q48314&y=1815&lon=4.4122&lat=50.6781&z=4.5&lang=en');
  await mapReady(page);
  const dossier = page.getByTestId('event-panel');
  await expect(dossier).toBeVisible();
  await page.getByTestId('resources-layer-toggle').click();
  await resourcesReady(page);
  await page.getByTestId('resources-legend-toggle').click();
  const legend = page.getByTestId('resource-legend');
  const close = legend.getByRole('button', { name: 'Close resource information', exact: true });
  await close.click({ trial: true });
  await legend.locator('summary').click();
  const firstSource = resourceDataset().sources[0];
  const source = legend.getByRole('link', {
    name: `${firstSource.name} · ${firstSource.year}`,
    exact: true,
  });
  await source.click({ trial: true });
  await expect(dossier).toBeAttached();
  await page.screenshot({
    path: testInfo.outputPath('resources-above-dossier.png'),
    fullPage: true,
  });
  await close.click();
  await expect(legend).not.toBeAttached();
  await expect(dossier).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('e')).toBe('Q48314');
});

test('the heatmap key never sits under an open dossier or over the compass', async ({ page }) => {
  // Tall enough that the compass is shown (it is hidden below 760px).
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?mode=heatmap&y=1815&lon=4.4122&lat=50.6781&z=4.5&lang=en');
  await mapReady(page);
  const key = page.getByTestId('density-key');
  await expect(key).toBeVisible();
  await expect(page.locator('.world-compass')).toBeHidden();
  await page.goto('/?mode=heatmap&e=Q48314&y=1815&lon=4.4122&lat=50.6781&z=4.5&lang=en');
  await mapReady(page);
  await expect(page.getByTestId('event-panel')).toBeVisible();
  await expect(key).toBeAttached();
  await expect(key).toBeHidden();
});

test('the ordinary map removes battle points from clustering while retaining other event types', async ({
  page,
}, testInfo) => {
  type ClusterPoint = { id: string; type: string };
  const batches: ClusterPoint[][] = [];
  const emissions: unknown[] = [];
  await page.exposeFunction(
    'recordLayerClusterQuery',
    (points: ClusterPoint[], metadata: unknown) => {
      batches.push(points);
      emissions.push({
        metadata,
        total: points.length,
        counts: Object.fromEntries(
          [...new Set(points.map((point) => point.type))].map((type) => [
            type,
            points.filter((point) => point.type === type).length,
          ]),
        ),
      });
    },
  );
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, argumentsList) {
        const worker = Reflect.construct(target, argumentsList) as Worker;
        worker.postMessage = new Proxy(worker.postMessage, {
          apply(target, receiver, argumentsList) {
            const message = argumentsList[0] as
              { token?: number; points?: { id: string; type: string }[] } | undefined;
            if (Array.isArray(message?.points))
              void (
                window as unknown as {
                  recordLayerClusterQuery: (
                    points: { id: string; type: string }[],
                    metadata: unknown,
                  ) => Promise<void>;
                }
              ).recordLayerClusterQuery(
                message.points.map(({ id, type }) => ({ id, type })),
                {
                  token: message.token,
                  time: performance.now(),
                  battlesVisible: document
                    .querySelector('[data-testid="battles-layer-toggle"]')
                    ?.getAttribute('aria-pressed'),
                },
              );
            return Reflect.apply(target, receiver, argumentsList);
          },
        });
        return worker;
      },
    });
  });
  await page.goto('/?lang=en&y=1812&z=1.8&lon=18&lat=32&from=1700&to=2000');
  await mapReady(page);
  const isBattle = (point: ClusterPoint) => ['battle', 'siege', 'naval'].includes(point.type);
  const isOther = (point: ClusterPoint) => ['treaty', 'war', 'campaign'].includes(point.type);
  await expect.poll(() => batches.at(-1)?.some(isBattle) ?? false, { timeout: 30_000 }).toBe(true);
  const initial = batches.at(-1)!;
  const otherTypes = [...new Set(initial.filter(isOther).map((point) => point.type))];
  expect(
    otherTypes.length,
    'The viewport must include other conflict events to test selective hiding',
  ).toBeGreaterThan(0);
  const beforeHide = batches.length;

  await page.getByTestId('battles-layer-toggle').click();
  await expect.poll(() => batches.length, { timeout: 30_000 }).toBeGreaterThan(beforeHide);
  try {
    await expect.poll(() => batches.at(-1)?.some(isBattle) ?? true).toBe(false);
  } finally {
    const diagnostics = testInfo.outputPath('cluster-emissions.json');
    writeFileSync(diagnostics, JSON.stringify(emissions, null, 2));
    await testInfo.attach('cluster-emissions', {
      path: diagnostics,
      contentType: 'application/json',
    });
  }
  // Tile refinement can change individual viewport hits; the remaining event
  // categories must remain queryable after the battle-only filter is applied.
  expect([
    ...new Set(
      batches
        .at(-1)!
        .filter(isOther)
        .map((point) => point.type),
    ),
  ]).toEqual(expect.arrayContaining(otherTypes));
  const beforeShow = batches.length;
  await page.getByTestId('battles-layer-toggle').click();
  await expect.poll(() => batches.length, { timeout: 30_000 }).toBeGreaterThan(beforeShow);
  await expect.poll(() => batches.at(-1)?.some(isBattle) ?? false).toBe(true);
  await expect(page.getByTestId('battle-mode-toggle')).toHaveAttribute('aria-pressed', 'false');
});
