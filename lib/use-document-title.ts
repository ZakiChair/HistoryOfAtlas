'use client';

import { useEffect } from 'react';
import { useAtlasStore, type AtlasState } from './store';
import { readJson } from './data-client';
import { formatYear } from './histdate';
import { localizedName, translateCopy } from './i18n';
import type { HistoricalEvent, Locale, Person } from './types';

const SITE_NAME = 'HistoryOfAtlas';

export interface TitledSelection {
  name: string;
  year?: number;
}

/** « Name · year — HistoryOfAtlas » for an open record, the translated site title otherwise. */
export function documentTitle(locale: Locale, selection?: TitledSelection | null): string {
  if (!selection)
    return `${SITE_NAME} — ${translateCopy(locale, 'L’histoire à travers les cartes', 'History through maps')}`;
  const year = selection.year === undefined ? '' : ` · ${formatYear(selection.year, locale)}`;
  return `${selection.name}${year} — ${SITE_NAME}`;
}

type Selection =
  | { kind: 'event'; id: string }
  | { kind: 'person'; id: string; year: number }
  | { kind: 'entity'; id: string; year: number };

/** The record whose dossier is open, in the precedence AtlasApp uses to show panels. */
function openSelection(state: AtlasState): Selection | null {
  if (state.selectedPerson) return { kind: 'person', id: state.selectedPerson, year: state.year };
  if (state.selectedEntity) return { kind: 'entity', id: state.selectedEntity, year: state.year };
  if (state.selectedEvent) return { kind: 'event', id: state.selectedEvent };
  return null;
}

const QID = /^Q[1-9]\d*$/;
const ENTITY_ID = /^(?:clio|hb)-[a-f0-9]+$/;

/** Reuses the dossiers' cached downloads; null when the record cannot be named. */
async function selectionTitle(
  selection: Selection,
  locale: Locale,
): Promise<TitledSelection | null> {
  if (selection.kind === 'event') {
    if (!QID.test(selection.id)) return null;
    const event = await readJson<HistoricalEvent>(`/data/events/${selection.id}.json`);
    return { name: localizedName(event.name, locale), year: event.start.year };
  }
  if (selection.kind === 'person') {
    if (!QID.test(selection.id)) return null;
    const person = await readJson<Person>(`/data/people/${selection.id}.json`);
    return { name: localizedName(person.name, locale), year: selection.year };
  }
  if (!ENTITY_ID.test(selection.id)) return null;
  const entity = selection.id.startsWith('hb-')
    ? (await readJson<{ id: string; name: string }[]>('/geo/entities.json')).find(
        (candidate) => candidate.id === selection.id,
      )
    : await readJson<{ name: string }>(`/geo/polities/${selection.id}.json`);
  return entity ? { name: entity.name, year: selection.year } : null;
}

/**
 * Keeps the tab title in the reader's language and naming the open record, so history,
 * bookmarks and screen readers identify the view. Subscribes outside React to avoid
 * rerendering the shell on each year, and holds the title still during playback.
 *
 * Unbinding leaves the title alone: the atlas only unmounts on a route change, and by then the
 * next page's metadata has already written its own title.
 */
export function bindDocumentTitle(target: { title: string }): () => void {
  let key = '';
  let request = 0;
  const update = (state: AtlasState) => {
    if (state.playing || state.campaignPlaying) return;
    const selection = openSelection(state);
    const next = JSON.stringify([state.locale, selection]);
    if (next === key) return;
    key = next;
    const current = ++request;
    if (!selection) {
      target.title = documentTitle(state.locale);
      return;
    }
    selectionTitle(selection, state.locale)
      .catch(() => null)
      .then((titled) => {
        if (current === request) target.title = documentTitle(state.locale, titled);
      });
  };
  update(useAtlasStore.getState());
  const unsubscribe = useAtlasStore.subscribe(update);
  return () => {
    request++;
    unsubscribe();
  };
}

export function useDocumentTitle(): void {
  useEffect(() => bindDocumentTitle(document), []);
}
