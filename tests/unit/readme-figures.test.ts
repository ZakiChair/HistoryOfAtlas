import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
const readme = readFileSync(new URL('README.md', root), 'utf8');
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

const events = read('public/data/manifest.json');
const geography = read('public/geo/manifest.json');
const battles = read('public/data/battles/coverage.json');

/** The README writes counts with thousands separators; the artifacts hold plain numbers. */
const grouped = (count: number) => count.toLocaleString('en-US');

/**
 * Each figure is quoted with enough surrounding words to fail when the count moves to another
 * claim rather than disappearing. A rebuilt dataset must update the README in the same change.
 */
const FIGURES: ReadonlyArray<readonly [string, number, string]> = [
  ['dated polity geometry records', geography.temporal.records, '{} dated polity geometry records'],
  ['source-named entities', geography.temporal.entities, 'for {} source-named entities'],
  [
    'temporal PMTiles archives',
    geography.temporal.shards.length,
    'distributed in {} temporal PMTiles archives',
  ],
  [
    'Historical Basemaps snapshots',
    geography.snapshots.length,
    '**Historical Basemaps** supplies {} independent world snapshots',
  ],
  ['dated, geolocated events', events.totalEvents, '**{} dated, geolocated events**'],
  ['acquired battle records', battles.total, 'battle catalogue contains **{} records**'],
  ['mappable battles', battles.mappable, 'of which **{}** have usable dates and locations'],
  [
    'comparable opposing-force quantities',
    battles.documented,
    '**{}** records have comparable opposing-force quantities',
  ],
];

describe('README published figures', () => {
  for (const [label, count, template] of FIGURES) {
    it(`quotes the published ${label}`, () => {
      expect(Number.isInteger(count) && count > 0, `${label} is not a published count`).toBe(true);
      expect(readme).toContain(template.replace('{}', grouped(count)));
    });
  }

  it('states the same mappable share the battle coverage report publishes', () => {
    // A stale figure that stays below the total reads as plausible; the pair must be exact.
    expect(battles.mappable).toBeLessThan(battles.total);
    const claimed = /contains \*\*([\d,]+) records\*\*, of which \*\*([\d,]+)\*\*/.exec(readme);
    expect(claimed, 'the battle catalogue sentence changed shape').not.toBeNull();
    expect(claimed!.slice(1, 3)).toEqual([grouped(battles.total), grouped(battles.mappable)]);
  });
});
