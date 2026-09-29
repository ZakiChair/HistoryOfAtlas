import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import type { Map as MapInstance } from 'maplibre-gl';
import { religionFixture } from '../fixtures/religions';
import {
  ReligionDatasetSchema,
  type ReligionDataset,
  type ReligionMilestone,
} from '../../lib/religions/types';
import { religionAgePaint, religionFeatures } from '../../components/map/religion-overlay';
import { milestoneSpriteIds } from '../../components/map/milestone-ids';
import { createMilestoneSprites } from '../../components/map/milestone-sprites';

const require = createRequire(import.meta.url);
const mapRequire = createRequire(require.resolve('maplibre-gl/package.json'));
const { createExpression, latest } = mapRequire('@maplibre/maplibre-gl-style-spec') as {
  createExpression: (
    expression: unknown,
    spec: unknown,
  ) => {
    result: string;
    value: {
      evaluate: (
        globals: { zoom: number },
        feature: { type: string; properties: Record<string, unknown> },
      ) => unknown;
    };
  };
  latest: Record<string, Record<string, unknown>>;
};

const evaluate = (expression: unknown, properties: Record<string, unknown>, spec: unknown) => {
  const compiled = createExpression(expression, spec);
  expect(compiled.result).toBe('success');
  return compiled.value.evaluate({ zoom: 3 }, { type: 'Point', properties });
};
const text = { en: 'Test evidence', fr: 'Attestation de test' };
const contraction = (overrides: Partial<ReligionMilestone> = {}): ReligionMilestone => ({
  id: 'buddhism-ban',
  traditionId: 'buddhism',
  kind: 'contraction',
  year: 100,
  approximate: false,
  title: text,
  description: text,
  coordinates: [84, 26],
  mechanisms: ['persecution'],
  sourceIds: ['source'],
  closesId: 'buddhism-origin',
  ...overrides,
});

describe('schisms and contractions in the corpus schema', () => {
  it('accepts a contraction closing an earlier attested centre', () => {
    const data = structuredClone(religionFixture);
    data.milestones.push(contraction());
    expect(ReligionDatasetSchema.safeParse(data).success).toBe(true);
  });
  it('rejects closesId on other kinds, on later, foreign or closing targets', () => {
    const cases: Partial<ReligionMilestone>[] = [
      { kind: 'spread' },
      { year: -600 },
      { closesId: 'judaism-origin' },
      {},
    ];
    for (const overrides of cases) {
      const data = structuredClone(religionFixture);
      if (!('closesId' in overrides)) {
        // Target itself a contraction.
        data.milestones.push(contraction({ id: 'first-ban' }));
        data.milestones.push(contraction({ id: 'second-ban', year: 200, closesId: 'first-ban' }));
      } else data.milestones.push(contraction(overrides));
      expect(ReligionDatasetSchema.safeParse(data).success).toBe(false);
    }
  });
  it('accepts a schism with the division mechanism', () => {
    const data = structuredClone(religionFixture);
    data.milestones.push({
      ...contraction({ kind: 'schism', year: 200, mechanisms: ['division'] }),
      closesId: undefined,
    });
    expect(ReligionDatasetSchema.safeParse(data).success).toBe(true);
  });
});

