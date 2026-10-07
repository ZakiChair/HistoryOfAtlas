import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { GeoJSONSource, Map as HistoricalMap } from 'maplibre-gl';
import type { ChangesDataset } from '../../lib/context/changes';
import type { NetworkDataset } from '../../lib/context/networks';

const changes = JSON.parse(
  readFileSync(new URL('../../public/data/context/changes.json', import.meta.url), 'utf8'),
) as ChangesDataset;
const networks = JSON.parse(
  readFileSync(new URL('../../public/data/context/networks.json', import.meta.url), 'utf8'),
) as NetworkDataset;
const vienna = changes.changes.find((change) => change.id === 'vienna-1815')!;
const silkRoads = networks.networks.find(
  (network) => network.id === 'silk-roads-changan-tianshan',
)!;
const galleons = networks.networks.find((network) => network.id === 'manila-acapulco-galleons')!;
const babylon = changes.changes.find((change) => change.id === 'babylon-539-bce')!;
const networks1815 = [
  'camino-real-tierra-adentro',
  'manila-acapulco-galleons',
  'transatlantic-forced-migration',
];

async function captureMap(page: Page) {
  // Read the map's existing React ref, as in territory-selection; no production debug API.
  await expect
    .poll(() =>
      page.evaluate(() => {
        type Hook = { memoizedState?: { current?: HistoricalMap }; next?: Hook };
        type Fiber = { memoizedState?: Hook; return?: Fiber };
        const element = document.querySelector('.world-map');
        if (!element) return false;
        const key = Object.keys(element).find((key) => key.startsWith('__reactFiber'));
        if (!key) return false;
        let fiber = (element as unknown as Record<string, Fiber>)[key];
        for (; fiber; fiber = fiber.return!) {
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const map = hook.memoizedState?.current;
            if (map && typeof map.getStyle === 'function' && typeof map.loaded === 'function') {
              if (!map.loaded() || !map.getSource('historical-context')) return false;
              (window as unknown as { contextMap: HistoricalMap }).contextMap = map;
              return true;
            }
          }
        }
        return false;
      }),
    )
    .toBe(true);
}

async function renderedContext(page: Page, layer: 'context-points' | 'context-lines') {
  return page.evaluate((layer) => {
    const map = (window as unknown as { contextMap: HistoricalMap }).contextMap;
    return map.queryRenderedFeatures(undefined, { layers: [layer] }).map((feature) => ({
      id: feature.properties.id as string,
      geometry: feature.geometry.type,
    }));
  }, layer);
}

async function sourceIds(page: Page) {
  return page.evaluate(async () => {
    const map = (window as unknown as { contextMap: HistoricalMap }).contextMap;
    const data = await (map.getSource('historical-context') as GeoJSONSource).getData();
    return data.type === 'FeatureCollection'
      ? data.features.map((feature) => feature.properties?.id as string)
      : [];
  });
}

