import { describe, expect, it } from 'vitest';
import { scoreImportance } from '../../pipeline/score';
import { coordinateIssues, validateChronology, isNearLand } from '../../pipeline/validate';
import { parsePoint, dedupeEvents } from '../../pipeline/normalize/helpers';
import { classifyRegion, values } from '../../pipeline/normalize';
import type { FeatureCollection, Polygon } from 'geojson';

describe('historical ingestion quality gates', () => {
  it('rejects malformed, non-finite and out-of-range coordinates', () => {
    expect(coordinateIssues([181, 30])).toEqual(['invalid-longitude']);
    expect(coordinateIssues([5, -91])).toEqual(['invalid-latitude']);
    expect(coordinateIssues([Number.NaN, 30])).toEqual(['invalid-longitude']);
    expect(coordinateIssues([5, 30])).toEqual([]);
  });
  it('rejects an end before a beginning across astronomical year zero', () => {
    expect(validateChronology({ year: 0, month: 4 }, { year: -1, month: 5 })).toEqual([
      'end-before-start',
    ]);
    expect(validateChronology({ year: -1 }, { year: 0 })).toEqual([]);
  });
  it('preserves islands and near-coastal sites but detects open ocean', () => {
    const land: FeatureCollection<Polygon> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    expect(isNearLand([0.5, 0.5], land)).toBe(true);
    expect(isNearLand([1.05, 0.5], land)).toBe(true);
    expect(isNearLand([90, -30], land)).toBe(false);
  });
  it('parses longitude first and rejects unsupported WKT', () => {
    expect(parsePoint('Point(-12.25 40.5)')).toEqual([-12.25, 40.5]);
    expect(parsePoint('Polygon((1 2))')).toBeUndefined();
  });
  it('deduplicates only by Wikidata identity, never by similar names', () => {
    const entries = [
      { id: 'Q1', importance: 20 },
      { id: 'Q2', importance: 30 },
      { id: 'Q1', importance: 40 },
    ];
    expect(dedupeEvents(entries)).toEqual([
      { id: 'Q1', importance: 40 },
      { id: 'Q2', importance: 30 },
    ]);
  });
  it('does not misclassify Pacific islands as South America or Alaska as Oceania', () => {
    expect(classifyRegion([-170, -14])).toBe('oceania');
    expect(classifyRegion([-155, 20])).toBe('oceania');
    expect(classifyRegion([-155, 65])).toBe('north-america');
  });
  it('honors preferred Wikidata statements and omits deprecated claims', () => {
    const item = {
      id: 'Q1',
      claims: {
        P31: [
          { rank: 'deprecated', mainsnak: { datavalue: { value: { id: 'Q2' } } } },
          { rank: 'normal', mainsnak: { datavalue: { value: { id: 'Q3' } } } },
          { rank: 'preferred', mainsnak: { datavalue: { value: { id: 'Q4' } } } },
        ],
      },
    };
    expect(values(item, 'P31')).toEqual([{ id: 'Q4' }]);
  });
});

describe('importance expresses visibility, not human value', () => {
  it('is bounded and rewards source coverage and editorial inclusion', () => {
    expect(scoreImportance({ sitelinks: 0, curated: false, parentSize: 0 })).toBeGreaterThanOrEqual(
      0,
    );
    expect(
      scoreImportance({ sitelinks: 10000, curated: true, parentSize: 10000, strength: 100000000 }),
    ).toBeLessThanOrEqual(100);
    expect(scoreImportance({ sitelinks: 30, curated: true, parentSize: 0 })).toBeGreaterThan(
      scoreImportance({ sitelinks: 30, curated: false, parentSize: 0 }),
    );
    expect(scoreImportance({ sitelinks: 50, curated: false, parentSize: 0 })).toBeGreaterThan(
      scoreImportance({ sitelinks: 5, curated: false, parentSize: 0 }),
    );
  });
});
