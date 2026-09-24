import { expect, test } from '@playwright/test';
import type { Campaign, Story } from '../../lib/schema';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('a long campaign keeps its play control in the first screen and in view while scrolling', async ({
  page,
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Measured on the desktop notebook, as in the 1440×900 audit.',
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  const campaigns: Campaign[] = await (await request.get('/data/campaigns.json')).json();
  const campaign = campaigns.find((item) => item.id === 'Q78994')!;
  expect(campaign, 'Napoleonic Wars must stay a published campaign').toBeTruthy();
  const participants = campaign.people?.filter((person) => person.role === 'participant') ?? [];
  expect(participants.length).toBeGreaterThan(8);
  await page.goto(`/?lang=fr&campaign=${campaign.id}&step=0&y=${campaign.steps[0].date.year}`);

  const scroll = page.locator('.exploration-scroll');
  const controls = page.getByTestId('campaign-sticky');
  const play = controls.getByRole('button', { name: 'Lire la campagne', exact: true });
  await expect(play).toBeInViewport();
  expect(await scroll.evaluate((element) => element.scrollTop)).toBe(0);
  const first = campaign.steps[0];
  await expect(controls).toContainText(first.name?.fr ?? first.name?.en ?? first.label);

  // Hundreds of documented participants come after the steps and are shortened.
  const people = page.getByTestId('event-people');
  await expect(people.locator('li')).toHaveCount(
    Math.min(8, participants.length) + (campaign.people!.length - participants.length),
  );
  await expect(
    people.getByRole('button', {
      name: `Afficher davantage (${participants.length - 8})`,
      exact: true,
    }),
  ).toBeAttached();

  await scroll.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(people).toBeInViewport();
  await expect(play).toBeInViewport();
  await controls.getByRole('button', { name: 'Étape suivante', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('step')).toBe('1');
  const second = campaign.steps[1];
  await expect(controls).toContainText(second.name?.fr ?? second.name?.en ?? second.label);
});

test('guided stories are listed chronologically with their dates', async ({ page, request }) => {
  const stories: Story[] = await (await request.get('/data/stories.json')).json();
  const title = (id: string) => {
    const story = stories.find((item) => item.id === id)!;
    return story.title.fr ?? story.title.en;
  };
  await page.goto('/?lang=fr');
  // Phones show the map first: the notebook opens from its folded bar.
  await expect(page.locator('.atlas-app:not(.is-hydrating)')).toBeAttached();
  const reopen = page.getByRole('button', { name: 'Ouvrir le carnet', exact: true });
  if (await reopen.isVisible()) await reopen.click();
  await page.getByRole('button', { name: 'Parcours', exact: true }).click();
  const cards = page.locator('.story-card');
  await expect(cards).toHaveCount(stories.length);
  // Wars of Alexander the Great first, World War II last, whatever the published order.
  await expect(cards.first().locator('strong')).toHaveText(title('Q551888'));
  await expect(cards.last().locator('strong')).toHaveText(title('Q362'));
  await expect(cards.last().locator('.story-card-dates')).toHaveText(/1939\s*—\s*1945/);
});
