import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { epidemicFixture } from '../fixtures/epidemics';
import { EPIDEMIC_SYMBOLS } from '../../lib/epidemics/icons';
import { EpidemicDatasetSchema } from '../../lib/epidemics/types';

describe('epidemic corpus schema', () => {
  it('accepts the synthetic fixture', () => {
    expect(EpidemicDatasetSchema.safeParse(epidemicFixture()).success).toBe(true);
  });

  it('rejects an outbreak ending before it starts', () => {
    const data = epidemicFixture();
    const stage = data.milestones.find((item) => item.id === 'plague-london')!;
    stage.endYear = 1600;
    expect(EpidemicDatasetSchema.safeParse(data).success).toBe(false);
  });

  it('rejects a toll without figures, a reversed range and a share above 1', () => {
    const stage = () => data.milestones.find((item) => item.id === 'plague-constantinople')!;
    let data = epidemicFixture();
    stage().toll = [{ kind: 'deaths', scope: { en: 'x', fr: 'x' }, sourceIds: ['toll-source'] }];
    expect(EpidemicDatasetSchema.safeParse(data).success).toBe(false);
    data = epidemicFixture();
    stage().toll = [
      {
        kind: 'deaths',
        min: 2000,
        max: 1000,
        scope: { en: 'x', fr: 'x' },
        sourceIds: ['toll-source'],
      },
    ];
    expect(EpidemicDatasetSchema.safeParse(data).success).toBe(false);
    data = epidemicFixture();
    stage().toll = [
      { kind: 'share', value: 1.5, scope: { en: 'x', fr: 'x' }, sourceIds: ['toll-source'] },
    ];
    expect(EpidemicDatasetSchema.safeParse(data).success).toBe(false);
  });

  it('rejects a toll citing an unknown source', () => {
    const data = epidemicFixture();
    const stage = data.milestones.find((item) => item.id === 'plague-constantinople')!;
    stage.toll = [
      {
        kind: 'deaths',
        value: 100,
        scope: { en: 'x', fr: 'x' },
        sourceIds: ['missing'],
      },
    ];
    const result = EpidemicDatasetSchema.safeParse(data);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('Unknown toll source: missing');
  });

  it('accepts a spread link to a same-year milestone but still rejects a self-link', () => {
    let data = epidemicFixture();
    data.milestones.push({
      ...structuredClone(
        data.milestones.find((item) => item.id === 'plague-constantinople')!,
      ),
      id: 'plague-catania',
      fromId: 'plague-constantinople',
      toll: undefined,
    });
    expect(EpidemicDatasetSchema.safeParse(data).success).toBe(true);
    data = epidemicFixture();
    const stage = data.milestones.find((item) => item.id === 'plague-london')!;
    stage.fromId = 'plague-london';
    expect(EpidemicDatasetSchema.safeParse(data).success).toBe(false);
  });

  it('rejects closesId on a non-eradication milestone', () => {
    const data = epidemicFixture();
    const stage = data.milestones.find((item) => item.id === 'plague-london')!;
    stage.closesId = 'plague-emergence';
    expect(EpidemicDatasetSchema.safeParse(data).success).toBe(false);
  });
});

describe('published epidemic corpus', () => {
  const data = EpidemicDatasetSchema.parse(
    JSON.parse(
      readFileSync(new URL('../../public/data/epidemics/history.json', import.meta.url), 'utf8'),
    ),
  );
  it('validates with existing symbols, https sources and resolved tolls', () => {
    for (const disease of data.diseases)
      expect(EPIDEMIC_SYMBOLS[disease.symbol], disease.id).toBeDefined();
    for (const source of data.sources)
      expect(source.url, source.id).toMatch(/^https:\/\//);
    expect(data.milestones.some((item) => item.fromId)).toBe(true);
    expect(data.milestones.some((item) => item.toll?.length)).toBe(true);
    expect(data.milestones.some((item) => item.endYear === undefined)).toBe(true);
  });
});

describe('epidemic symbols', () => {
  it('gives every key at least one path', () => {
    for (const [key, paths] of Object.entries(EPIDEMIC_SYMBOLS)) {
      expect(paths.length, key).toBeGreaterThan(0);
      for (const path of paths) expect(path, `${key}: ${path}`).toMatch(/^M/);
    }
  });
});
