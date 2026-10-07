import { expect, test, type Page } from '@playwright/test';
import type { Map as HistoricalMap } from 'maplibre-gl';

type SelectionProbe = {
  map: HistoricalMap;
  source: unknown;
};

async function changeYear(page: Page, year: number) {
  await page.locator('.timeline-year').click();
  await page.getByRole('textbox', { name: 'Year', exact: true }).fill(String(year));
  await page.getByRole('button', { name: 'Apply year', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe(String(year));
}

async function selectedRecords(page: Page) {
  return page.evaluate(() => {
    const { map } = (window as unknown as { territorySelectionProbe: SelectionProbe })
      .territorySelectionProbe;
    const layers = (map.getStyle().layers ?? [])
      .filter((layer) => /^(?:territory|snapshot)-.+-selection$/.test(layer.id))
      .map((layer) => layer.id);
    if (!layers.length) return [];
    return map.queryRenderedFeatures(undefined, { layers }).map((feature) => ({
      entityId: feature.properties.entityId as string,
      fromYear: feature.properties.fromYear as number,
      toYear: feature.properties.toYear as number,
    }));
  });
}

async function captureMap(page: Page, sourceId: string) {
  // Inspect the existing map ref, as in playback-territories; no production debug API.
  await expect
    .poll(() =>
      page.evaluate((sourceId) => {
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
              if (!map.loaded() || !map.getSource(sourceId)) return false;
              (
                window as unknown as { territorySelectionProbe: SelectionProbe }
              ).territorySelectionProbe = { map, source: map.getSource(sourceId) };
              return true;
            }
          }
        }
        return false;
      }, sourceId),
    )
    .toBe(true);
}

test('the selected territory follows its sourced dates, theme and boundary source', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const entity = 'clio-bd4117cb9fdb95'; // First French Empire, documented from 1805 to 1814.
  await page.goto(
    `/?lang=en&y=1812&entity=${entity}&lon=6&lat=47&z=3&projection=mercator&theme=dark`,
  );
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('entity-panel')).toBeVisible();
  await captureMap(page, 'territory-1800');

  await expect.poll(async () => (await selectedRecords(page)).length).toBeGreaterThan(0);
  expect(
    (await selectedRecords(page)).every(
      (record) => record.entityId === entity && record.fromYear <= 1812 && record.toYear >= 1812,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('selected-territory-dark.png') });

  await changeYear(page, 1810);
  await expect
    .poll(async () => {
      const records = await selectedRecords(page);
      return (
        records.length > 0 &&
        records.every(
          (record) =>
            record.entityId === entity && record.fromYear <= 1810 && record.toYear >= 1810,
        )
      );
    })
    .toBe(true);

  const darkPaint = await page.evaluate(() => {
    const { map } = (window as unknown as { territorySelectionProbe: SelectionProbe })
      .territorySelectionProbe;
    return map.getPaintProperty('territory-1800-selection', 'line-color');
  });
  await page.getByRole('button', { name: 'Light theme', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { map } = (window as unknown as { territorySelectionProbe: SelectionProbe })
          .territorySelectionProbe;
        return map.getPaintProperty('territory-1800-selection', 'line-color');
      }),
    )
    .not.toEqual(darkPaint);
  expect(
    await page.evaluate(() => {
      const { map, source } = (window as unknown as { territorySelectionProbe: SelectionProbe })
        .territorySelectionProbe;
      return map.getSource('territory-1800') === source;
    }),
  ).toBe(true);

  await changeYear(page, 1815);
  await expect.poll(() => selectedRecords(page)).toEqual([]);
  await changeYear(page, 1812);
  await expect.poll(async () => (await selectedRecords(page)).length).toBeGreaterThan(0);

  await page.screenshot({ path: testInfo.outputPath('selected-territory-light.png') });
  // Religious majority colours and their own selection remain the active meaning of that view.
  await page.getByTestId('religions-layer-toggle').click();
  await expect.poll(() => selectedRecords(page)).toEqual([]);
  await page.getByTestId('religions-layer-toggle').click();
  await expect.poll(async () => (await selectedRecords(page)).length).toBeGreaterThan(0);

  await page.getByRole('button', { name: /Boundary source: Cliopatria/ }).click();
  await expect.poll(() => selectedRecords(page)).toEqual([]);
  await page.getByRole('button', { name: /Boundary source: Historical Basemaps/ }).click();
  await expect.poll(async () => (await selectedRecords(page)).length).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Close territory panel', exact: true }).click();
  await expect.poll(() => selectedRecords(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('a selected reference territory is outlined in its actual snapshot', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(
    '/?lang=en&y=1800&entity=hb-2c598436e5575a&borders=historical-basemaps&lon=3&lat=47&z=3&projection=mercator',
  );
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
  await captureMap(page, 'snapshot-1800');
  await expect.poll(async () => (await selectedRecords(page)).length).toBeGreaterThan(0);
  expect(
    (await selectedRecords(page)).every((record) => record.entityId === 'hb-2c598436e5575a'),
  ).toBe(true);
});
