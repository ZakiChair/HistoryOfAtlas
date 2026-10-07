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
  onLocate: (year: number, coordinates: [number, number], zoom?: number) => void;
};

export function contextText(value: ContextText, locale: Locale) {
  return locale === 'fr' ? value.fr : value.en;
}

export function contextContentLanguage(locale: Locale) {
  return locale === 'fr' ? 'fr' : 'en';
}
