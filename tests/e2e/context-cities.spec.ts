import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { CitiesDataset } from '../../lib/context/cities';

const dataset = JSON.parse(
  readFileSync(new URL('../../public/data/context/cities.json', import.meta.url), 'utf8'),
) as CitiesDataset;
const rome = dataset.cities.find((city) => city.id === 'Q220')!;
const rome1881 = rome.populations.find((fact) => fact.date?.date.year === 1881)!;
const italy = dataset.territories.find((territory) => territory.subjectId === 'Q172579')!;
const italy1861 = italy.populations.find((fact) => fact.date?.date.year === 1861)!;
const number = (value: number) => new Intl.NumberFormat('fr').format(value);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('city observations retain dates, navigate to evidence, and stay separate from state populations', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto('/?lang=fr&y=1900&from=1898&to=1900&context=cities&contextItem=Q220');
  const view = page.getByTestId('context-cities-view');
  const detail = page.getByTestId('context-city-detail');
  await expect(detail).toContainText('Aucun chiffre documenté pour cette période.');
  const reference = detail.locator('section').filter({ hasText: 'Référence datée' });
  await expect(reference).toContainText(number(rome1881.value!));
  await expect(reference).not.toContainText(number(italy1861.value!));
  await reference.getByRole('button', { name: 'Voir à cette date · 1881', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('1881');
  await expect.poll(() => new URL(page.url()).searchParams.has('from')).toBe(false);
  await expect.poll(() => new URL(page.url()).searchParams.has('play')).toBe(false);
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('lon')))
    .toBeCloseTo(rome.coordinates[0]);
  await expect(detail).not.toContainText('Aucun chiffre documenté pour cette période.');
  await expect(detail.locator('section').filter({ hasText: 'Référence datée' })).toHaveCount(0);

  await view.getByRole('button', { name: 'Populations des États', exact: true }).click();
  await view.getByRole('checkbox').uncheck();
  await view.getByRole('searchbox').fill('royaume d’Italie'.replace('’', "'"));
  await view.getByRole('button', { name: /royaume d'Italie/ }).click();
  const stateDetail = page.getByTestId('context-territory-population-detail');
  await expect(stateDetail).toContainText(number(italy1861.value!));
  await expect(stateDetail).not.toContainText(number(rome1881.value!));
  await stateDetail
    .getByRole('button', { name: 'Voir à cette date · 1861', exact: true })
    .first()
    .click();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('1861');
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('lon')))
    .toBeCloseTo(italy.referenceLocations![0].coordinates[0]);
  await expect.poll(() => new URL(page.url()).searchParams.has('contextItem')).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('territory-population.png') });
});

test('the complete city catalogue has search and pagination beyond the selected year', async ({
  page,
}) => {
  await page.goto('/?lang=fr&y=1812&context=cities');
  const view = page.getByTestId('context-cities-view');
  await expect(view.getByRole('button', { name: 'Constantinople', exact: true })).toBeVisible();
  await expect(view.getByRole('button', { name: 'Rome', exact: true })).toHaveCount(0);
  await view.getByRole('checkbox').uncheck();
  const next = view.getByRole('button', { name: 'Page suivante', exact: true });
  const previous = view.getByRole('button', { name: 'Page précédente', exact: true });
  await expect(previous).toBeDisabled();
  await next.click();
  await expect(previous).toBeEnabled();
  await expect(view).toContainText('2 / 10');
  await view.getByRole('searchbox').fill('Rome');
  await view.getByRole('button', { name: 'Rome', exact: true }).click();
  await expect(page.getByTestId('context-city-detail')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('contextItem')).toBe('Q220');
  // The full catalogue navigates to an encoded observation, rather than placing Rome in 1812.
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('1861');
  await page.reload();
  await expect(
    page.getByTestId('context-city-detail').getByRole('heading', { name: 'Rome', exact: true }),
  ).toBeVisible();
});

test('city search survives the map starting after the reader is already usable', async ({
  page,
}) => {
  let releaseManifest!: () => void;
  const manifestGate = new Promise<void>((resolve) => {
    releaseManifest = resolve;
  });
  await page.route('**/geo/manifest.json', async (route) => {
    await manifestGate;
    await route.continue();
  });
  try {
    await page.goto('/?lang=fr&y=1812&context=cities', { waitUntil: 'domcontentloaded' });
    const view = page.getByTestId('context-cities-view');
    const search = view.getByRole('searchbox');
    await view.getByRole('checkbox').uncheck();
    await search.fill('Rome');
    await expect(view.getByRole('button', { name: 'Rome', exact: true })).toBeVisible();

    releaseManifest();
    await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
    // Await the real context overlay, whose loading used to unmount the usable reader.
    await expect
      .poll(() =>
        page.evaluate(() => {
          type MapRef = { getLayer?: (id: string) => unknown };
          type Hook = { memoizedState?: { current?: MapRef }; next?: Hook };
          type Fiber = { memoizedState?: Hook; return?: Fiber };
          const element = document.querySelector('.world-map');
          if (!element) return false;
          const key = Object.keys(element).find((name) => name.startsWith('__reactFiber'));
          if (!key) return false;
          for (
            let fiber = (element as unknown as Record<string, Fiber>)[key];
            fiber;
            fiber = fiber.return!
          ) {
            for (let hook = fiber.memoizedState; hook; hook = hook.next) {
              const map = hook.memoizedState?.current;
              if (map && typeof map.getLayer === 'function')
                return Boolean(map.getLayer('context-points'));
            }
          }
          return false;
        }),
      )
      .toBe(true);

    await expect(search).toHaveValue('Rome');
    await expect(view.getByRole('checkbox')).not.toBeChecked();
    await view.getByRole('button', { name: 'Rome', exact: true }).click();
    await expect(page.getByTestId('context-city-detail')).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('contextItem')).toBe('Q220');
  } finally {
    releaseManifest();
  }
});

test('the city reader fits Arabic mobile with explicit English source fallback', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lang=ar&y=1900&context=cities&contextItem=Q220&theme=light');
  const panel = page.getByTestId('context-panel');
  const detail = page.getByTestId('context-city-detail');
  await expect(detail.getByRole('heading', { name: 'Rome', exact: true })).toHaveAttribute(
    'lang',
    'en',
  );
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );
  const audit = await new AxeBuilder({ page })
    .include('[data-testid="context-panel"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('cities-ar-mobile.png') });
});
