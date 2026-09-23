import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ResourceDatasetSchema } from '../../lib/resources/types';
import { resourcesInPeriod, exploitedResourcesInPeriod } from '../../lib/resources/time';

const dataset = ResourceDatasetSchema.parse(
  JSON.parse(
    readFileSync(new URL('../../public/data/resources/sites.json', import.meta.url), 'utf8'),
  ),
);
const categories = new Set(dataset.sites.flatMap((site) => site.categories));
for (const category of ['oil', 'gas', 'coal', 'copper', 'gold', 'uranium', 'lithium'] as const) {
  if (!categories.has(category)) throw new Error(`No resource sites for ${category}`);
}
if (
  dataset.sites.length < 22000 ||
  categories.size < 45 ||
  new Set(dataset.sites.map((site) => site.country)).size < 150
)
  throw new Error('Unexpected resource coverage loss');
const minerals = dataset.sites.filter((site) =>
  site.categories.some((category) => !['oil', 'gas', 'coal'].includes(category)),
);
if (minerals.length < 1700 || new Set(minerals.map((site) => site.country)).size < 75)
  throw new Error('Unexpected mineral coverage loss');
for (const [category, minimum] of [
  ['gold', 400],
  ['copper', 200],
  ['uranium', 100],
  ['rare-earths', 700],
] as const)
  if (minerals.filter((site) => site.categories.includes(category)).length < minimum)
    throw new Error(`Unexpected coverage loss for ${category}`);
if (dataset.sites.filter((site) => site.country === 'Mali').length < 10)
  throw new Error('Missing reviewed Mali mines');
const current = exploitedResourcesInPeriod(dataset, 2026);
for (const [category, minimum] of [
  ['coal', 3000],
  ['copper', 80],
  ['gold', 180],
  ['lithium', 3],
  ['bauxite', 3],
  ['uranium', 20],
  ['rare-earths', 40],
  ['potash', 8],
  ['graphite', 1],
] as const)
  if (current.filter((site) => site.categories.includes(category)).length < minimum)
    throw new Error(`Unexpected 2026 coverage loss for ${category}`);
execFileSync('python3', ['pipeline/resources/modern-minerals-build.py', '--check'], {
  stdio: 'inherit',
});
execFileSync('python3', ['pipeline/resources/reported-production-build.py', '--check'], {
  stdio: 'inherit',
});
const known = resourcesInPeriod(dataset, 2026);
if (known.length !== dataset.sites.length)
  throw new Error('Every dated resource must be known by the source snapshot');
for (const [category, minimum] of [
  ['oil', 6400],
  ['gas', 7100],
] as const)
  if (known.filter((site) => site.categories.includes(category)).length < minimum)
    throw new Error(`Unexpected known-resource coverage loss for ${category}`);
for (const name of [
  'national-mining',
  'current-rare-earths',
  'current-us-mines',
  'sodir-discoveries',
  'mineral-occurrences',
])
  execFileSync('python3', [`pipeline/resources/${name}-build.py`, '--check'], {
    stdio: 'inherit',
  });
execFileSync('python3', ['pipeline/resources/mineral-occurrences-test.py'], { stdio: 'inherit' });
execFileSync('python3', ['pipeline/resources/boem-discoveries.py', '--check'], {
  stdio: 'inherit',
});
for (const name of ['national_mining', 'current_rare_earths', 'sodir_discoveries'])
  execFileSync(
    'python3',
    ['-m', 'unittest', 'discover', '-s', 'tests/unit', '-p', `test_${name}.py`],
    {
      stdio: 'inherit',
    },
  );
execFileSync(
  'python3',
  ['-m', 'unittest', 'discover', '-s', 'tests/unit', '-p', 'test_reported_production.py'],
  {
    stdio: 'inherit',
  },
);
const directory = new URL('./sources/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8')) as {
  files: { file: string; extractSha256: string }[];
};
for (const source of manifest.files) {
  const digest = createHash('sha256')
    .update(readFileSync(new URL(source.file, directory)))
    .digest('hex');
  if (digest !== source.extractSha256)
    throw new Error(`Source extract checksum mismatch: ${source.file}`);
}
console.log(
  `Verified ${dataset.sites.length.toLocaleString('en')} resource sites, ${categories.size} categories, ${dataset.sources.length} sources (offline).`,
);
