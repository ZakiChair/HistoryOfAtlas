import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { DIRTY_SUFFIX, commitLabel, gitHead } from './bundle-report.mjs';

/**
 * Gzip budget for the JavaScript a modern browser downloads to boot the exported HTML shell.
 * Legacy `noModule` polyfills are reported separately: module-capable browsers never fetch them.
 * Temporary ceiling while the current wave lands; lower it to measured shell + ~5 %.
 */
const SHELL_BUDGET_BYTES = 274_000;

const REPORT = 'data/reports/bundle.json';
const SCHEMA_VERSION = 2;
const writeReport = Boolean(process.env.CI) || process.argv.includes('--write');

const html = await readFile('out/index.html', 'utf8');
const scriptPath = (tag) => /\s(?:src|href)="([^"]+\.js)"/i.exec(tag)?.[1];
// React serialises the attribute as `noModule=""`; HTML attributes are case-insensitive.
const legacyPaths = new Set(
  [...html.matchAll(/<script\b[^>]*>/gi)]
    .map(([tag]) => (/\snomodule\b/i.test(tag) ? scriptPath(tag) : undefined))
    .filter(Boolean),
);
const referenced = new Set(
  [...html.matchAll(/<(?:script|link)\b[^>]*>/gi)].map(([tag]) => scriptPath(tag)).filter(Boolean),
);
const measure = async (path) => {
  const content = await readFile(`out${path}`);
  return { path, bytes: content.length, gzipBytes: gzipSync(content).length };
};
const byGzip = (a, b) => b.gzipBytes - a.gzipBytes || a.path.localeCompare(b.path);
const assets = (
  await Promise.all([...referenced].filter((path) => !legacyPaths.has(path)).map(measure))
).sort(byGzip);
const legacyPolyfills = (await Promise.all([...legacyPaths].map(measure))).sort(byGzip);
const sum = (list) => list.reduce((total, asset) => total + asset.gzipBytes, 0);
const initialGzipBytes = sum(assets);

const report = {
  schemaVersion: SCHEMA_VERSION,
  method:
    'Unique script and script-preload URLs in the exported index.html, excluding legacy noModule polyfills that module-capable browsers never download; gzip default level. This measures the HTML shell, not the total JavaScript required for an interactive map. Browser network audits measure the deferred map and worker separately.',
  // CI checks out a clean commit; a local run names HEAD, marked `-dirty` for uncommitted changes.
  codeCommit: process.env.GITHUB_SHA || gitHead(),
  initialGzipBytes,
  budgetBytes: SHELL_BUDGET_BYTES,
  shellBudgetMet: initialGzipBytes <= SHELL_BUDGET_BYTES,
  legacyPolyfillGzipBytes: sum(legacyPolyfills),
  assets,
  legacyPolyfills,
};

// The committed report is the baseline. Reports before schema 2 counted the polyfill in the shell.
let baseline = null;
try {
  const previous = JSON.parse(await readFile(REPORT, 'utf8'));
  if (previous.schemaVersion === SCHEMA_VERSION) baseline = previous;
} catch {
  // No readable baseline: the summary reports absolute values only.
}

const kb = (bytes) => `${(bytes / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} kB`;
const signed = (bytes) => `${bytes > 0 ? '+' : bytes < 0 ? '−' : '±'}${kb(Math.abs(bytes))}`;
const verdict = report.shellBudgetMet ? 'within' : '**over**';
const baselineAssets = new Map((baseline?.assets ?? []).map((asset) => [asset.path, asset]));
const summary = [
  '### Initial JavaScript shell',
  '',
  `**${kb(initialGzipBytes)}** gzip, ${verdict} the ${kb(SHELL_BUDGET_BYTES)} budget` +
    ` (headroom ${signed(SHELL_BUDGET_BYTES - initialGzipBytes)}).`,
  baseline
    ? `Change against the committed report (${commitLabel(baseline.codeCommit)}): ${signed(initialGzipBytes - baseline.initialGzipBytes)}.`
    : 'No comparable committed report: the change against the baseline is not shown.',
  `Legacy noModule polyfills, excluded from the budget: ${kb(report.legacyPolyfillGzipBytes)} gzip.`,
  '',
  '| Chunk | Raw | Gzip | Change |',
  '| --- | ---: | ---: | ---: |',
  ...assets.map((asset) => {
    const before = baselineAssets.get(asset.path);
    const change = !baseline ? '' : before ? signed(asset.gzipBytes - before.gzipBytes) : 'new';
    return `| \`${asset.path.replace('/_next/static/chunks/', '')}\` | ${kb(asset.bytes)} | ${kb(asset.gzipBytes)} | ${change} |`;
  }),
  ...legacyPolyfills.map(
    (asset) =>
      `| \`${asset.path.replace('/_next/static/chunks/', '')}\` (noModule, excluded) | ${kb(asset.bytes)} | ${kb(asset.gzipBytes)} | |`,
  ),
  '',
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
if (writeReport) {
  await mkdir('data/reports', { recursive: true });
  await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(
  `Initial shell: ${initialGzipBytes.toLocaleString('en-US')} bytes gzip of ${SHELL_BUDGET_BYTES.toLocaleString('en-US')} ` +
    `(map and worker deferred; ${report.legacyPolyfillGzipBytes.toLocaleString('en-US')} bytes of noModule polyfills excluded).`,
);
if (!writeReport) console.log(`${REPORT} left unchanged outside CI (pass --write to update it).`);
else if (report.codeCommit?.endsWith(DIRTY_SUFFIX))
  console.warn(
    `${REPORT} measures uncommitted changes (codeCommit ${report.codeCommit}): ` +
      'regenerate it after committing the code so it names the measured commit.',
  );
if (!report.shellBudgetMet) {
  console.error(
    `::error::Initial JavaScript shell exceeds its budget by ${kb(initialGzipBytes - SHELL_BUDGET_BYTES)}.`,
  );
  process.exitCode = 1;
}