describe('emblem and closure features', () => {
  it('derives the emblem from the kind and dates the closed milestone', () => {
    const data: ReligionDataset = structuredClone(religionFixture);
    data.milestones.push(contraction(), {
      ...contraction({ id: 'buddhism-schism', kind: 'schism' }),
      closesId: undefined,
    });
    const features = religionFeatures(data).features;
    const point = (id: string) => features.find((item) => item.id === `${id}-point`)!;
    expect(point('buddhism-origin').properties?.emblem).toBe('origin');
    expect(point('buddhism-sri-lanka').properties?.emblem).toBe('plain');
    expect(point('buddhism-schism').properties?.emblem).toBe('divided');
    expect(point('buddhism-ban').properties?.emblem).toBe('closing');
    expect(point('buddhism-origin').properties?.closedYear).toBe(100);
    expect(
      features.find((item) => item.id === 'buddhism-origin-area')?.properties?.closedYear,
    ).toBe(100);
    expect(point('buddhism-sri-lanka').properties).not.toHaveProperty('closedYear');
  });
  it('keeps the earliest closing year when several contractions target one centre', () => {
    const data = structuredClone(religionFixture);
    data.milestones.push(
      contraction(),
      contraction({ id: 'earlier-ban', year: 50 }),
      contraction({ id: 'later-ban', year: 200 }),
    );
    const point = religionFeatures(data).features.find(
      (item) => item.id === 'buddhism-origin-point',
    );
    expect(point?.properties?.closedYear).toBe(50);
  });
});

describe('emblem image ids', () => {
  const spec = latest['layout_symbol']!['icon-image'];
  it('maps each emblem variant to its sprite id', () => {
    const image = milestoneSpriteIds('religion').emblemImage;
    const cases: [string, string][] = [
      ['plain', 'religion-x'],
      ['origin', 'religion-origin-x'],
      ['divided', 'religion-divided-x'],
      ['closing', 'religion-closing-x'],
    ];
    for (const [emblem, expected] of cases)
      expect(evaluate(image, { emblem, theme: 'x' }, spec)).toBe(expected);
  });
});

describe('closure dimming', () => {
  const paint = new Map(
    religionAgePaint(1000, 'dark').map(([id, key, value]) => [`${id}:${key}`, value]),
  );
  const icon = paint.get('religion-milestones:icon-opacity');
  const fill = paint.get('religion-areas:fill-opacity');
  it('dims a closed centre from the closing year, paint only', () => {
    const spec = latest['paint_symbol']!['icon-opacity'];
    const open = evaluate(icon, { year: 900 }, spec) as number;
    expect(evaluate(icon, { year: 900, closedYear: 950 }, spec)).toBeCloseTo(open * 0.3);
    expect(evaluate(icon, { year: 900, closedYear: 1050 }, spec)).toBeCloseTo(open);
    expect(evaluate(icon, { year: 900 }, spec)).toBeCloseTo(open);
    const fillSpec = latest['paint_fill']!['fill-opacity'];
    const area = evaluate(fill, { year: 900 }, fillSpec) as number;
    expect(evaluate(fill, { year: 900, closedYear: 950 }, fillSpec)).toBeCloseTo(area * 0.3);
  });
});

describe('emblem sprites', () => {
  it('registers the divided and closing medallions per theme', () => {
    const dashes: number[][] = [];
    const context = {
      fillStyle: '',
      strokeStyle: '',
      globalAlpha: 1,
      lineWidth: 0,
      lineCap: '',
      lineJoin: '',
      scale: vi.fn(),
      translate: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      setLineDash: (dash: number[]) => dashes.push(dash),
      getImageData: (x: number, y: number, width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
      }),
    };
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    });
    vi.stubGlobal('Path2D', class Path2D {});
    const images: string[] = [];
    const map = {
      hasImage: () => false,
      addImage: (id: string) => images.push(id),
      removeImage: vi.fn(),
    };
    createMilestoneSprites(map as unknown as MapInstance, {
      ids: milestoneSpriteIds('religion'),
      symbols: { confucian: ['M0 0 L1 1'] },
      fallbackSymbol: 'confucian',
      ink: '#09222e',
      subject: 'Test emblems',
    }).ensure([{ id: 'x', color: '#edb75a', symbol: 'confucian' }]);
    for (const id of [
      'religion-x',
      'religion-origin-x',
      'religion-divided-x',
      'religion-closing-x',
      'religion-dot-x',
      'religion-arrow-x',
      'religion-hatch-x',
      'religion-selection-ring',
    ])
      expect(images).toContain(id);
    expect(dashes).toContainEqual([3.2, 2.4]);
    vi.unstubAllGlobals();
  });
});
