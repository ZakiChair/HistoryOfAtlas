import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { HistoricalEvent, Person } from '../../lib/schema';

const source = JSON.parse(readFileSync('tests/fixtures/wikipedia/Q48314-fr.json', 'utf8'));

test('a cached person opened from search keeps focus in its dossier and preserves source return', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://*.wikipedia.org/api/rest_v1/page/summary/**', (route) => route.abort());
  const event: HistoricalEvent = await (
    await request.get(`/data/events/${source.wikibase_item}.json`)
  ).json();
  const commander = event.people?.find((person) => person.role === 'commander');
  expect(commander, 'The relation comes from the published, sourced event').toBeTruthy();
  const person: Person = await (
    await request.get(`/data/people/${commander!.personId}.json`)
  ).json();
  await page.goto(`/?lang=fr&y=${event.start.year}&e=${event.id}`);
  const eventPanel = page.getByTestId('event-panel');
  const sourceButton = eventPanel
    .getByTestId('event-people')
    .getByRole('button')
    .filter({
      hasText: commander!.name.fr ?? commander!.name.en,
    })
    .first();
  await sourceButton.click();
  const title = page.getByTestId('person-panel').getByRole('heading', {
    name: person.name.fr ?? person.name.en,
    exact: true,
  });
  await expect(title).toBeFocused();
  await page.getByRole('button', { name: 'Fermer la fiche du personnage', exact: true }).click();
  await expect(
    eventPanel.getByRole('heading', {
      name: event.name.fr ?? event.name.en,
      exact: true,
    }),
  ).toBeFocused();

  // Keep the cached dossier mounted while selecting it again through the search dialog.
  await sourceButton.click();
  await expect(title).toBeFocused();
  const trigger = page.getByRole('button', { name: 'Rechercher dans l’atlas', exact: true });
  await trigger.click();
  const input = page.getByRole('combobox', { name: 'Rechercher dans l’atlas' });
  await input.fill(person.name.fr ?? person.name.en);
  await page
    .getByRole('option')
    .filter({ hasText: person.name.fr ?? person.name.en })
    .filter({ hasText: 'Personnage historique' })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Let Radix's deferred close autofocus and React's effects finish before checking focus.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await expect(title).toBeFocused();

  await trigger.click();
  await input.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(title).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('person')).toBe(person.id);
  expect(errors).toEqual([]);
});
