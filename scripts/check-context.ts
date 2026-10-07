/** Validate every published context corpus, including the two hand-authored collections. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ChangesDatasetSchema } from '../lib/context/changes';
import { CitiesDatasetSchema } from '../lib/context/cities';
import { CoverageDatasetSchema } from '../lib/context/coverage';
import { NetworkDatasetSchema } from '../lib/context/networks';

const root = new URL('../', import.meta.url);
const read = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`public/data/context/${name}.json`, root), 'utf8'));

export function checkContextData(): string {
  const changes = ChangesDatasetSchema.parse(read('changes'));
  const networks = NetworkDatasetSchema.parse(read('networks'));
  const coverage = CoverageDatasetSchema.parse(read('coverage'));
  const cities = CitiesDatasetSchema.parse(read('cities'));
  const editorialIds = [...changes.changes, ...networks.networks].map((record) => record.id);
  if (new Set(editorialIds).size !== editorialIds.length)
    throw new Error('Context changes and networks must use distinct record identifiers.');
  return `Validated context data: ${changes.changes.length} transformations, ${networks.networks.length} networks, ${coverage.polities.length} boundary-source entries and ${cities.cities.length} capital places. No missing historical records are inferred.`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  console.log(checkContextData());
