import type { FeatureCollection, Geometry } from 'geojson';
import { EPIDEMIC_EXTENT_KM, type EpidemicDataset } from '@/lib/epidemics/types';

/** Kilometres per pixel at zoom 0 for this 512-px-tile world (40 075 km / 512 px). */
const KM_PER_PIXEL = 40075 / 512;

/**
 * Halos and fronts for the epidemics layer. A halo's `r0` is its pixel radius at
 * zoom 0, converted from the milestone's schematic `extent` at its latitude.
 */
export function epidemicSpreadFeatures(dataset: EpidemicDataset): FeatureCollection<Geometry> {
  const themes = new Map(dataset.diseases.map((disease) => [disease.id, disease]));
  const features: FeatureCollection<Geometry>['features'] = [];
  for (const stage of dataset.milestones) {
    const color = themes.get(stage.diseaseId)!.color;
    // Beyond 80° the Mercator cosine blows up; halo extents stay schematic anyway.
    const latitude = Math.max(-80, Math.min(80, stage.coordinates[1]));
    const r0 =
      EPIDEMIC_EXTENT_KM[stage.extent] / (KM_PER_PIXEL * Math.cos((latitude * Math.PI) / 180));
    features.push({
      type: 'Feature',
      id: `${stage.id}-halo`,
      geometry: { type: 'Point', coordinates: stage.coordinates },
      properties: {
        id: `${stage.id}-halo`,
        shape: 'halo',
        theme: stage.diseaseId,
        color,
        year: stage.year,
        ...(stage.endYear !== undefined ? { endYear: stage.endYear } : {}),
        r0,
      },
    });
  }
  for (const front of dataset.fronts ?? [])
    features.push({
      type: 'Feature',
      id: front.id,
      geometry: { type: 'Polygon', coordinates: [front.ring] },
      properties: {
        id: front.id,
        shape: 'front',
        theme: front.diseaseId,
        color: themes.get(front.diseaseId)!.color,
        year: front.year,
        endYear: front.endYear,
        group: front.groupId,
      },
    });
  return { type: 'FeatureCollection', features };
}
