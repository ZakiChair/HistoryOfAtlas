export const EVENT_TYPES = [
  'battle',
  'siege',
  'naval',
  'war',
  'campaign',
  'treaty',
  'conquest',
] as const;
export const ERA_IDS = [
  'ancient',
  'classical',
  'late-antiquity',
  'medieval',
  'early-modern',
  '19th-century',
  '20th-century',
  'contemporary',
] as const;
export const REGION_IDS = [
  'europe',
  'africa',
  'asia',
  'middle-east',
  'north-america',
  'south-america',
  'oceania',
  'global',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type EraId = (typeof ERA_IDS)[number];
export type RegionId = (typeof REGION_IDS)[number];
export const LOCALES = ['en', 'fr', 'de', 'es', 'zh', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  zh: '简体中文',
  ru: 'Русский',
};
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.includes(value as Locale);
}
export type LocalizedName = { en: string } & Partial<Record<Locale, string>>;
export type Calendar = 'julian' | 'gregorian' | 'unknown';
export type DatePrecision = 'day' | 'month' | 'year' | 'decade' | 'century';
export type {
  HistDate,
  HistoricalEvent,
  Campaign,
  PoliticalEntity,
  DataManifest,
  Source,
  Story,
  Person,
  PersonTenure,
  SourcedDate,
  PersonEventLink,
  EventPersonLink,
  PolityLeaders,
} from './schema';
