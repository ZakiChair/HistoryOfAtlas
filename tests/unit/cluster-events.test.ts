import { describe, expect, it } from 'vitest';
import { clusterEvents, type ScreenEvent } from '../../components/map/cluster-events';

// Screen-space fixtures; no historical data or coordinates enter the production corpus.
const point = (id: string, x: number, y: number, importance = 50): ScreenEvent => ({
  id,
  x,
  y,
  lon: 0,
  lat: 0,
  type: 'battle',
  importance,
});

describe('screen-space event clustering', () => {
  it('preserves every unique QID exactly once, even across duplicated tile features', () => {
    const points = [
      point('Q1', 10, 10),
      point('Q2', 15, 15),
      point('Q3', 300, 100),
      point('Q1', 10, 10),
    ];
    const clusters = clusterEvents(points);
    expect(clusters.reduce((sum, cluster) => sum + cluster.count, 0)).toBe(3);
    expect(clusters.flatMap((cluster) => cluster.ids).sort()).toEqual(['Q1', 'Q2', 'Q3']);
    expect(clusters.map((cluster) => cluster.count)).toEqual([2, 1]);
  });
  it('checks neighboring cells instead of splitting two close points at a cell edge', () => {
    expect(clusterEvents([point('Q1', 44, 44), point('Q2', 46, 46)])).toHaveLength(1);
    expect(clusterEvents([point('Q1', -1, -1), point('Q2', 1, 1)])).toHaveLength(1);
  });
  it('uses Euclidean distance and includes the exact radius boundary', () => {
    expect(clusterEvents([point('Q1', 0, 0), point('Q2', 45, 0)])).toHaveLength(1);
    expect(clusterEvents([point('Q1', 0, 0), point('Q2', 32, 32)])).toHaveLength(2);
    expect(clusterEvents([point('Q1', 0, 0), point('Q2', 45.01, 0)])).toHaveLength(2);
  });
  it('does not merge distant events through a chain of intermediate points', () => {
    const clusters = clusterEvents([point('Q1', 0, 0), point('Q2', 40, 0), point('Q3', 80, 0)]);
    expect(clusters.map((cluster) => cluster.ids)).toEqual([['Q1', 'Q2'], ['Q3']]);
  });
  it('is independent of tile/query ordering and chooses the most important representative', () => {
    const points = [
      point('Q20', 50, 50, 90),
      point('Q1', 55, 50, 10),
      point('Q3', 250, 5),
      point('Q20', 50, 50, 90),
    ];
    expect(clusterEvents(points)).toEqual(clusterEvents([...points].reverse()));
    expect(clusterEvents(points)[0].representative.id).toBe('Q20');
    expect(points).toHaveLength(4);
  });
  it('preserves singleton coordinates and places a group at its screen centroid', () => {
    const clusters = clusterEvents([
      point('Q1', 10, 10),
      point('Q2', 30, 20),
      point('Q3', 300, 50),
    ]);
    expect(clusters[0]).toMatchObject({ x: 20, y: 15, count: 2 });
    expect(clusters[1].representative).toEqual(point('Q3', 300, 50));
  });
  it('handles a dense large input without pairwise comparisons or lost counts', () => {
    const points = Array.from({ length: 50_000 }, (_, index) =>
      point(`Q${index + 1}`, 100 + (index % 5), 100),
    );
    expect(clusterEvents(points)).toMatchObject([{ count: 50_000 }]);
  });
  it('returns an empty collection for no data and refuses invalid coordinates', () => {
    expect(clusterEvents([])).toEqual([]);
    expect(clusterEvents([point('Q1', NaN, 0), point('invalid', 0, 0)])).toEqual([]);
    expect(() => clusterEvents([], 0)).toThrow();
  });
});
