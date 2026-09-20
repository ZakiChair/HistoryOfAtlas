import type { FilterSpecification } from 'maplibre-gl';

/** Explicit expression syntax avoids MapLibre interpreting a constant comparison as a legacy filter. */
export const EMPTY_FEATURE_FILTER: FilterSpecification = ['==', ['get', 'id'], ''];
