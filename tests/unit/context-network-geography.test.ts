import { describe, expect, it } from 'vitest';
import { networkGeometry, networkCamera } from '@/lib/context/network-geography';

describe('schematic networks crossing the Pacific', () => {
  it('cuts the dateline instead of drawing Manila–Acapulco across Africa', () => {
    const anchors: [number, number][] = [
      [120.97, 14.6],
      [-99.88, 16.86],
    ];
    const before = structuredClone(anchors);
    const geometry = networkGeometry(anchors);
    expect(geometry.type).toBe('MultiLineString');
    if (geometry.type !== 'MultiLineString') throw new Error('Expected dateline split');
    expect(geometry.coordinates).toHaveLength(2);
    expect(geometry.coordinates[0][0]).toEqual(anchors[0]);
    expect(geometry.coordinates[1].at(-1)).toEqual(anchors[1]);
    expect(geometry.coordinates[0].at(-1)?.[0]).toBe(180);
    expect(geometry.coordinates[1][0][0]).toBe(-180);
    expect(geometry.coordinates[0].at(-1)?.[1]).toBeCloseTo(geometry.coordinates[1][0][1]);
    expect(networkCamera(anchors).coordinates[0]).toBeCloseTo(-169.455);
    expect(anchors).toEqual(before);
  });

  it.each([
    [
      [-170, 10],
      [170, 30],
    ],
    [
      [180, 10],
      [-170, 20],
    ],
    [
      [170, 0],
      [180, 10],
      [-170, 20],
    ],
    [
      [170, 0],
      [-180, 10],
      [-170, 20],
    ],
    [
      [-180, 0],
      [180, 10],
      [170, 20],
    ],
    [
      [170, 10],
      [-170, 20],
      [170, 30],
    ],
  ] as [number, number][][])(
    'keeps reverse, seam and repeated crossings nondegenerate: %j',
    (...points) => {
      const geometry = networkGeometry(points);
      const parts = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
      for (const part of parts) {
        expect(part.length).toBeGreaterThanOrEqual(2);
        expect(new Set(part.map((point) => point.join(','))).size).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < part.length; i++)
          expect(Math.abs(part[i][0] - part[i - 1][0])).toBeLessThanOrEqual(180);
      }
    },
  );

  it('keeps ordinary regional connections and their view centres unchanged', () => {
    const points: [number, number][] = [
      [35.44, 30.33],
      [34.77, 30.79],
      [34.65, 31.1],
    ];
    expect(networkGeometry(points)).toEqual({ type: 'LineString', coordinates: points });
    expect(networkCamera(points).coordinates[0]).toBeCloseTo(35.045);
    expect(networkCamera(points).coordinates[1]).toBeCloseTo(30.715);
    expect(networkCamera(points).zoom).toBe(2.5);
    expect(
      networkCamera([
        [120.97, 14.6],
        [-99.88, 16.86],
      ]).zoom,
    ).toBeLessThan(2.5);
  });
});
