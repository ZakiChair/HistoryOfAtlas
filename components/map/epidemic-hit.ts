import type { Map as MapInstance, PointLike } from 'maplibre-gl';
import { milestoneLayerIds } from './milestone-ids';
import { hasMilestoneEmblemAt } from './milestone-hit';

const EPIDEMIC_IDS = milestoneLayerIds('epidemic');
export const EPIDEMIC_SOURCE = EPIDEMIC_IDS.source;
export const EPIDEMIC_POINTS = EPIDEMIC_IDS.points;

/** Only small interactive emblems intercept clicks; broad affected zones do not. */
export function hasEpidemicAt(map: MapInstance, point: PointLike): boolean {
  return hasMilestoneEmblemAt(map, point, EPIDEMIC_POINTS);
}
