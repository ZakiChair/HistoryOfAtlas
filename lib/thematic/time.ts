import type { ExpressionSpecification } from 'maplibre-gl';

export interface DatedMilestone {
  year: number;
  endYear?: number;
}

export interface ThematicTimeModel {
  /** JS twin of `filter`: whether a milestone is drawn at `horizon`. */
  includes(milestone: DatedMilestone, horizon: number): boolean;
  /** MapLibre clause over the feature properties `year` and, when present, `endYear`. */
  filter(horizon: number): ExpressionSpecification;
  /** Per-feature opacity at `horizon`: `scale` × the model's fade; `rate` speeds the fade up. */
  opacity(horizon: number, scale?: number, rate?: number): ExpressionSpecification;
}

export type FadeStops = readonly (readonly [age: number, opacity: number])[];

export const thematicHorizon = (year: number, range: [number, number] | null): number =>
  range ? Math.max(...range) : year;

const round = (value: number) => Math.round(value * 1000) / 1000;

/** Cumulative attestations: a milestone stays once reached and recedes by age. */
export function cumulativeTimeModel(fade: FadeStops): ThematicTimeModel {
  return {
    includes: (milestone, horizon) => milestone.year <= horizon,
    filter: (horizon) => ['<=', ['get', 'year'], horizon] as ExpressionSpecification,
    opacity: (horizon, scale = 1, rate = 1) =>
      [
        'interpolate',
        ['linear'],
        ['-', horizon, ['get', 'year']],
        ...fade.flatMap(([age, opacity]) => [age / rate, round(opacity * scale)]),
      ] as ExpressionSpecification,
  };
}

/** Dated presence: drawn from `year` through `endYear` (open-ended without one), then fading out over `grace` years. */
export function intervalTimeModel(options: { grace: number }): ThematicTimeModel {
  const { grace } = options;
  return {
    includes: (milestone, horizon) =>
      milestone.year <= horizon && horizon <= (milestone.endYear ?? Infinity) + grace,
    filter: (horizon) =>
      [
        'all',
        ['<=', ['get', 'year'], horizon],
        ['any', ['!', ['has', 'endYear']], ['>=', ['+', ['get', 'endYear'], grace], horizon]],
      ] as ExpressionSpecification,
    opacity: (horizon, scale = 1, rate = 1) =>
      [
        'case',
        ['!', ['has', 'endYear']],
        scale,
        [
          'interpolate',
          ['linear'],
          ['-', horizon, ['get', 'endYear']],
          0,
          round(scale),
          grace / rate,
          0,
        ],
      ] as ExpressionSpecification,
  };
}

export function thematicMilestonesAt<M extends DatedMilestone & { id: string }>(
  milestones: readonly M[],
  horizon: number,
  time: ThematicTimeModel,
  themeIdOf: (milestone: M) => string,
  theme: string | null = null,
): M[] {
  return milestones
    .filter(
      (milestone) =>
        time.includes(milestone, horizon) && (!theme || themeIdOf(milestone) === theme),
    )
    .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
}
