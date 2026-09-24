export type ScreenEvent = {
  id: string;
  x: number;
  y: number;
  lon: number;
  lat: number;
  type: string;
  importance: number;
};

export type EventCluster = {
  id: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  count: number;
  ids: string[];
  representative: ScreenEvent;
};

export const CLUSTER_RADIUS = 45;
export const MAX_CLUSTER_INPUT = 100_000;
export const MAX_CLUSTER_OUTPUT = 6_000;

/** Fixed screen-space anchors prevent chains of adjacent points from merging an entire continent. */
export function clusterEvents(
  points: readonly ScreenEvent[],
  radius = CLUSTER_RADIUS,
): EventCluster[] {
  if (!Number.isFinite(radius) || radius <= 0)
    throw new Error('A positive clustering radius is required');
  const ordered = points
    .filter(
      (point) =>
        /^Q[1-9]\d*$/.test(point.id) &&
        [point.x, point.y, point.lon, point.lat, point.importance].every(Number.isFinite),
    )
    .sort(
      (a, b) =>
        b.importance - a.importance ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) ||
        a.x - b.x ||
        a.y - b.y,
    );
  const seen = new Set<string>();
  const cells = new Map<string, EventCluster[]>();
  const clusters: EventCluster[] = [];
  const squaredRadius = radius * radius;
  for (const point of ordered) {
    if (seen.has(point.id)) continue;
    seen.add(point.id);
    const cellX = Math.floor(point.x / radius),
      cellY = Math.floor(point.y / radius);
    let nearest: EventCluster | undefined;
    let nearestDistance = Infinity;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        for (const candidate of cells.get(`${cellX + dx}:${cellY + dy}`) ?? []) {
          const distance = (point.x - candidate.anchorX) ** 2 + (point.y - candidate.anchorY) ** 2;
          if (
            distance <= squaredRadius &&
            (distance < nearestDistance ||
              (distance === nearestDistance && (!nearest || candidate.id < nearest.id)))
          ) {
            nearest = candidate;
            nearestDistance = distance;
          }
        }
      }
    if (nearest) {
      nearest.count += 1;
      nearest.x += (point.x - nearest.x) / nearest.count;
      nearest.y += (point.y - nearest.y) / nearest.count;
      nearest.ids.push(point.id);
    } else {
      const cluster: EventCluster = {
        id: point.id,
        x: point.x,
        y: point.y,
        anchorX: point.x,
        anchorY: point.y,
        count: 1,
        ids: [point.id],
        representative: point,
      };
      clusters.push(cluster);
      const key = `${cellX}:${cellY}`;
      const cell = cells.get(key) ?? [];
      cell.push(cluster);
      cells.set(key, cell);
    }
  }
  return clusters;
}

/**
 * Keeps the clusters that the zoom-thinned markers also show. A group led by a marker-visible
 * event keeps its full count, minor members included; a minor event alone, or a group of minor
 * events only, is dropped, because it would appear at rest and vanish at every pan. Each
 * cluster is seeded by its most important member, so the representative decides.
 */
export function visibleClusters(
  clusters: readonly EventCluster[],
  markerFloor: number,
): EventCluster[] {
  return clusters.filter((cluster) => cluster.representative.importance >= markerFloor);
}

export type ClusterRequest = { token: number; points: ScreenEvent[] };
export type ClusterResponse = { token: number; clusters: EventCluster[]; overflow?: boolean };
