'use client';

import { useAtlasStore } from '../store';
import type { EventType, Locale, RegionId } from '../types';

export const dictionaries = {
  fr: {
    explore: 'Explorer', stories: 'Parcours', about: 'Méthodologie', search: 'Rechercher une bataille, une guerre, un empire…',
    filters: 'Filtres', close: 'Fermer', loading: 'Chargement', play: 'Lire la chronologie', pause: 'Mettre en pause',
    year: 'Année', speed: 'Vitesse de lecture', previousYear: 'Année précédente', nextYear: 'Année suivante',
    range: 'Période', clearRange: 'Effacer la période', events: 'Événements', battles: 'Batailles',
    globe: 'Globe', flatMap: 'Carte plane', heatmap: 'Densité des conflits', listView: 'Vue liste accessible',
    darkTheme: 'Thème sombre', lightTheme: 'Thème clair', sources: 'Sources', share: 'Partager', copied: 'Lien copié',
    random: 'Événement au hasard', today: 'Ce jour dans l’histoire', traces: 'Garder les traces',
    importance: 'Importance minimale', allTypes: 'Tous les types', allRegions: 'Toutes les régions', allEras: 'Toutes les époques',
    reset: 'Réinitialiser', noResults: 'Aucun événement pour ces filtres', participants: 'Participants documentés',
    unknownSides: 'Les sources ne précisent pas les alliances.', outcome: 'Issue', parentWar: 'Guerre ou conflit lié',
    disputed: 'Date ou lieu contesté', approximateBorders: 'Frontières historiques approximatives',
    previousEvent: 'Événement précédent', nextEvent: 'Événement suivant', viewWar: 'Voir tout le conflit',
    campaigns: 'Campagnes', nextStep: 'Étape suivante', previousStep: 'Étape précédente',
    mapDescription: 'Carte interactive des événements historiques. La vue liste propose une alternative accessible.',
    skipToContent: 'Aller au contenu', reducedMotion: 'Animations réduites', precision: 'Précision de la date',
    expand: 'Agrandir', collapse: 'Réduire', timeline: 'Frise chronologique', searchResults: 'Résultats de recherche',
  },
  en: {
    explore: 'Explore', stories: 'Stories', about: 'Methodology', search: 'Find a battle, a war, an empire…',
    filters: 'Filters', close: 'Close', loading: 'Loading', play: 'Play timeline', pause: 'Pause',
    year: 'Year', speed: 'Playback speed', previousYear: 'Previous year', nextYear: 'Next year',
    range: 'Period', clearRange: 'Clear period', events: 'Events', battles: 'Battles',
    globe: 'Globe', flatMap: 'Flat map', heatmap: 'Conflict density', listView: 'Accessible list view',
    darkTheme: 'Dark theme', lightTheme: 'Light theme', sources: 'Sources', share: 'Share', copied: 'Link copied',
    random: 'Random event', today: 'On this day', traces: 'Keep traces',
    importance: 'Minimum importance', allTypes: 'All types', allRegions: 'All regions', allEras: 'All eras',
    reset: 'Reset', noResults: 'No events match these filters', participants: 'Documented participants',
    unknownSides: 'The sources do not specify alliances.', outcome: 'Outcome', parentWar: 'Related war or conflict',
    disputed: 'Disputed date or location', approximateBorders: 'Approximate historical borders',
    previousEvent: 'Previous event', nextEvent: 'Next event', viewWar: 'View the whole conflict',
    campaigns: 'Campaigns', nextStep: 'Next step', previousStep: 'Previous step',
    mapDescription: 'Interactive map of historical events. The list view provides an accessible alternative.',
    skipToContent: 'Skip to content', reducedMotion: 'Reduced motion', precision: 'Date precision',
    expand: 'Expand', collapse: 'Collapse', timeline: 'Timeline', searchResults: 'Search results',
  },
} satisfies Record<Locale, Record<string, string>>;

export type TranslationKey = keyof typeof dictionaries.fr;

export const EVENT_TYPE_LABELS: Record<EventType, Record<Locale, string>> = {
  battle: { fr: 'Bataille', en: 'Battle' }, siege: { fr: 'Siège', en: 'Siege' }, naval: { fr: 'Bataille navale', en: 'Naval battle' },
  war: { fr: 'Guerre', en: 'War' }, campaign: { fr: 'Campagne', en: 'Campaign' }, treaty: { fr: 'Traité', en: 'Treaty' }, conquest: { fr: 'Conquête', en: 'Conquest' },
};

export const REGION_LABELS: Record<RegionId, Record<Locale, string>> = {
  europe: { fr: 'Europe', en: 'Europe' }, africa: { fr: 'Afrique', en: 'Africa' }, asia: { fr: 'Asie', en: 'Asia' },
  'middle-east': { fr: 'Moyen-Orient', en: 'Middle East' }, 'north-america': { fr: 'Amérique du Nord', en: 'North America' },
  'south-america': { fr: 'Amérique du Sud', en: 'South America' }, oceania: { fr: 'Océanie', en: 'Oceania' }, global: { fr: 'Monde / non attribué', en: 'Global / unassigned' },
};

export function translate(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale][key] ?? dictionaries.en[key];
}

export function localizedName(value: { fr?: string; en: string }, locale: Locale): string {
  return value[locale] ?? value.en;
}

export function localeDirection(locale: string): 'ltr' | 'rtl' {
  return ['ar', 'fa', 'he', 'ur'].includes(locale.split('-')[0]!) ? 'rtl' : 'ltr';
}

/** t('play') uses the dictionary; t('Texte FR', 'English text') supports local editorial copy. */
export function useTranslation() {
  const locale = useAtlasStore((state) => state.locale);
  const setLocale = useAtlasStore((state) => state.setLocale);
  function t(keyOrFrench: TranslationKey | string, english?: string): string {
    return english !== undefined ? locale === 'fr' ? keyOrFrench : english : translate(locale, keyOrFrench as TranslationKey);
  }
  return { locale, setLocale, t, dir: localeDirection(locale) };
}

export const useI18n = useTranslation;
