import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { ReligionDataset, ReligionMilestone } from '../../lib/religions/types';

const dataPath = '/data/religions/history.json';
let dataset: ReligionDataset | undefined;
const data = () =>
  (dataset ??= JSON.parse(
    readFileSync(new URL('../../public/data/religions/history.json', import.meta.url), 'utf8'),
  ) as ReligionDataset);
const errors = new WeakMap<Page, string[]>();

async function ready(page: Page) {
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  });
  const collapse = page.getByRole('button', { name: 'Collapse notebook', exact: true });
  if (await collapse.isVisible()) {
    await collapse.click();
    await expect(collapse).not.toBeAttached();
  }
}

async function religionReady(page: Page) {
  await expect(page.getByTestId('religions-status')).toBeVisible();
  await expect(page.getByTestId('religions-status')).not.toContainText('Loading', {
    timeout: 20_000,
  });
  await expect(page.getByTestId('religions-status')).not.toContainText('unavailable');
}

async function editYear(page: Page, value: number) {
  await page.locator('.timeline-year').click();
  const input = page.getByRole('textbox', { name: 'Year', exact: true });
  await input.fill(String(value));
  await input.press('Enter');
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe(String(value));
}

async function mapControlsOutsideLayers(page: Page) {
  for (const control of [
    page.getByRole('button', { name: 'Open notebook', exact: true }),
    page.getByRole('toolbar', { name: 'Map controls', exact: true }),
  ]) {
    await expect(control).toBeVisible();
    await expect
      .poll(
        async () => {
          const button = await control.boundingBox();
          if (!button) return ['map control is missing'];
          return page.locator('.map-layers').evaluate((container, button) => {
            return Array.from(
              container.querySelectorAll(
                '.map-layer-toggle, .map-layer-legend-toggle, .resource-layer-note, .religion-layer-note',
              ),
            )
              .filter((element) => {
                const box = element.getBoundingClientRect();
                return (
                  box.width > 0 &&
                  box.height > 0 &&
                  box.left < button.x + button.width &&
                  box.right > button.x &&
                  box.top < button.y + button.height &&
                  box.bottom > button.y
                );
              })
              .map((element) => element.getAttribute('data-testid') ?? element.className);
          }, button);
        },
        { message: 'Map tools and the notebook button must leave every layer control readable' },
      )
      .toEqual([]);
  }
}

function stageUrl(stage: ReligionMilestone, year: number) {
  return `/?${new URLSearchParams({ lang: 'en', y: String(year), lon: String(stage.coordinates[0]), lat: String(stage.coordinates[1]), z: '9', projection: 'mercator', battles: '0', religions: '1', religion: stage.traditionId })}`;
}

