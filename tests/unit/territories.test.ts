import { describe, expect, it } from 'vitest';
import { areaPath, normalizeObservations } from '@/components/panels/EntityPanel';

describe('sourced territorial observations', () => {
  it('keeps dated intervals without inferring founding or dissolution', () => {
    const observations = normalizeObservations([
      { fromYear: 100, toYear: 120, areaKm2: 350 },
      { fromYear: -1, toYear: 0, areaKm2: 100 },
    ]);
    expect(observations).toEqual([
      { fromYear: -1, toYear: 0, areaKm2: 100 },
      { fromYear: 100, toYear: 120, areaKm2: 350 },
    ]);
  });

  it('treats an isolated basemap snapshot as one observation', () => {
    expect(
      normalizeObservations([{ year: -322, areaKm2: 200, source: 'https://example.org/source' }]),
    ).toEqual([
      { fromYear: -322, toYear: -322, areaKm2: 200, source: 'https://example.org/source' },
    ]);
  });

  it('rejects malformed data rather than plotting impossible territory', () => {
    expect(
      normalizeObservations([
        { fromYear: 5, toYear: 4, areaKm2: 20 },
        { fromYear: 5, toYear: 10, areaKm2: -1 },
        { fromYear: 5, toYear: 10, areaKm2: Number.NaN },
        { areaKm2: 20 },
      ]),
    ).toEqual([]);
  });

  it('draws separated intervals without filling unknown years', () => {
    const observations = normalizeObservations([
      { fromYear: 1, toYear: 3, areaKm2: 20 },
      { fromYear: 8, toYear: 10, areaKm2: 40 },
    ]);
    const chart = areaPath(observations);
    expect(chart.path.match(/M/g)).toHaveLength(2);
    expect(chart.points).toHaveLength(2);
    expect(chart.points[0]?.year).toBe(1);
    expect(chart.points[1]?.year).toBe(8);
    expect(chart.path).not.toMatch(/NaN|Infinity/);
  });

  it('can chart a polity known from a single year', () => {
    const chart = areaPath(normalizeObservations([{ year: 0, areaKm2: 100 }]));
    expect(chart.path).not.toMatch(/NaN|Infinity/);
    expect(chart.points[0]?.year).toBe(0);
  });
});