test('context map points select their reading and networks obey the dated window', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  // The point must remain outside the reader; mobile panel geometry has a separate test.
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    `/?lang=en&y=1815&context=changes&lon=${vienna.coordinates[0]}&lat=${vienna.coordinates[1]}&z=3&projection=mercator`,
  );
  await expect(page.getByTestId('context-changes')).toBeVisible();
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
  await captureMap(page);
  await expect
    .poll(async () =>
      (await renderedContext(page, 'context-points')).some((item) => item.id === vienna.id),
    )
    .toBe(true);

  const target = await page.evaluate((coordinates) => {
    const map = (window as unknown as { contextMap: HistoricalMap }).contextMap;
    const point = map.project(coordinates);
    const rectangle = map.getCanvas().getBoundingClientRect();
    return { x: point.x + rectangle.x, y: point.y + rectangle.y };
  }, vienna.coordinates);
  const panelBox = await page.getByTestId('context-panel').boundingBox();
  expect(target.x).toBeGreaterThan(panelBox!.x + panelBox!.width);
  await page.mouse.click(target.x, target.y);
  await expect.poll(() => new URL(page.url()).searchParams.get('contextItem')).toBe(vienna.id);
  await expect(
    page.getByTestId('context-changes').getByRole('button').filter({ hasText: vienna.title.en }),
  ).toHaveAttribute('aria-expanded', 'true');
  expect(new URL(page.url()).searchParams.has('entity')).toBe(false);
  expect(new URL(page.url()).searchParams.has('event')).toBe(false);

  await page.getByTestId('context-tab-networks').click();
  const network = page.getByTestId(`network-${silkRoads.id}`);
  await expect(network).toHaveAttribute('data-in-period', 'false');
  // The American corridor and both oceanic routes lie outside the view centred on Vienna.
  await expect.poll(async () => (await sourceIds(page)).sort()).toEqual(networks1815);
  // Returning to validated, cached data must still replace the previous map source.
  await page.getByTestId('context-tab-changes').click();
  await expect
    .poll(async () =>
      (await renderedContext(page, 'context-points')).some((item) => item.id === vienna.id),
    )
    .toBe(true);
  await page.getByTestId('context-tab-networks').click();
  await expect.poll(async () => (await sourceIds(page)).sort()).toEqual(networks1815);
  await network.getByRole('button').first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get('contextItem')).toBe(silkRoads.id);
  await expect
    .poll(async () =>
      (await renderedContext(page, 'context-lines')).some((item) => item.id === silkRoads.id),
    )
    .toBe(false);
  await network.getByRole('button', { name: 'Show this period on the map', exact: true }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get('y'))
    .toBe(String(silkRoads.fromYear));
  await expect(network).toHaveAttribute('data-in-period', 'true');
  await expect
    .poll(async () =>
      (await renderedContext(page, 'context-lines')).some((item) => item.id === silkRoads.id),
    )
    .toBe(true);
  await page.reload();
  await expect(network.getByRole('button').first()).toHaveAttribute('aria-expanded', 'true');
  await captureMap(page);
  await expect
    .poll(async () =>
      (await renderedContext(page, 'context-lines')).some((item) => item.id === silkRoads.id),
    )
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('network-sourced-period.png') });

  await page.locator('.timeline-year').click();
  await page.getByRole('textbox', { name: 'Year', exact: true }).fill('2026');
  await page.getByRole('button', { name: 'Apply year', exact: true }).click();
  await expect(network).toHaveAttribute('data-in-period', 'false');
  await expect.poll(() => renderedContext(page, 'context-lines')).toEqual([]);
  await network.getByRole('button', { name: 'Show this period on the map', exact: true }).click();
  await expect
    .poll(async () => (await renderedContext(page, 'context-lines')).length)
    .toBeGreaterThan(0);
  await page
    .getByTestId('context-panel')
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const map = (window as unknown as { contextMap: HistoricalMap }).contextMap;
        const data = await (map.getSource('historical-context') as GeoJSONSource).getData();
        return data.type === 'FeatureCollection' ? data.features.length : -1;
      }),
    )
    .toBe(0);
  expect(errors).toEqual([]);
});

