import { describe, expect, it } from 'vitest';
import { selectEventArchive } from '../../lib/event-archives';

const manifest = {
  eventsPmtiles: '/all.pmtiles',
  eventShards: [
    {
      key: '1800',
      start: 1800,
      end: 1809,
      validFrom: 1775,
      validTo: 1834,
      path: '/1800.pmtiles',
      count: 3,
    },
    {
      key: '1810',
      start: 1810,
      end: 1819,
      validFrom: 1785,
      validTo: 1844,
      path: '/1810.pmtiles',
      count: 4,
    },
    {
      key: '1850',
      start: 1850,
      end: 1859,
      validFrom: 1825,
      validTo: 1884,
      path: '/1850.pmtiles',
      count: 5,
    },
  ],
};
const options = {
  year: 1812,
  speed: 5,
  playing: false,
  range: null,
  trails: false,
  selectedWar: null,
};

describe('temporal event archive selection', () => {
  it('loads the requested period, retaining a loaded archive while the full window still fits', () => {
    expect(selectEventArchive(manifest, options)).toBe('/1810.pmtiles');
    expect(selectEventArchive(manifest, options, '/1800.pmtiles')).toBe('/1800.pmtiles');
    expect(selectEventArchive(manifest, { ...options, year: 1852 }, '/1800.pmtiles')).toBe(
      '/1850.pmtiles',
    );
  });
  it('accounts for the wider playback window rather than only its central year', () => {
    expect(
      selectEventArchive(manifest, { ...options, playing: true, speed: 100 }, '/1800.pmtiles'),
    ).toBe('/1810.pmtiles');
  });
  it('uses the complete archive only for an explicitly extended view', () => {
    expect(selectEventArchive(manifest, { ...options, range: [1700, 1900] })).toBe('/all.pmtiles');
    expect(selectEventArchive(manifest, { ...options, trails: true })).toBe('/all.pmtiles');
    expect(selectEventArchive(manifest, { ...options, selectedWar: 'Q1' })).toBe('/all.pmtiles');
  });
  it('does not download the whole corpus for years without observations', () => {
    expect(selectEventArchive(manifest, { ...options, year: -3500 })).toBe('/1800.pmtiles');
    expect(selectEventArchive(manifest, { ...options, year: 2026 })).toBe('/1850.pmtiles');
    expect(selectEventArchive({ eventsPmtiles: '/legacy.pmtiles' }, options)).toBe(
      '/legacy.pmtiles',
    );
    expect(selectEventArchive({}, options)).toBeUndefined();
  });
});
