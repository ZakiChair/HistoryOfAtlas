import { describe, expect, it } from 'vitest';
import geography from '../../public/geo/manifest.json';
import type { GeographyManifest } from '../../lib/geography';
import { boundaryFrames, boundaryPresentation, wrapLongitude } from '../../lib/map-boundaries';
import { createInitialAtlasState, parseAtlasUrl, serializeAtlasUrl } from '../../lib/store';

const geo = geography as unknown as GeographyManifest;

describe('sourced boundary selection', () => {
  it('uses the historical fallback before actual source coverage, despite padded shards', () => {
    const year = geo.temporal!.range[0] - 1;
    expect(geo.temporal!.shards.some((shard) => shard.start <= year && shard.end >= year)).toBe(
      true,
    );
    expect(
      boundaryFrames(geo, year, 'cliopatria').every((frame) => frame.id.startsWith('snapshot-')),
    ).toBe(true);
  });
  it('includes the first documented year and holds the last available interval after coverage', () => {
    expect(boundaryFrames(geo, geo.temporal!.range[0], 'cliopatria')[0].year).toBe(
      geo.temporal!.range[0],
    );
    expect(boundaryFrames(geo, geo.temporal!.range[1] + 1, 'cliopatria')[0].year).toBe(
      geo.temporal!.range[1],
    );
  });
  it('never renders a future snapshot with zero weight at an exact observation year', () => {
    const year = geo.snapshots[10].year;
    expect(boundaryFrames(geo, year, 'historical-basemaps')).toMatchObject([
      { id: `snapshot-${year}`, weight: 1 },
    ]);
  });
  it('crossfades exactly the two bracketing observations and does not duplicate the last one', () => {
    const ordered = [...geo.snapshots].sort((a, b) => a.year - b.year);
    const year = (ordered[10].year + ordered[11].year) / 2;
    expect(boundaryFrames(geo, year, 'historical-basemaps').map((frame) => frame.weight)).toEqual([
      0.5, 0.5,
    ]);
    expect(boundaryFrames(geo, ordered.at(-1)!.year + 1, 'historical-basemaps')).toHaveLength(1);
  });
});

describe('boundary reading matches the rendered frames', () => {
  it('does not claim the future snapshot is visible at an exact observation', () => {
    expect(boundaryPresentation(geo, 1800, 'historical-basemaps')).toMatchObject({
      source: 'historical-basemaps',
      status: 'snapshot',
      years: [1800],
      fallback: false,
    });
  });
  it('identifies a blend as illustrative, retaining both actual observation dates', () => {
    expect(boundaryPresentation(geo, 1807, 'historical-basemaps')).toMatchObject({
      status: 'transition',
      years: [1800, 1815],
    });
  });
  it('labels a retained frame with its source year rather than the requested year', () => {
    expect(boundaryPresentation(geo, 2026, 'cliopatria')).toMatchObject({
      source: 'cliopatria',
      status: 'latest',
      years: [2024],
    });
    expect(boundaryPresentation(geo, 2026, 'historical-basemaps')).toMatchObject({
      source: 'historical-basemaps',
      status: 'latest',
      years: [2010],
    });
  });
  it('explains a fallback before Cliopatria coverage and preserves astronomical BCE dates', () => {
    expect(boundaryPresentation(geo, -3500, 'cliopatria')).toMatchObject({
      source: 'historical-basemaps',
      status: 'transition',
      years: [-3999, -2999],
      fallback: true,
    });
    expect(boundaryPresentation(geo, -5000, 'cliopatria')).toMatchObject({
      status: 'earliest',
      years: [-3999],
    });
  });
  it('uses the rendered source even when an expected temporal shard is missing', () => {
    const missingShard = { ...geo, temporal: { ...geo.temporal!, shards: [] } };
    expect(boundaryPresentation(missingShard, 1800, 'cliopatria')).toMatchObject({
      source: 'historical-basemaps',
      status: 'snapshot',
      years: [1800],
      fallback: true,
    });
    expect(
      boundaryPresentation({ snapshots: [], basemap: geo.basemap }, 1800, 'cliopatria'),
    ).toMatchObject({
      source: null,
      status: 'unavailable',
      years: [],
    });
  });
});

describe('globe and repeated-world camera longitude', () => {
  it.each([
    [181, -179],
    [-181, 179],
    [721, 1],
    [-721, -1],
    [180, 180],
    [-180, -180],
  ])('wraps %s to %s', (input, expected) => {
    expect(wrapLongitude(input)).toBe(expected);
  });
  it('preserves subpixel camera precision and roundtrips a dateline crossing in a shared URL', () => {
    expect(wrapLongitude(12.123456789)).toBe(12.123456789);
    const state = createInitialAtlasState();
    state.camera.lon = wrapLongitude(181);
    expect(parseAtlasUrl(serializeAtlasUrl(state)).camera).toEqual(state.camera);
  });
});