test.beforeEach(async ({ page }) => {
  const observed: string[] = [];
  errors.set(page, observed);
  page.on('pageerror', (error) => observed.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') observed.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page), 'No silent map or page errors').toEqual([]);
});

test('religions load on demand and retain every preference in shared links while hidden', async ({
  page,
}) => {
  let requests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === dataPath) requests++;
  });
  await page.goto('/?lang=en&y=1812');
  await ready(page);
  expect(requests).toBe(0);
  const toggle = page.getByTestId('religions-layer-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await religionReady(page);
  expect(requests).toBe(1);
  await page.getByTestId('religions-legend-toggle').click();
  const tradition = data().traditions[0];
  await page.getByTestId(`religion-filter-${tradition.id}`).click();
  await page.getByTestId('religions-routes-toggle').uncheck();
  await page.getByTestId('religions-areas-toggle').uncheck();
  await toggle.click();
  await expect(page.getByTestId('religions-panel')).not.toBeAttached();
  await expect
    .poll(() => {
      const query = new URL(page.url()).searchParams;
      return [
        query.get('religions'),
        query.get('religion'),
        query.get('rpaths'),
        query.get('rareas'),
      ];
    })
    .toEqual([null, tradition.id, '0', '0']);
  await page.reload();
  await ready(page);
  expect(requests).toBe(1);
  await toggle.click();
  await religionReady(page);
  await page.getByTestId('religions-legend-toggle').click();
  await expect(page.getByTestId(`religion-filter-${tradition.id}`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('religions-routes-toggle')).not.toBeChecked();
  await expect(page.getByTestId('religions-areas-toggle')).not.toBeChecked();
  await expect(page.getByTestId('battles-layer-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('resources-layer-toggle')).toHaveAttribute('aria-pressed', 'false');
});

test('dated symbols can be selected at their first attestation and disappear when rewound', async ({
  page,
}, testInfo) => {
  const origin = data()
    .milestones.filter((item) => item.kind === 'origin' && item.year > 0 && item.year < 1800)
    .sort((a, b) => b.year - a.year)[0];
  expect(origin).toBeTruthy();
  await page.goto(stageUrl(origin, origin.year - 1));
  await ready(page);
  await religionReady(page);
  await expect(page.getByTestId('religions-status')).toContainText('No milestone attested');
  await editYear(page, origin.year);
  await expect(page.getByTestId('religions-status')).toContainText('1 attested');
  const canvas = page.locator('.maplibregl-canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await expect(async () => {
    await canvas.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
    await expect(page.getByTestId('religion-detail')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  const detail = page.getByTestId('religion-detail');
  await expect(detail).toContainText(origin.title.en);
  const source = data().sources.find((item) => item.id === origin.sourceIds[0])!;
  await detail.getByRole('link', { name: source.title }).click({ trial: true });
  await page.screenshot({ path: testInfo.outputPath('religion-first-attestation.png') });
  await editYear(page, origin.year - 1);
  await expect(page.getByTestId('religion-detail')).not.toBeAttached();
  await expect(page.getByTestId('religions-status')).toContainText('No milestone attested');
});

test('the chronology navigates to sourced BCE stages and pauses playback without hiding other layers', async ({
  page,
}) => {
  const stage = data().milestones.find((item) => item.year < 0 && item.year >= -1000)!;
  expect(stage).toBeTruthy();
  await page.goto('/?lang=en&y=1812&religions=1&resources=1');
  await ready(page);
  await religionReady(page);
  await page.getByTestId('religions-legend-toggle').click();
  await page.getByTestId(`religion-filter-${stage.traditionId}`).click();
  await page.getByTestId('timeline-play').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('play')).toBe('1');
  await page.getByTestId(`religion-stage-${stage.id}`).click();
  await expect
    .poll(() => {
      const query = new URL(page.url()).searchParams;
      return [query.get('y'), query.get('play'), query.get('lon'), query.get('lat')];
    })
    .toEqual([
      String(stage.year),
      null,
      String(stage.coordinates[0]),
      String(stage.coordinates[1]),
    ]);
  await expect(page.getByTestId('religion-detail')).toContainText(stage.title.en);
  await expect(page.getByTestId('religion-detail')).toContainText('BCE');
  await expect(page.getByTestId('resources-layer-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('battles-layer-toggle')).toHaveAttribute('aria-pressed', 'true');
});

test('religion and resource panels remain mutually exclusive and keyboard accessible', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium')
    await page.setViewportSize({ width: 320, height: 667 });
  await page.goto('/?lang=en&y=1812&religions=1&resources=1');
  await ready(page);
  await religionReady(page);
  await page.screenshot({ path: testInfo.outputPath('religions-controls.png') });
  await mapControlsOutsideLayers(page);
  await page.getByTestId('religions-layer-toggle').click();
  await mapControlsOutsideLayers(page);
  await page.getByTestId('resources-layer-toggle').click();
  await mapControlsOutsideLayers(page);
  await page.getByTestId('religions-layer-toggle').click();
  await religionReady(page);
  await mapControlsOutsideLayers(page);
  await page.getByTestId('resources-layer-toggle').click();
  await mapControlsOutsideLayers(page);
  await page.getByTestId('resources-legend-toggle').click();
  await expect(page.getByTestId('resource-legend')).toBeVisible();
  await page.getByTestId('religions-legend-toggle').click();
  await expect(page.getByTestId('resource-legend')).not.toBeAttached();
  await expect(page.getByTestId('religions-panel')).toBeVisible();
  const lastTradition = data().traditions.at(-1)!;
  await page.getByTestId(`religion-filter-${lastTradition.id}`).click();
  await expect(page.getByTestId(`religion-filter-${lastTradition.id}`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('religions-panel.png') });
  const lastStage = data()
    .milestones.filter((item) => item.traditionId === lastTradition.id)
    .sort((a, b) => b.year - a.year)[0];
  await page.getByTestId(`religion-stage-${lastStage.id}`).click();
  await expect(page.getByTestId('religion-detail')).toContainText(lastStage.title.en);
  await expect(page.locator('.religion-card-body')).toHaveJSProperty('scrollTop', 0);
  await page.screenshot({ path: testInfo.outputPath('religion-chronology-detail.png') });
  await page.getByTestId('religion-detail').press('Escape');
  await expect(page.getByTestId('religions-panel')).not.toBeAttached();
  await expect(page.getByTestId('religion-detail')).not.toBeAttached();
  await expect(page.getByTestId('religions-legend-toggle')).toBeFocused();
  await page.getByTestId('resources-legend-toggle').click();
  await expect(page.getByTestId('resource-legend')).toBeVisible();
  await expect(page.getByTestId('religions-panel')).not.toBeAttached();
});

test('an invalid first response can be retried without reloading the page', async ({ page }) => {
  let attempts = 0;
  await page.route(`**${dataPath}`, async (route) => {
    if (++attempts === 1)
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    else await route.continue();
  });
  await page.goto('/?lang=en&y=1812&religions=1');
  await ready(page);
  await expect(page.getByTestId('religions-status')).toContainText('unavailable');
  await page
    .getByTestId('religions-status')
    .getByRole('button', { name: 'Retry', exact: true })
    .click();
  await religionReady(page);
  expect(attempts).toBe(2);
  await page.getByTestId('religions-legend-toggle').click();
  await expect(page.getByTestId(`religion-filter-${data().traditions[0].id}`)).toBeVisible();
});
