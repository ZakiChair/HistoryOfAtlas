import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEvents } from './build';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const options = new Set(process.argv.slice(2));
function run(script: string): void {
  const result = spawnSync('python3', [script], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Acquisition failed: ${script}`);
}
if (!options.has('--offline')) {
  if (!options.has('--events-only')) run('pipeline/geography/build.py');
  run('pipeline/fetch/wikidata.py');
}
await buildEvents(root, {
  partial: options.has('--partial'),
  skipTiles: options.has('--skip-tiles'),
  verify: options.has('--verify'),
  refreshEditorial: options.has('--refresh-editorial'),
});
