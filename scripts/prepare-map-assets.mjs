import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('maplibre-gl/package.json'));
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const target = join('public', 'vendor', 'maplibre', version);
await mkdir(target, { recursive: true });
for (const name of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  await copyFile(join(root, 'dist', name), join(target, name));
}
await copyFile(join(root, 'LICENSE.txt'), join(target, 'LICENSE.txt'));
console.log(`Prepared MapLibre ${version} module worker.`);
