/** pnpm exec tsx scripts/build-context-coverage.ts [--check]; no acquisition or change-log input. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from '../lib/zod';
import { CoverageDatasetSchema, type CoverageDataset } from '../lib/context/coverage';
import { classifyRegion } from '../pipeline/normalize/region';

const Year = z.number().int().safe();
const Center = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const Manifest = z.object({
  temporal: z.object({ range: z.tuple([Year, Year]) }),
  snapshots: z.array(z.object({ year: Year })).min(1),
  sources: z.array(z.object({ label: z.string(), url: z.url(), licence: z.string() })),
});
const TemporalInput = z.array(
  z.object({
    id: z.string(),
    center: Center,
    observations: z.array(z.object({ fromYear: Year, toYear: Year })).min(1),
  }),
);
const SnapshotInput = z.array(
  z.object({
    id: z.string(),
    center: Center,
    observations: z.array(z.object({ year: Year })).min(1),
  }),
);

export function createCoverageDataset(
  manifestInput: unknown,
  temporalInput: unknown,
  snapshotInput: unknown,
  inputsSha256?: string,
): CoverageDataset {
  const manifest = Manifest.parse(manifestInput);
  const temporal = TemporalInput.parse(temporalInput);
  const snapshots = SnapshotInput.parse(snapshotInput);
  const snapshotYears = manifest.snapshots.map((snapshot) => snapshot.year).sort((a, b) => a - b);
  const intervalSource = manifest.sources.find((source) => source.label.startsWith('Cliopatria'));
  const snapshotSource = manifest.sources.find((source) =>
    source.label.startsWith('Historical Basemaps'),
  );
  if (!intervalSource || !snapshotSource)
    throw new Error('Both licensed geography sources are required.');
  const polities = [
    ...temporal.map((polity) => ({
      id: polity.id,
      sourceId: 'cliopatria' as const,
      region: classifyRegion(polity.center),
      center: polity.center,
      intervals: polity.observations.map(
        (observation) => [observation.fromYear, observation.toYear] as [number, number],
      ),
    })),
    ...snapshots.map((polity) => ({
      id: polity.id,
      sourceId: 'historical-basemaps' as const,
      region: classifyRegion(polity.center),
      center: polity.center,
      intervals: polity.observations.map(
        (observation) => [observation.year, observation.year] as [number, number],
      ),
    })),
  ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const polity of polities) polity.intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return CoverageDatasetSchema.parse({
    version: 1,
    method: 'reference-point-regions-v1',
    centerBasis: 'first-source-label-anchor',
    ...(inputsSha256 ? { inputsSha256 } : {}),
    sources: [
      {
        id: 'cliopatria',
        label: intervalSource.label,
        url: intervalSource.url,
        license: intervalSource.licence,
        range: manifest.temporal.range,
        kind: 'intervals',
        approximate: true,
      },
      {
        id: 'historical-basemaps',
        label: snapshotSource.label,
        url: snapshotSource.url,
        license: snapshotSource.licence,
        range: [snapshotYears[0], snapshotYears.at(-1)],
        kind: 'snapshots',
        approximate: true,
        snapshotYears,
      },
    ],
    polities,
  });
}

export async function buildContextCoverage(check = false) {
  const root = new URL('../', import.meta.url);
  const hash = createHash('sha256');
  const read = async (path: string) => {
    const bytes = await readFile(new URL(path, root), 'utf8');
    hash.update(path).update('\0').update(bytes).update('\0');
    return JSON.parse(bytes) as unknown;
  };
  const manifest = await read('public/geo/manifest.json');
  const historical = await read('public/geo/entities.json');
  const files = (await readdir(new URL('public/geo/polities/', root)))
    .filter((file) => file.endsWith('.json'))
    .sort();
  const polities: unknown[] = [];
  // Sequential hashing fixes the input order independently of filesystem and IO completion order.
  for (const file of files) polities.push(await read(`public/geo/polities/${file}`));
  const dataset = createCoverageDataset(manifest, polities, historical, hash.digest('hex'));
  const content = `${JSON.stringify(dataset)}\n`;
  const directory = new URL('public/data/context/', root);
  const destination = new URL('coverage.json', directory);
  if (check) {
    const current = await readFile(destination, 'utf8');
    if (current !== content)
      throw new Error('Coverage inventory is stale; run scripts/build-context-coverage.ts.');
  } else {
    await mkdir(directory, { recursive: true });
    const temporary = new URL('coverage.json.tmp', directory);
    await writeFile(temporary, content);
    await rename(temporary, destination);
  }
  console.log(
    `Coverage ${check ? 'verified' : 'published'}: ${dataset.polities.length} source entries, ${dataset.polities.reduce((sum, polity) => sum + polity.intervals.length, 0)} observations.`,
  );
  return dataset;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildContextCoverage(process.argv.includes('--check')).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
