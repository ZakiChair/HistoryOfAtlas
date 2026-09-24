import { appendFile, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

/**
 * First-load data budgets: the JSON each map layer downloads before it can draw anything.
 * Sizes are gzip at the default level, as a stand-in for the CDN transfer.
 * Warn-only while the light layer indexes are built; pass --strict to fail on an overrun.
 * Battles and resources carry the target budgets from the roadmap. The other layers hold
 * their measured size + 5 %, so that growth is noticed.
 */
const LAYERS = [
  {
    label: 'Atlas shell (data and geography manifests)',
    files: ['data/manifest.json', 'geo/manifest.json'],
    budgetGzipBytes: 21_000,
  },
  {
    label: 'Battles (catalogue index)',
    files: ['data/battles/index.json'],
    budgetGzipBytes: 300_000,
  },
  {
    label: 'Strategic resources (site index)',
    files: ['data/resources/sites.json'],
    budgetGzipBytes: 350_000,
  },
  {
    label: 'Religions (dated history)',
    files: ['data/religions/history.json'],
    // 131 milestones after the 24 September 2026 data wave (45.9 kB) plus room for growth.
    budgetGzipBytes: 52_000,
  },
];

const strict = process.argv.includes('--strict');
const annotate = Boolean(process.env.GITHUB_ACTIONS);

const measureFile = async (file) => {
  try {
    const content = await readFile(`public/${file}`);
    return { file, bytes: content.length, gzipBytes: gzipSync(content).length };
  } catch {
    return { file, missing: true, bytes: 0, gzipBytes: 0 };
  }
};
const layers = [];
for (const layer of LAYERS) {
  const files = await Promise.all(layer.files.map(measureFile));
  const gzipBytes = files.reduce((total, file) => total + file.gzipBytes, 0);
  const missing = files.filter((file) => file.missing).map((file) => file.file);
  layers.push({ ...layer, files, gzipBytes, missing, over: gzipBytes > layer.budgetGzipBytes });
}

const kb = (bytes) => `${(bytes / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} kB`;
const problems = [];
for (const layer of layers) {
  const status = layer.missing.length ? 'MISSING' : layer.over ? 'OVER' : 'ok';
  console.log(
    `${status.padEnd(7)} ${layer.label}: ${kb(layer.gzipBytes)} gzip / ${kb(layer.budgetGzipBytes)}`,
  );
  for (const file of layer.files)
    if (!file.missing)
      console.log(`          /${file.file}: ${kb(file.bytes)} raw, ${kb(file.gzipBytes)} gzip`);
  if (layer.missing.length)
    problems.push(`${layer.label}: missing ${layer.missing.map((file) => `/${file}`).join(', ')}`);
  else if (layer.over)
    problems.push(
      `${layer.label}: ${kb(layer.gzipBytes)} gzip exceeds its ${kb(layer.budgetGzipBytes)} first-load budget`,
    );
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    '### First-load data per layer',
    '',
    strict ? 'Budgets are enforced.' : 'Budgets only warn for now; they do not fail the job.',
    '',
    '| Layer | Files | Raw | Gzip | Budget | Status |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    ...layers.map((layer) => {
      const raw = layer.files.reduce((total, file) => total + file.bytes, 0);
      const status = layer.missing.length
        ? 'missing file'
        : layer.over
          ? `over by ${kb(layer.gzipBytes - layer.budgetGzipBytes)}`
          : 'within';
      const files = layer.files.map((file) => `\`/${file.file}\``).join('<br>');
      return `| ${layer.label} | ${files} | ${kb(raw)} | ${kb(layer.gzipBytes)} | ${kb(layer.budgetGzipBytes)} | ${status} |`;
    }),
    '',
  ].join('\n');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
}

for (const problem of problems)
  if (annotate) console.log(`::${strict ? 'error' : 'warning'} title=Data budget::${problem}`);
if (problems.length && strict) process.exitCode = 1;
else if (problems.length) console.log(`${problems.length} data budget warning(s); not enforced.`);
