import {
  clusterEvents,
  MAX_CLUSTER_INPUT,
  MAX_CLUSTER_OUTPUT,
  type ClusterRequest,
  type ClusterResponse,
} from './cluster-events';

self.onmessage = (event: MessageEvent<ClusterRequest>) => {
  const { token, points } = event.data;
  if (points.length > MAX_CLUSTER_INPUT) {
    self.postMessage({ token, clusters: [], overflow: true } satisfies ClusterResponse);
    return;
  }
  const clusters = clusterEvents(points);
  self.postMessage({
    token,
    clusters: clusters.length <= MAX_CLUSTER_OUTPUT ? clusters : [],
    overflow: clusters.length > MAX_CLUSTER_OUTPUT,
  } satisfies ClusterResponse);
};
