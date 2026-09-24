import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { bytesToHeader } from 'pmtiles';
import {
  hasZeroArea,
  invalidArchiveBounds,
  padDegenerateArchiveBounds,
  padDegenerateHeader,
  paddedBounds,
} from '../../pipeline/build/pmtiles';

/** A PMTiles v3 header followed by a few payload bytes that must never be rewritten. */
function archive(bounds: readonly number[], maxZoom = 8): Uint8Array {
  const bytes = new Uint8Array(160).fill(7);
  bytes.set([...'PMTiles'].map((character) => character.charCodeAt(0)));
  const view = new DataView(bytes.buffer);
  view.setUint8(7, 3);
  view.setUint8(100, 0);
  view.setUint8(101, maxZoom);
  bounds.forEach((value, index) => view.setInt32(102 + index * 4, Math.round(value * 1e7), true));
  return bytes;
}
const bounds = (bytes: Uint8Array) => {
  const header = bytesToHeader(bytes.slice(0, 127).buffer);
  return [header.minLon, header.minLat, header.maxLon, header.maxLat];
};

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('PMTiles archive bounds', () => {
  it('uses the client rule: a point or a line has no area', () => {
    expect(hasZeroArea([43.5, 33.7, 43.5, 33.7])).toBe(true);
    expect(hasZeroArea([10, 33.7, 43.5, 33.7])).toBe(true);
    expect(hasZeroArea([10, 20, 43.5, 33.7])).toBe(false);
  });

  it('widens only a collapsed axis by half a tile at the deepest zoom, within Web Mercator', () => {
    expect(paddedBounds([43.5, 33.7, 43.5, 33.7], 8)).toEqual([
      43.5 - 0.703125,
      33.7 - 0.703125,
      43.5 + 0.703125,
      33.7 + 0.703125,
    ]);
    expect(paddedBounds([10, 33.7, 43.5, 33.7], 8)).toEqual([
      10,
      33.7 - 0.703125,
      43.5,
      33.7 + 0.703125,
    ]);
    expect(paddedBounds([180, 85, 180, 85], 8)).toEqual([
      179.296875, 84.296875, 180, 85.0511287798066,
    ]);
  });

  it('patches a point-bounded header in place and leaves valid headers byte-identical', () => {
    const degenerate = archive([43.5, 33.7, 43.5, 33.7]);
    const payload = degenerate.slice(118);
    expect(padDegenerateHeader(degenerate)).not.toBeNull();
    expect(bounds(degenerate)).toEqual([42.796875, 32.996875, 44.203125, 34.403125]);
    expect(hasZeroArea(bounds(degenerate) as [number, number, number, number])).toBe(false);
    expect(degenerate.slice(118)).toEqual(payload);

    const valid = archive([-10, -20, 30, 40]);
    const before = valid.slice();
    expect(padDegenerateHeader(valid)).toBeNull();
    expect(valid).toEqual(before);
    expect(() => padDegenerateHeader(new Uint8Array(127))).toThrow(/PMTiles/);
  });

  it('rewrites only the 16 bound bytes of an archive file and reports what data checks reject', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'atlas-pmtiles-'));
    directories.push(directory);
    mkdirSync(join(directory, 'shards'));
    const point = join(directory, 'shards', '-2500.pmtiles');
    writeFileSync(point, archive([43.5, 33.7, 43.5, 33.7]));
    writeFileSync(join(directory, 'world.pmtiles'), archive([-180, -85, 180, 85]));
    writeFileSync(join(directory, 'notes.json'), '{}');

    expect(await invalidArchiveBounds(directory)).toEqual({
      archives: 2,
      issues: ['shards/-2500.pmtiles: bounds 43.5,33.7,43.5,33.7 have zero area'],
    });
    const original = readFileSync(point);
    expect(padDegenerateArchiveBounds(point)).not.toBeNull();
    const patched = readFileSync(point);
    expect(patched.length).toBe(original.length);
    const changed = [...patched.keys()].filter((index) => patched[index] !== original[index]);
    expect(Math.min(...changed)).toBeGreaterThanOrEqual(102);
    expect(Math.max(...changed)).toBeLessThan(118);
    expect(padDegenerateArchiveBounds(point)).toBeNull();
    expect(await invalidArchiveBounds(directory)).toEqual({ archives: 2, issues: [] });

    writeFileSync(join(directory, 'broken.pmtiles'), 'not an archive');
    expect((await invalidArchiveBounds(directory)).issues).toEqual([
      'broken.pmtiles: Shorter than a PMTiles header.',
    ]);
  });
});
