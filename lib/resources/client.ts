import { invalidateJson, readJson } from '@/lib/data-client';
import { ResourceDatasetSchema, type ResourceDataset } from './types';

let datasetPromise: Promise<ResourceDataset> | undefined;

/** This module, validation and data are loaded only when the layer is opened. */
export function getResourceDataset(): Promise<ResourceDataset> {
  datasetPromise ??= readJson<unknown>('/data/resources/sites.json')
    .then((data) => ResourceDatasetSchema.parse(data))
    .catch((error) => {
      datasetPromise = undefined;
      invalidateJson('/data/resources/sites.json');
      throw error;
    });
  return datasetPromise;
}
