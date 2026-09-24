import { closeSync, openSync, readSync, writeSync } from 'node:fs';
import { open, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { bytesToHeader } from 'pmtiles';

/** PMTiles v3 fixed header: zoom range at bytes 100-101, E7 bounds (int32 LE) at 102-117. */
const HEADER_BYTES = 127;
const BOUNDS_OFFSET = 102;
const MAGIC = 'PMTiles';
const MAX_MERCATOR_LATITUDE = 85.0511287798066;

export type Bounds = readonly [minLon: number, minLat: number, maxLon: number, maxLat: number];

function decodeHeader(bytes: Uint8Array) {
  if (
    bytes.byteLength < HEADER_BYTES ||
    String.fromCharCode(...bytes.subarray(0, MAGIC.length)) !== MAGIC
  )
    throw new Error('Not a PMTiles v3 archive.');
  const header = bytesToHeader(bytes.slice(0, HEADER_BYTES).buffer);
  return {
    maxZoom: header.maxZoom,
    bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat] as Bounds,
  };
}

/** Same test as the pmtiles client, which logs "Bounds of PMTiles archive … are not valid". */
export function hasZeroArea([minLon, minLat, maxLon, maxLat]: Bounds): boolean {
  return minLon >= maxLon || minLat >= maxLat;
}

/**
 * Widens only a collapsed axis by half a tile at the archive's deepest zoom, so the tile holding a
 * lone location and the neighbours that carry its buffered symbol remain addressable.
 */
export function paddedBounds(bounds: Bounds, maxZoom: number): Bounds {
  const pad = 180 / 2 ** maxZoom;
  const widen = (low: number, high: number, limit: number): [number, number] =>
    low < high
      ? [low, high]
      : [Math.max(-limit, Math.min(low, high) - pad), Math.min(limit, Math.max(low, high) + pad)];
  const [minLon, maxLon] = widen(bounds[0], bounds[2], 180);
  const [minLat, maxLat] = widen(bounds[1], bounds[3], MAX_MERCATOR_LATITUDE);
  return [minLon, minLat, maxLon, maxLat];
}

/** Rewrites the bounds of a header in place when they collapse to a point or a line. */
export function padDegenerateHeader(bytes: Uint8Array): Bounds | null {
  const { bounds, maxZoom } = decodeHeader(bytes);
  if (!hasZeroArea(bounds)) return null;
  const padded = paddedBounds(bounds, maxZoom);
  const view = new DataView(bytes.buffer, bytes.byteOffset + BOUNDS_OFFSET, 16);
  padded.forEach((value, index) => view.setInt32(index * 4, Math.round(value * 1e7), true));
  return padded;
}

/**
 * tippecanoe records the extent of its input features, so an archive whose events share one place
 * gets point bounds. Patching the fixed-size header keeps every offset, tile and directory intact.
 */
export function padDegenerateArchiveBounds(path: string): Bounds | null {
  const descriptor = openSync(path, 'r+');
  try {
    const bytes = new Uint8Array(HEADER_BYTES);
    if (readSync(descriptor, bytes, 0, HEADER_BYTES, 0) !== HEADER_BYTES)
      throw new Error(`${path} is shorter than a PMTiles header.`);
    const padded = padDegenerateHeader(bytes);
    if (padded) writeSync(descriptor, bytes, BOUNDS_OFFSET, 16, BOUNDS_OFFSET);
    return padded;
  } finally {
    closeSync(descriptor);
  }
}

/** Lists every published archive whose header is unreadable or has zero-area bounds. */
export async function invalidArchiveBounds(
  directory: string,
): Promise<{ archives: number; issues: string[] }> {
  const paths = (await readdir(directory, { recursive: true }))
    .filter((path) => path.endsWith('.pmtiles'))
    .sort();
  const issues: string[] = [];
  for (const path of paths) {
    const handle = await open(join(directory, path), 'r');
    try {
      const bytes = new Uint8Array(HEADER_BYTES);
      const { bytesRead } = await handle.read(bytes, 0, HEADER_BYTES, 0);
      if (bytesRead !== HEADER_BYTES) throw new Error('Shorter than a PMTiles header.');
      const { bounds } = decodeHeader(bytes);
      if (hasZeroArea(bounds)) issues.push(`${path}: bounds ${bounds.join(',')} have zero area`);
    } catch (error) {
      issues.push(`${path}: ${(error as Error).message}`);
    } finally {
      await handle.close();
    }
  }
  return { archives: paths.length, issues };
}
