import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ReligionCoverageDatasetSchema,
  type ReligionCoverageDataset,
} from '../../lib/religions/coverage';

function mergeById<T extends { id: string }>(collections: T[][], label: string): T[] {
  const merged = new Map<string, T>();
  for (const row of collections.flat()) {
    const previous = merged.get(row.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row))
      throw new Error(`Conflicting ${label}: ${row.id}`);
    merged.set(row.id, row);
  }
  return [...merged.values()];
}

export function buildReligionCoverage(fragments: unknown[]): ReligionCoverageDataset {
  if (!fragments.length) throw new Error('No religion coverage sources supplied');
  const datasets = fragments.map((fragment) => ReligionCoverageDatasetSchema.parse(fragment));
  return ReligionCoverageDatasetSchema.parse({
    version: 1,
    snapshotMaxAge: Math.max(...datasets.map((dataset) => dataset.snapshotMaxAge)),
    traditions: mergeById(
      datasets.map((dataset) => dataset.traditions),
      'traditions',
    ),
    sources: mergeById(
      datasets.map((dataset) => dataset.sources),
      'sources',
    ),
    geometries: mergeById(
      datasets.map((dataset) => dataset.geometries),
      'geometries',
    ),
    observations: mergeById(
      datasets.map((dataset) => dataset.observations),
      'observations',
    ),
  });
}

const render = (value: unknown) => `${JSON.stringify(value)}\n`;
async function main() {
  const root = new URL('../../', import.meta.url);
  const paths = [
    'data/curated/religion-coverage-rcs.json',
    'data/curated/religion-coverage-seshat.json',
  ];
  const inputs = await Promise.all(
    paths.map(async (path) => {
      const raw = await readFile(new URL(path, root), 'utf8');
      return {
        path,
        hash: createHash('sha256').update(raw).digest('hex'),
        data: JSON.parse(raw) as unknown,
      };
    }),
  );
  const dataset = buildReligionCoverage(inputs.map((input) => input.data));
  const years = dataset.observations.flatMap((row) =>
    row.time.kind === 'snapshot' ? [row.time.year] : [row.time.fromYear, row.time.toYear],
  );
  const report = {
    version: 1,
    regions: new Set(dataset.observations.map((row) => row.regionId)).size,
    geometries: dataset.geometries.length,
    observations: dataset.observations.length,
    snapshots: dataset.observations.filter((row) => row.time.kind === 'snapshot').length,
    intervals: dataset.observations.filter((row) => row.time.kind === 'interval').length,
    firstYear: Math.min(...years),
    lastYear: Math.max(...years),
    traditions: dataset.traditions.length,
    sources: dataset.sources.length,
    snapshotMaxAge: dataset.snapshotMaxAge,
    inputs: inputs.map(({ path, hash }) => ({ path, sha256: hash })),
    policy:
      'Only reviewed source populations and geographic scopes. Numeric majority >50%; other religious shares >=20% are substantial. Historical qualitative claims retain their source wording without fabricated percentages. Latest prior snapshots remain explicitly dated, within the declared reference window. Missing or conflicting observations are not interpolated.',
  };
  const artifacts = {
    'public/data/religions/coverage.json': render(dataset),
    'public/data/religions/coverage-report.json': render(report),
  };
  const check = process.argv.includes('--check');
  if (!check) await mkdir(new URL('public/data/religions/', root), { recursive: true });
  for (const [path, body] of Object.entries(artifacts)) {
    const url = new URL(path, root);
    if (check) {
      if ((await readFile(url, 'utf8')) !== body)
        throw new Error(`Stale religion coverage artifact: ${path}`);
    } else await writeFile(url, body);
  }
  console.log(
    `Religion coverage ${check ? 'verified' : 'published'}: ${report.regions} regions, ${report.snapshots} snapshots, ${report.intervals} historical intervals.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
