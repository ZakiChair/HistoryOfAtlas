import type { ResourceCategory, ResourcePeriod, ResourceSite } from '../../lib/resources/types';

export interface SodirField {
  id: string;
  name: string;
  url: string;
  latitude: number | null;
  longitude: number | null;
}
export interface SodirProduction {
  id: string;
  name: string;
  year: number;
  oil: number;
  gas: number;
}
const SOURCE_YEAR = 2026;
const COORDINATE_SOURCE =
  'https://factmaps.sodir.no/api/rest/services/DataService/Data/FeatureServer/7100';

/** Annual observations are compressed only when every intervening year has the same fuels. */
export function normalizeSodirSites(
  fields: SodirField[],
  production: SodirProduction[],
): ResourceSite[] {
  const observations = new Map<string, SodirProduction[]>();
  for (const row of production) {
    if (!Number.isInteger(row.year) || row.year < 1900 || row.year > SOURCE_YEAR) continue;
    const rows = observations.get(row.id) ?? [];
    rows.push(row);
    observations.set(row.id, rows);
  }
  return fields.flatMap((field): ResourceSite[] => {
    const { latitude, longitude } = field;
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180 ||
      (latitude === 0 && longitude === 0)
    )
      return [];
    const annual = new Map<number, ResourceCategory[]>();
    for (const row of observations.get(field.id) ?? []) {
      const categories = annual.get(row.year) ?? [];
      if (Number.isFinite(row.oil) && row.oil > 0 && !categories.includes('oil'))
        categories.push('oil');
      if (Number.isFinite(row.gas) && row.gas > 0 && !categories.includes('gas'))
        categories.push('gas');
      if (categories.length)
        annual.set(
          row.year,
          categories.sort((a, b) => ['oil', 'gas'].indexOf(a) - ['oil', 'gas'].indexOf(b)),
        );
    }
    const periods: ResourcePeriod[] = [];
    for (const [year, categories] of [...annual].sort(([a], [b]) => a - b)) {
      const previous = periods.at(-1);
      if (
        previous &&
        previous.toYear + 1 === year &&
        previous.categories?.join(',') === categories.join(',')
      ) {
        previous.toYear = year;
      } else {
        periods.push({
          fromYear: year,
          toYear: year,
          categories,
          sourceUrl: field.url,
          description:
            'Positive saleable production in each included calendar year, reported by the Norwegian Offshore Directorate. Zero or missing years are excluded. The 2026 observation is a partial year; oil excludes separately reported NGL and condensate.',
        });
      }
    }
    if (!periods.length) return [];
    return [
      {
        id: `sodir:${field.id}`,
        name: field.name,
        coordinates: [longitude, latitude],
        categories: [...new Set(periods.flatMap((period) => period.categories ?? []))],
        country: 'Norway',
        sourceId: 'sodir-production',
        sourceUrl: field.url,
        sourceYear: SOURCE_YEAR,
        coordinateSourceUrl: COORDINATE_SOURCE,
        accuracy: 'approximate',
        periods,
      },
    ];
  });
}

function officialName(name: string): string {
  return name
    .replace(/\s*\(Norway\)\s*$/i, '')
    .replace(/\s+(?:Oil and Gas|Gas and Oil|Oil|Gas)\s+Field\s*$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

const VERIFIED_ALIASES: Record<string, { name: string; sourceUrl: string }> = {
  'SLEIPNER WEST': {
    name: 'SLEIPNER VEST',
    sourceUrl:
      'https://www.sodir.no/en/facts/co2-storage/articles-publications-and-posters/Maturing-a-CO2-storage-site-in-the-North-Sea-Basin-a-story-about-the-Johansen-Formation/',
  },
};

function distanceKm(a: [number, number], b: [number, number]): number {
  const radians = Math.PI / 180;
  const lat = Math.sin(((b[1] - a[1]) * radians) / 2) ** 2;
  const lon = Math.sin(((b[0] - a[0]) * radians) / 2) ** 2;
  return (
    6371 *
    2 *
    Math.asin(
      Math.min(1, Math.sqrt(lat + Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * lon)),
    )
  );
}

/** Replace only same-name Norwegian fields within 50 km; proximity alone never establishes identity. */
export function reconcileNorwegianFields(gemSites: ResourceSite[], sodirSites: ResourceSite[]) {
  const official = new Map(sodirSites.map((site) => [officialName(site.name), site]));
  const matches: {
    replacedId: string;
    replacedName: string;
    preferredId: string;
    preferredName: string;
    distanceKm: number;
    aliasSourceUrl?: string;
  }[] = [];
  const sites = gemSites.filter((site) => {
    if (site.sourceId !== 'gem-goget' || site.country !== 'Norway') return true;
    const name = officialName(site.name);
    const alias = VERIFIED_ALIASES[name];
    const match = official.get(alias?.name ?? name);
    if (!match) return true;
    const distance = distanceKm(site.coordinates, match.coordinates);
    if (distance > 50) return true;
    matches.push({
      replacedId: site.id,
      replacedName: site.name,
      preferredId: match.id,
      preferredName: match.name,
      distanceKm: Math.round(distance * 1000) / 1000,
      ...(alias ? { aliasSourceUrl: alias.sourceUrl } : {}),
    });
    return false;
  });
  return { sites, matches };
}
