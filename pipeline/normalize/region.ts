import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { RegionId } from '../../lib/types';

type CountryProperties = {
  CONTINENT?: string;
  SUBREGION?: string;
  REGION_WB?: string;
};

/** Broad geographic browsing regions, never a claim of historical sovereignty. */
export function classifyRegion(coords?: [number, number]): RegionId {
  if (!coords) return 'global';
  const [lon, lat] = coords;
  if (lat < -60) return 'global';
  if ((lon > 110 && lat < -10) || (lon >= 140 && lat < 20) || (lon < -130 && lat < 30))
    return 'oceania';
  if (lon < -25 && lat > 12) return 'north-america';
  if (lon < -25 && lat <= 12) return 'south-america';
  if (lon >= 34 && lon < 65 && lat >= 12 && lat < 43) return 'middle-east';
  if (lon >= -20 && lon < 52 && lat < 36) return 'africa';
  if (lon >= -25 && lon < 60 && lat >= 35) return 'europe';
  return 'asia';
}

export function sourcedRegion(
  coords: [number, number],
  countries: FeatureCollection<Polygon | MultiPolygon, CountryProperties>,
): RegionId {
  const approximate = classifyRegion(coords);
  // Polynesian islands and New Guinea remain geographic Oceania regardless of administration.
  if (approximate === 'oceania') return approximate;
  const country = countries.features.find((feature) => booleanPointInPolygon(coords, feature));
  if (!country) return approximate;
  const properties = country.properties;
  if (properties.CONTINENT === 'Antarctica') return 'global';
  if (
    properties.CONTINENT === 'Asia' &&
    (properties.SUBREGION === 'Western Asia' ||
      properties.REGION_WB === 'Middle East & North Africa')
  )
    return 'middle-east';
  if (properties.CONTINENT === 'Europe') {
    // A state's continent attribute must not move its overseas or transcontinental lands.
    if (coords[0] < -25 || coords[0] >= 60 || coords[1] < -10) return approximate;
    return 'europe';
  }
  const continents: Record<string, RegionId> = {
    Africa: 'africa',
    Asia: 'asia',
    Oceania: 'oceania',
    'North America': 'north-america',
    'South America': 'south-america',
  };
  return continents[properties.CONTINENT ?? ''] ?? approximate;
}
