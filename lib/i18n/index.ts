'use client';

import { useCallback } from 'react';
import { useAtlasStore } from '../store';
import { LOCALES } from '../types';
import { additionalCopy } from './copy';
import type { DatePrecision, EventType, Locale, LocalizedName, RegionId } from '../types';

const baseDictionaries = {
  fr: {
    explore: 'Explorer',
    stories: 'Parcours',
    about: 'Méthodologie',
    search: 'Rechercher une bataille, une guerre, un empire…',
    filters: 'Filtres',
    close: 'Fermer',
    loading: 'Chargement',
    play: 'Lire la chronologie',
    pause: 'Mettre en pause',
    year: 'Année',
    speed: 'Vitesse de lecture',
    previousYear: 'Année précédente',
    nextYear: 'Année suivante',
    range: 'Période',
    clearRange: 'Effacer la période',
    events: 'Événements',
    battles: 'Batailles',
    globe: 'Globe',
    flatMap: 'Carte plane',
    heatmap: 'Densité des conflits',
    listView: 'Vue liste accessible',
    darkTheme: 'Thème sombre',
    lightTheme: 'Thème clair',
    sources: 'Sources',
    share: 'Partager',
    copied: 'Lien copié',
    random: 'Événement au hasard',
    today: 'Ce jour dans l’histoire',
    traces: 'Garder les traces',
    importance: 'Importance minimale',
    allTypes: 'Tous les types',
    allRegions: 'Toutes les régions',
    allEras: 'Toutes les époques',
    reset: 'Réinitialiser',
    noResults: 'Aucun événement pour ces filtres',
    participants: 'Participants documentés',
    unknownSides: 'Les sources ne précisent pas les alliances.',
    outcome: 'Issue',
    parentWar: 'Guerre ou conflit lié',
    disputed: 'Plusieurs dates ou lieux dans la source',
    approximateBorders: 'Frontières historiques approximatives',
    previousEvent: 'Événement précédent',
    nextEvent: 'Événement suivant',
    viewWar: 'Voir tout le conflit',
    campaigns: 'Campagnes',
    nextStep: 'Étape suivante',
    previousStep: 'Étape précédente',
    mapDescription:
      'Carte interactive des événements historiques. La vue liste propose une alternative accessible.',
    skipToContent: 'Aller au contenu',
    reducedMotion: 'Animations réduites',
    precision: 'Précision de la date',
    expand: 'Agrandir',
    collapse: 'Réduire',
    timeline: 'Frise chronologique',
    searchResults: 'Résultats de recherche',
  },
  en: {
    explore: 'Explore',
    stories: 'Stories',
    about: 'Methodology',
    search: 'Find a battle, a war, an empire…',
    filters: 'Filters',
    close: 'Close',
    loading: 'Loading',
    play: 'Play timeline',
    pause: 'Pause',
    year: 'Year',
    speed: 'Playback speed',
    previousYear: 'Previous year',
    nextYear: 'Next year',
    range: 'Period',
    clearRange: 'Clear period',
    events: 'Events',
    battles: 'Battles',
    globe: 'Globe',
    flatMap: 'Flat map',
    heatmap: 'Conflict density',
    listView: 'Accessible list view',
    darkTheme: 'Dark theme',
    lightTheme: 'Light theme',
    sources: 'Sources',
    share: 'Share',
    copied: 'Link copied',
    random: 'Random event',
    today: 'On this day',
    traces: 'Keep traces',
    importance: 'Minimum importance',
    allTypes: 'All types',
    allRegions: 'All regions',
    allEras: 'All eras',
    reset: 'Reset',
    noResults: 'No events match these filters',
    participants: 'Documented participants',
    unknownSides: 'The sources do not specify alliances.',
    outcome: 'Outcome',
    parentWar: 'Related war or conflict',
    disputed: 'Multiple source dates or locations',
    approximateBorders: 'Approximate historical borders',
    previousEvent: 'Previous event',
    nextEvent: 'Next event',
    viewWar: 'View the whole conflict',
    campaigns: 'Campaigns',
    nextStep: 'Next step',
    previousStep: 'Previous step',
    mapDescription:
      'Interactive map of historical events. The list view provides an accessible alternative.',
    skipToContent: 'Skip to content',
    reducedMotion: 'Reduced motion',
    precision: 'Date precision',
    expand: 'Expand',
    collapse: 'Collapse',
    timeline: 'Timeline',
    searchResults: 'Search results',
  },
};

