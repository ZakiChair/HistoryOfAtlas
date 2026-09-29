import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { religionFixture } from '../fixtures/religions';
import {
  cumulativeTimeModel,
  intervalTimeModel,
  thematicMilestonesAt,
  type ThematicTimeModel,
} from '../../lib/thematic/time';

const require = createRequire(import.meta.url);
const mapRequire = createRequire(require.resolve('maplibre-gl/package.json'));
const { createExpression, featureFilter, latest } = mapRequire(
  '@maplibre/maplibre-gl-style-spec',
) as {
  createExpression: (
    expression: unknown,
    spec: unknown,
  ) => {
    result: string;
    value: {
      evaluate: (
        globals: { zoom: number },
        feature: { type: string; properties: Record<string, unknown> },
      ) => number;
    };
  };
  featureFilter: (
    filter: unknown,
    rootKey: string,
  ) => {
    filter: (
      globals: { zoom: number },
      feature: { type: string; properties: Record<string, unknown> },
    ) => boolean;
  };
  latest: Record<string, Record<string, unknown>>;
};

const passes = (time: ThematicTimeModel, horizon: number, properties: Record<string, unknown>) =>
  featureFilter(time.filter(horizon), 'layers[0].filter').filter(
    { zoom: 3 },
    { type: 'Point', properties },
  );

const opacityAt = (expression: unknown, properties: Record<string, unknown>) => {
  const compiled = createExpression(expression, latest['paint_symbol']!['icon-opacity']);
  expect(compiled.result).toBe('success');
  return compiled.value.evaluate({ zoom: 3 }, { type: 'Point', properties });
};

describe('cumulative time model', () => {
  const time = cumulativeTimeModel([
    [0, 1],
    [500, 0.8],
    [1500, 0.45],
  ] as const);

  it('includes a milestone from its year on and matches its MapLibre filter', () => {
    const milestone = { year: -250 };
    expect(time.includes(milestone, -250)).toBe(true);
    expect(time.includes(milestone, -251)).toBe(false);
    expect(time.filter(-250)).toEqual(['<=', ['get', 'year'], -250]);
    for (const year of [-251, -250, -249])
      expect(passes(time, -250, { year })).toBe(time.includes({ year }, -250));
  });

  it('fades attestations by age and scales with the layer', () => {
    const opacity = time.opacity(1950);
    expect(opacityAt(opacity, { year: 1950 })).toBe(1);
    expect(opacityAt(opacity, { year: 1450 })).toBeCloseTo(0.8);
    expect(opacityAt(opacity, { year: 450 })).toBeCloseTo(0.45);
    expect(opacityAt(opacity, { year: 0 })).toBeCloseTo(0.45);
    expect(opacityAt(time.opacity(1950, 0.42, 2), { year: 1700 })).toBeCloseTo(0.336);
  });
});

describe('interval time model', () => {
  const time = intervalTimeModel({ grace: 25 });
  const milestone = { year: 1347, endYear: 1351 };

  it('includes a milestone from year through endYear plus the grace fade', () => {
    expect(time.includes(milestone, 1346)).toBe(false);
    expect(time.includes(milestone, 1347)).toBe(true);
    expect(time.includes(milestone, 1351)).toBe(true);
    expect(time.includes(milestone, 1376)).toBe(true);
    expect(time.includes(milestone, 1377)).toBe(false);
    expect(time.includes({ year: 1981 }, 2026)).toBe(true);
    for (const horizon of [1346, 1347, 1351, 1376, 1377])
      expect(passes(time, horizon, milestone)).toBe(time.includes(milestone, horizon));
    for (const horizon of [1980, 1981, 2026])
      expect(passes(time, horizon, { year: 1981 })).toBe(time.includes({ year: 1981 }, horizon));
  });

  it('holds full opacity while active then fades over the grace years', () => {
    expect(opacityAt(time.opacity(1351), milestone)).toBe(1);
    expect(opacityAt(time.opacity(1363.5), milestone)).toBeCloseTo(0.5);
    expect(opacityAt(time.opacity(1376), milestone)).toBe(0);
    expect(opacityAt(time.opacity(1400), milestone)).toBe(0);
    expect(opacityAt(time.opacity(2026, 0.9), { year: 1981 })).toBeCloseTo(0.9);
  });
});

describe('thematicMilestonesAt', () => {
  it('sorts by year then id and applies the theme filter', () => {
    const all = thematicMilestonesAt(
      religionFixture.milestones,
      200,
      cumulativeTimeModel([[0, 1]] as const),
      (milestone) => milestone.traditionId,
    );
    expect(all.map((milestone) => milestone.id)).toEqual([
      'judaism-origin',
      'buddhism-origin',
      'buddhism-sri-lanka',
      'buddhism-china',
    ]);
    const buddhism = thematicMilestonesAt(
      religionFixture.milestones,
      200,
      cumulativeTimeModel([[0, 1]] as const),
      (milestone) => milestone.traditionId,
      'buddhism',
    );
    expect(buddhism.map((milestone) => milestone.id)).toEqual([
      'buddhism-origin',
      'buddhism-sri-lanka',
      'buddhism-china',
    ]);
  });
});
