import type { FeatureCollection, Geometry } from 'geojson';
import type { AtlasState } from '@/lib/store';
import type { LoadedContext } from './store';
import { changesGeoJSON, changesInPeriod } from './changes';
import { coverageFeatureCollection } from './coverage';
import { networkFeatureCollection, networksInPeriod } from './networks';
import { citiesGeoJSON } from './cities';

export function contextFeatures(
  loaded: LoadedContext | null,
  state: AtlasState,
): FeatureCollection<Geometry> {
  if (!loaded || loaded.view !== state.contextView || state.battleMode)
    return { type: 'FeatureCollection', features: [] };
  switch (loaded.view) {
    case 'changes':
      return changesGeoJSON(
        changesInPeriod(loaded.dataset.changes, state.year, state.range),
        state.locale,
      );
    case 'coverage':
      return coverageFeatureCollection(
        loaded.dataset,
        state.year,
        state.range,
        state.boundarySource,
        state.contextSelection,
      );
    case 'networks':
      return networkFeatureCollection(
        networksInPeriod(loaded.dataset.networks, state.year, state.range),
        state.locale,
      );
    case 'cities':
      return citiesGeoJSON(loaded.dataset, {
        year: state.year,
        range: state.range,
        sourceId: state.boundarySource,
        locale: state.locale,
      });
  }
}