export type TranslationKey = keyof typeof baseDictionaries.en;
export type TranslationValues = Record<string, string | number>;

/** Substitute named values after translating so each language can choose its word order. */
export function interpolate(template: string, values: TranslationValues = {}): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : placeholder,
  );
}

export function translateCopy(
  locale: Locale,
  french: string,
  english: string,
  values?: TranslationValues,
): string {
  const text =
    locale === 'fr'
      ? french
      : locale === 'en'
        ? english
        : (additionalCopy[english]?.[locale] ?? english);
  return interpolate(text, values);
}

export const dictionaries = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    Object.fromEntries(
      Object.entries(baseDictionaries.en).map(([key, english]) => [
        key,
        translateCopy(locale, baseDictionaries.fr[key as TranslationKey], english),
      ]),
    ),
  ]),
) as Record<Locale, Record<TranslationKey, string>>;

function labels<T extends string>(
  values: Record<T, { fr: string; en: string }>,
): Record<T, Record<Locale, string>> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      const { fr, en } = value as { fr: string; en: string };
      return [
        key,
        Object.fromEntries(LOCALES.map((locale) => [locale, translateCopy(locale, fr, en)])),
      ];
    }),
  ) as Record<T, Record<Locale, string>>;
}

export const EVENT_TYPE_LABELS = labels<EventType>({
  battle: { fr: 'Bataille', en: 'Battle' },
  siege: { fr: 'Siège', en: 'Siege' },
  naval: { fr: 'Bataille navale', en: 'Naval battle' },
  war: { fr: 'Guerre', en: 'War' },
  campaign: { fr: 'Campagne', en: 'Campaign' },
  treaty: { fr: 'Traité', en: 'Treaty' },
  conquest: { fr: 'Conquête', en: 'Conquest' },
});

export const REGION_LABELS = labels<RegionId>({
  europe: { fr: 'Europe', en: 'Europe' },
  africa: { fr: 'Afrique', en: 'Africa' },
  asia: { fr: 'Asie', en: 'Asia' },
  'middle-east': { fr: 'Moyen-Orient', en: 'Middle East' },
  'north-america': { fr: 'Amérique du Nord', en: 'North America' },
  'south-america': { fr: 'Amérique du Sud', en: 'South America' },
  oceania: { fr: 'Océanie', en: 'Oceania' },
  global: { fr: 'Monde / non attribué', en: 'Global / unassigned' },
});

export const PRECISION_LABELS = labels<DatePrecision>({
  day: { fr: 'au jour', en: 'day' },
  month: { fr: 'au mois', en: 'month' },
  year: { fr: 'à l’année', en: 'year' },
  decade: { fr: 'à la décennie', en: 'decade' },
  century: { fr: 'au siècle', en: 'century' },
});

export function translate(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale][key] ?? dictionaries.en[key];
}

export function localizedName(value: LocalizedName, locale: Locale): string {
  return value[locale] ?? value.en;
}

export function localizedLanguage(value: LocalizedName, locale: Locale): Locale {
  return value[locale] !== undefined ? locale : 'en';
}

export function localeDirection(locale: string): 'ltr' | 'rtl' {
  return ['ar', 'fa', 'he', 'ur'].includes(locale.split('-')[0]!) ? 'rtl' : 'ltr';
}

/** t('play') uses a keyed label; t('Texte FR', 'English text') uses the editorial catalog. */
export function useTranslation() {
  const locale = useAtlasStore((state) => state.locale);
  const setLocale = useAtlasStore((state) => state.setLocale);
  const t = useCallback(
    (keyOrFrench: TranslationKey | string, english?: string, values?: TranslationValues): string =>
      english !== undefined
        ? translateCopy(locale, keyOrFrench, english, values)
        : translate(locale, keyOrFrench as TranslationKey),
    [locale],
  );
  return { locale, setLocale, t, dir: localeDirection(locale) };
}

export const useI18n = useTranslation;
