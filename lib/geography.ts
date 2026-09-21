import type { Locale, LocalizedName } from './types';

export type TerritorySnapshot = {
  year: number;
  sourceYear?: number;
  url: string;
  sourceLayer?: string;
  labelLayer?: string;
  sourceUrl?: string;
};
export type GeographyManifest = {
  snapshots: TerritorySnapshot[];
  basemap: { url: string; layers: string[] };
  temporal?: {
    source: string;
    sourceLayer: string;
    labelLayer: string;
    shards: { start: number; end: number; url: string; features: number; bytes: number }[];
    changesUrl: string;
    entitiesUrl: string;
    density: { year: number; count: number }[];
    range: [number, number];
  };
  sources?: { label?: string; name?: string; url: string; license?: string }[];
};

export type PolitySummary = {
  id: string;
  entityId?: string;
  name: string | LocalizedName;
  wikidataId?: string;
  start?: number;
  end?: number;
  fromYear?: number;
  toYear?: number;
  color?: string;
  areaKm2?: number;
};
export type PolityDetail = PolitySummary & {
  areaHistory?: { year: number; areaKm2: number }[];
  observations?: { fromYear: number; toYear: number; areaKm2: number; sourceUrl?: string }[];
  sources?: { label: string; url: string }[];
  bounds?: [number, number, number, number];
};
export const polityName = (entity: PolitySummary, locale: Locale) =>
  typeof entity.name === 'string' ? entity.name : (entity.name[locale] ?? entity.name.en);