test('Manila–Acapulco crosses the Pacific in two rendered segments and remains shareable', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?lang=en&y=2026&context=networks&projection=mercator');
  const entry = page.getByTestId(`network-${galleons.id}`);
  await expect(entry).toHaveAttribute('data-in-period', 'false');
  await entry.getByRole('button').first().click();
  await entry.getByRole('button', { name: 'Show this period on the map', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('1565');
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('lon')))
    .toBeCloseTo(-169.455, 2);
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('z'))).toBe(0.5);
  await expect(entry).toHaveAttribute('data-in-period', 'true');
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
  await captureMap(page);
  await expect
    .poll(async () =>
      (await renderedContext(page, 'context-lines')).some((item) => item.id === galleons.id),
    )
    .toBe(true);
  const geometry = await page.evaluate(async (id) => {
    const map = (window as unknown as { contextMap: HistoricalMap }).contextMap;
    const data = await (map.getSource('historical-context') as GeoJSONSource).getData();
    return data.type === 'FeatureCollection'
      ? data.features.find((feature) => feature.properties?.id === id)?.geometry
      : undefined;
  }, galleons.id);
  expect(geometry?.type).toBe('MultiLineString');
  if (geometry?.type !== 'MultiLineString')
    throw new Error('A transpacific line must split at the dateline.');
  expect(geometry.coordinates).toHaveLength(2);
  expect(geometry.coordinates[0][0]).toEqual(galleons.coordinates[0]);
  expect(geometry.coordinates[0].at(-1)![0]).toBe(180);
  expect(geometry.coordinates[1][0][0]).toBe(-180);
  expect(geometry.coordinates[1].at(-1)).toEqual(galleons.coordinates[1]);
  // Neither segment runs through the longitudes of Africa or Europe.
  expect(geometry.coordinates.flat().every(([lon]) => Math.abs(lon) >= 99)).toBe(true);
  expect(geometry.coordinates.every((part) => Math.abs(part.at(-1)![0] - part[0][0]) < 180)).toBe(
    true,
  );

  // A real click on the Pacific line reopens its notice without choosing a territory or event.
  await entry.getByRole('button').first().click();
  await expect.poll(() => new URL(page.url()).searchParams.has('contextItem')).toBe(false);
  await expect
    .poll(() =>
      page.evaluate(
        () => !(window as unknown as { contextMap: HistoricalMap }).contextMap.isMoving(),
      ),
    )
    .toBe(true);
  const target = await page.evaluate(() => {
    const map = (window as unknown as { contextMap: HistoricalMap }).contextMap;
    const point = map.project([-169.455, 15.73]);
    const rectangle = map.getCanvas().getBoundingClientRect();
    return { x: point.x + rectangle.x, y: point.y + rectangle.y };
  });
  const panelBox = await page.getByTestId('context-panel').boundingBox();
  expect(target.x).toBeGreaterThan(panelBox!.x + panelBox!.width);
  await page.mouse.click(target.x, target.y);
  await expect.poll(() => new URL(page.url()).searchParams.get('contextItem')).toBe(galleons.id);
  await expect(entry.getByRole('button').first()).toHaveAttribute('aria-expanded', 'true');
  expect(new URL(page.url()).searchParams.has('entity')).toBe(false);
  expect(new URL(page.url()).searchParams.has('event')).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('manila-acapulco-pacific.png') });
  await page.reload();
  await expect(entry.getByRole('button').first()).toHaveAttribute('aria-expanded', 'true');
  await captureMap(page);
  await expect
    .poll(async () =>
      (await renderedContext(page, 'context-lines')).some((item) => item.id === galleons.id),
    )
    .toBe(true);
  expect(new URL(page.url()).searchParams.get('y')).toBe('1565');
});

test('an ancient transformation navigates and reloads using astronomical years', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?lang=en&y=1812&context=changes&contextItem=${babylon.id}&projection=mercator`);
  const entry = page
    .getByTestId('context-changes')
    .locator('ol > li')
    .filter({ hasText: babylon.title.en });
  await expect(entry.getByRole('button').first()).toHaveAttribute('aria-expanded', 'true');
  await expect(entry).toContainText('Outside period');
  await entry.getByRole('button', { name: 'Show this date · 539 BCE', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('-538');
  await expect(page.locator('.timeline-year')).toContainText('539 BCE');
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
  await captureMap(page);
  await expect
    .poll(async () =>
      (await renderedContext(page, 'context-points')).some((item) => item.id === babylon.id),
    )
    .toBe(true);
  await page.reload();
  await expect(entry.getByRole('button').first()).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.timeline-year')).toContainText('539 BCE');
  expect(new URL(page.url()).searchParams.get('y')).toBe('-538');
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
  await captureMap(page);
  await expect
    .poll(async () =>
      (await renderedContext(page, 'context-points')).some((item) => item.id === babylon.id),
    )
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('babylon-539-bce.png') });
});
