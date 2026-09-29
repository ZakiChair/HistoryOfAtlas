import { expect, test, type Page } from '@playwright/test';

// Deliberately synthetic shares test the presentation without asserting historical facts.
const text = (fr: string, en = fr) => ({ fr, en });
const fixture = {
  version: 1,
  snapshotMaxAge: 15,
  traditions: [
    {
      id: 'christianity',
      names: text('Christianisme', 'Christianity'),
      color: '#edc578',
      symbol: 'cross',
      kind: 'religion',
    },
    { id: 'islam', names: text('Islam'), color: '#84c69a', symbol: 'crescent', kind: 'religion' },
    {
      id: 'unaffiliated',
      names: text('Sans affiliation religieuse', 'Unaffiliated'),
      color: '#a0b1b9',
      symbol: 'none',
      kind: 'unaffiliated',
    },
  ],
  sources: [
    {
      id: 'test-source',
      title: 'Source du scénario de test',
      url: 'https://example.org/test',
      license: 'Test fixture',
    },
  ],
  geometries: [
    {
      id: 'test-geometry',
      sourceIds: ['test-source'],
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-4, 42],
            [6, 42],
            [6, 50],
            [-4, 50],
            [-4, 42],
          ],
        ],
      },
    },
  ],
  observations: [
    {
      id: 'test-1900',
      regionId: 'test-region',
      name: text('Région de test', 'Test region'),
      geometryId: 'test-geometry',
      time: { kind: 'snapshot', year: 1900 },
      populationScope: text('Population du scénario de test'),
      shares: [
        { traditionId: 'christianity', share: 0.6 },
        { traditionId: 'islam', share: 0.3 },
        { traditionId: 'unaffiliated', share: 0.1 },
      ],
      sourceIds: ['test-source'],
    },
    {
      id: 'test-1950',
      regionId: 'test-region',
      name: text('Région de test', 'Test region'),
      geometryId: 'test-geometry',
      time: { kind: 'snapshot', year: 1950 },
      populationScope: text('Population du scénario de test'),
      shares: [
        { traditionId: 'christianity', share: 0.45 },
        { traditionId: 'islam', share: 0.35 },
        { traditionId: 'unaffiliated', share: 0.2 },
      ],
      sourceIds: ['test-source'],
    },
    {
      id: 'test-2000',
      regionId: 'test-region',
      name: text('Région de test', 'Test region'),
      geometryId: 'test-geometry',
      time: { kind: 'snapshot', year: 2000 },
      populationScope: text('Population du scénario de test'),
      shares: [
        { traditionId: 'christianity', share: 0.5002418518 },
        { traditionId: 'islam', share: 0.19999994 },
        { traditionId: 'unaffiliated', share: 0.2997582082 },
      ],
      sourceIds: ['test-source'],
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/data/religions/coverage.json', (route) => route.fulfill({ json: fixture }));
});

test('rounded percentages preserve the side of majority and hatching thresholds', async ({
  page,
}) => {
  await page.goto('/?lang=fr&y=2000&religions=1&battles=0');
  await page.getByTestId('religions-legend-toggle').click();
  await page.getByTestId('religion-region-test-2000').click();
  const detail = page.getByTestId('religion-coverage-detail');
  await expect(detail).toContainText(/>\s*50\s*%/);
  await expect(detail).toContainText(/<\s*20\s*%/);
  await expect(page.getByTestId('religion-majority-summary')).toContainText('Christianisme');
});

test('switching to historical milestones and back keeps the panel open and restores coverage', async ({
  page,
}) => {
  await page.goto('/?lang=fr&y=1900&religions=1&battles=0');
  await page.getByTestId('religions-legend-toggle').click();
  await page.getByTestId('religion-region-test-1900').click();
  await page.getByTestId('religion-view-history').click();
  await expect(page.getByTestId('religion-view-history')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/rview=history/);
  await expect(page.getByTestId('religion-coverage-detail')).not.toBeAttached();
  await page.getByTestId('religion-view-coverage').click();
  await expect(page.getByTestId('religion-view-coverage')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).not.toHaveURL(/rview=history/);
  await page.getByTestId('religion-region-test-1900').click();
  await expect(page.getByTestId('religion-coverage-detail')).toContainText(/60\s*%/);
});

async function changeYear(page: Page, value: number) {
  await page.locator('.timeline-year').click();
  const input = page.getByRole('textbox', { name: 'Année', exact: true });
  await input.fill(String(value));
  await input.press('Enter');
}

test('majorities are the default view, significant minorities and source dates remain explicit', async ({
  page,
}) => {
  await page.goto('/?lang=fr&y=1900&religions=1&battles=0');
  await page.getByTestId('religions-legend-toggle').click();
  await expect(page.getByTestId('religion-view-coverage')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('religions-panel')).toContainText('20 %');
  await page.getByTestId('religion-region-test-1900').click();
  const detail = page.getByTestId('religion-coverage-detail');
  await expect(detail).toContainText(/60\s*%/);
  await expect(detail).toContainText(/30\s*%/);
  await expect(detail).toContainText('1900');
  await expect(detail.getByRole('link', { name: 'Source du scénario de test' })).toHaveAttribute(
    'href',
    'https://example.org/test',
  );
  await changeYear(page, 1905);
  await expect(detail).toContainText('1900');
  await expect(detail).toContainText('1905');
  await changeYear(page, 1950);
  await page.getByTestId('religion-region-test-1950').click();
  await expect(detail).toContainText('Aucune religion majoritaire documentée');
  await expect(detail).toContainText(/45\s*%/);
  await expect(detail).not.toContainText(/60\s*%/);
  await changeYear(page, 1899);
  await expect(page.getByTestId('religions-panel')).toContainText('Aucune zone documentée');
  await expect(detail).not.toBeAttached();
});

test('coverage loads on activation and a filled polygon opens its detail without selecting a territory', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/data/religions/')) requests.push(request.url());
  });
  await page.goto('/?lang=fr&y=1900&lon=1&lat=46&z=4&projection=mercator&battles=0');
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
  expect(requests).toEqual([]);
  await page.getByTestId('religions-layer-toggle').click();
  await expect(page.getByTestId('religions-status')).toContainText('1');
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  await expect(async () => {
    await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } });
    await expect(page.getByTestId('religion-coverage-detail')).toContainText('Région de test', {
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByTestId('entity-panel')).not.toBeAttached();
  expect(requests.filter((url) => url.endsWith('/coverage.json'))).toHaveLength(1);
  expect(requests.filter((url) => url.endsWith('/history.json'))).toHaveLength(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test('invalid coverage data can be retried and the tradition filter remains usable', async ({
  page,
}) => {
  let attempts = 0;
  await page.route('**/data/religions/coverage.json', (route) =>
    route.fulfill({ json: ++attempts === 1 ? { version: 0 } : fixture }),
  );
  await page.goto('/?lang=fr&y=1900&religions=1&battles=0');
  await expect(page.getByTestId('religions-status').getByRole('alert')).toBeVisible();
  await page.getByTestId('religions-status').getByRole('button').click();
  await expect(page.getByTestId('religions-status')).toContainText('Zones documentées : 1');
  await page.getByTestId('religions-legend-toggle').click();
  await page.getByRole('combobox', { name: 'Afficher une tradition' }).selectOption('islam');
  await expect(page).toHaveURL(/religion=islam/);
  await page.getByTestId('religion-region-test-1900').click();
  await expect(page.getByTestId('religion-coverage-detail')).toContainText(/30\s*%/);
  expect(attempts).toBe(2);
});
