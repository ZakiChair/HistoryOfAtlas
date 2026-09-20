export const EVENT_TYPES = ['battle', 'siege', 'naval', 'war', 'campaign', 'treaty', 'conquest'] as const;
export const ERA_IDS = ['ancient', 'classical', 'late-antiquity', 'medieval', 'early-modern', '19th-century', '20th-century', 'contemporary'] as const;
export const REGION_IDS = ['europe', 'africa', 'asia', 'middle-east', 'north-america', 'south-america', 'oceania', 'global'] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type EraId = (typeof ERA_IDS)[number];
export type RegionId = (typeof REGION_IDS)[number];
export type Locale = 'fr' | 'en';
export type Calendar = 'julian' | 'gregorian' | 'unknown';
export type DatePrecision = 'day' | 'month' | 'year' | 'decade' | 'century';
export type { HistDate, HistoricalEvent, Campaign, PoliticalEntity, DataManifest, Source, Story } from './schema';

