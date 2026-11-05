import type { Locale } from '../types';

export const CONTEXT_VIEWS = ['changes', 'coverage', 'networks', 'cities'] as const;
export type ContextView = (typeof CONTEXT_VIEWS)[number];
export type ContextText = { fr: string; en: string };
export type ContextSource = { label: string; url: string };
export type ContextViewProps = {
  year: number;
  range: [number, number] | null;
  locale: Locale;
  sourceId: 'cliopatria' | 'historical-basemaps';
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Opens a place at a date; on a phone the panel steps aside unless it is told to stay. */
  onLocate: (
    year: number,
    coordinates: [number, number],
    zoom?: number,
    options?: { keepOpen?: boolean },
  ) => void;
  /** Moves the map only: the date, the period and any open record stay. */
  onCenter: (coordinates: [number, number], zoom: number) => void;
  /** Changes the date only: the view and any open record stay. */
  onYear: (year: number) => void;
};

/** A period survives navigation to a date inside it; only a conflicting one is cleared. */
export function rangeForYear(
  range: [number, number] | null,
  year: number,
): [number, number] | null {
  return range && year >= range[0] && year <= range[1] ? range : null;
}

const TERRITORY_SELECTION = 'territory:';

/** Shares a territory's population record through the same URL field as other selections. */
export function territorySelection(subjectId: string) {
  return TERRITORY_SELECTION + subjectId;
}

export function selectedTerritorySubject(selection: string | null) {
  return selection?.startsWith(TERRITORY_SELECTION)
    ? selection.slice(TERRITORY_SELECTION.length)
    : null;
}

export function contextText(value: ContextText, locale: Locale) {
  return locale === 'fr' ? value.fr : value.en;
}

export function contextContentLanguage(locale: Locale) {
  return locale === 'fr' ? 'fr' : 'en';
}
