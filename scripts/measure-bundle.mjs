import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const html = await readFile('out/index.html', 'utf8');
const paths = [
  ...new Set([...html.matchAll(/(?:src|href)="([^\"]+\.js)"/g)].map((match) => match[1])),
];
const assets = await Promise.all(
  paths.map(async (path) => {
    const content = await readFile(`out${path}`);
    return { path, bytes: content.length, gzipBytes: gzipSync(content).length };
  }),
);
const initialGzipBytes = assets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
const report = {
  method:
    'Unique script and preload URLs in exported index.html; gzip default level. This measures the HTML shell, not the total JavaScript required for an interactive map. Browser network audits measure the deferred map and worker separately.',
  initialGzipBytes,
  budgetBytes: 300_000,
  shellBudgetMet: initialGzipBytes < 300_000,
  assets,
};
await mkdir('data/reports', { recursive: true });
await writeFile('data/reports/bundle.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `Initial shell: ${initialGzipBytes.toLocaleString()} bytes gzip (map and worker deferred).`,
);
if (!report.shellBudgetMet) process.exitCode = 1;
