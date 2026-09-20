import { describe, expect, it } from 'vitest';
import { temporalShards } from '../../pipeline/build/shards';

describe('PMTiles temporal partitions', () => {
  it('includes events whose duration overlaps a padded bin despite starting centuries earlier', () => {
    const events = [
      { id: 'Q1', start: { year: 1600 }, end: { year: 1850 } },
      { id: 'Q2', start: { year: 1812 } },
      { id: 'Q3', start: { year: 1700 }, end: { year: 1784 } },
      { id: 'Q4', start: { year: 1844 } },
      { id: 'Q5', start: { year: 1845 } },
    ];
    const shards = temporalShards(events);
    const shard = shards.find((entry) => entry.key === '1810')!;
    expect(shard).toMatchObject({
      start: 1810,
      end: 1819,
      validFrom: 1785,
      validTo: 1844,
      count: 3,
    });
    expect(shard.events.map((event) => event.id)).toEqual(['Q1', 'Q2', 'Q4']);
  });
  it('uses actual astronomical bins and creates no invented populated period', () => {
    const shards = temporalShards([
      { id: 'Q1', start: { year: -331 } },
      { id: 'Q2', start: { year: 1812 } },
    ]);
    expect(shards.map((entry) => entry.key)).toEqual(['-400', '1810']);
    expect(shards[0]).toMatchObject({ start: -400, end: -301, validFrom: -425, validTo: -276 });
    expect(temporalShards([])).toEqual([]);
  });
});
