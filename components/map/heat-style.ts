import type { ExpressionSpecification } from 'maplibre-gl';

/**
 * Heatmap ramp shared by the map layer and its key. Lightness only ever rises
 * (CIE L* ≈ 31 → 47 → 62 → 72 → 87), so a brighter area is always a denser one.
 */
export const HEAT_COLOR_STOPS = [
  [0.15, '#1f4e5f'],
  [0.35, '#34778b'],
  [0.6, '#8f9a6a'],
  [0.8, '#d1ac64'],
  [1, '#f1d6a0'],
] as const;

export const HEAT_COLOR = [
  'interpolate',
  ['linear'],
  ['heatmap-density'],
  0,
  'rgba(0,0,0,0)',
  ...HEAT_COLOR_STOPS.flat(),
] as ExpressionSpecification;

/** Kernel radius in pixels: tight on the world view, wide enough to merge a region at z6. */
export const HEAT_RADIUS: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  1,
  12,
  6,
  40,
];
