import { expect, test } from '@playwright/test';

// Published Cyrenaica observations contain gaps: -330…-291, -271…-247, -109…-91.
// These are source dates in astronomical notation, not invented territorial intervals.
const polityId = 'clio-9f41f7a98e21d3';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://*.wikipedia.org/api/rest_v1/page/summary/**', (route) => route.abort());
});

test('territorial navigation crosses real evidence gaps and stops at the first and last observations', async ({
  page,
}) => {
  await page.goto(`/?lang=fr&entity=${polityId}&y=-280&from=-290&to=-275`);
  const panel = page.getByTestId('entity-panel');
  const previous = panel.getByRole('button', { name: 'Observation précédente', exact: true });
  const next = panel.getByRole('button', { name: 'Observation suivante', exact: true });
  await expect(panel.locator('.territory-stat')).toContainText('Non documentée cette année');
  await expect(panel.getByTestId('territory-current-cursor')).toBeAttached();
  await expect(panel.getByTestId('territory-current-area')).toHaveCount(0);
  await expect(previous).toBeEnabled();
  await expect(next).toBeEnabled();
  await previous.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('-330');
  await expect.poll(() => new URL(page.url()).searchParams.has('from')).toBe(false);
  await expect(previous).toBeDisabled();
  await expect(panel.getByTestId('territory-active-observation')).toContainText(
    '331 av. J.-C. — 292 av. J.-C.',
  );
  await expect(panel.getByTestId('territory-current-area')).toBeAttached();
  await next.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('-271');
  await expect(panel.getByTestId('territory-active-observation')).toContainText(
    '272 av. J.-C. — 248 av. J.-C.',
  );
  await next.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('-109');
  await expect(next).toBeDisabled();
  await previous.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('-271');
});

test('selecting a documented interval stops a running territory follow at the chosen date', async ({
  page,
}) => {
  await page.goto(`/?lang=fr&entity=${polityId}&y=-328&speed=1&from=-329&to=-320`);
  const panel = page.getByTestId('entity-panel');
  await panel.getByTestId('follow-entity').click();
  await expect(panel.getByTestId('follow-entity')).toContainText('Arrêter le parcours');
  const select = panel.getByRole('combobox', { name: 'Observation territoriale', exact: true });
  await expect(select.locator('option[value="-271"]')).toContainText(
    '272 av. J.-C. — 248 av. J.-C.',
  );
  await select.selectOption('-271');
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('-271');
  await expect.poll(() => new URL(page.url()).searchParams.has('follow')).toBe(false);
  await expect.poll(() => new URL(page.url()).searchParams.has('play')).toBe(false);
  await expect.poll(() => new URL(page.url()).searchParams.has('from')).toBe(false);
  await expect(panel.getByTestId('follow-entity')).toContainText('Suivre ce territoire');
  await expect(page.getByTestId('timeline-play')).toHaveAttribute(
    'aria-label',
    'Lire la chronologie',
  );
  await expect(select).toHaveValue('-271');
});

test('source snapshots outside the timeline remain visible but cannot trap observation navigation', async ({
  page,
}) => {
  await page.goto('/?lang=fr&entity=hb-b116c99a2c1125&y=-3500&borders=historical-basemaps');
  const panel = page.getByTestId('entity-panel');
  const select = panel.getByRole('combobox', { name: 'Observation territoriale', exact: true });
  const oldest = select.locator('option[value="-3999"]');
  await expect(oldest).toHaveText(/4000 av\. J\.-C\./);
  // Playwright's enabled-state matcher resolves an option through its enabled select.
  await expect(oldest).toHaveJSProperty('disabled', true);
  await expect(
    panel.getByRole('button', { name: 'Observation précédente', exact: true }),
  ).toBeDisabled();
  await panel.getByRole('button', { name: 'Observation suivante', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('y')).toBe('-2999');
  await expect(panel.getByTestId('territory-active-observation')).toBeVisible();
});
