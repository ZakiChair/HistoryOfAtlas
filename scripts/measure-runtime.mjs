import { chromium } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const software = process.env.PLAYWRIGHT_GPU === 'software';
const args = software
  ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : process.platform === 'darwin'
    ? ['--use-gl=angle', '--use-angle=metal']
    : [];
const browser = await chromium.launch({ headless: true, args });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    reducedMotion: 'reduce',
  });
  const scripts = new Map();
  const captures = [];
  const transfers = [];
  const transferCaptures = [];
  let collecting = true;
  page.on('requestfinished', (request) => {
    if (!collecting) return;
    transferCaptures.push(
      request.sizes().then((sizes) => {
        const timing = request.timing();
        transfers.push({
          path: new URL(request.url()).pathname,
          kind: request.resourceType(),
          encodedBodyBytes: sizes.responseBodySize,
          finishedAt: timing.startTime + timing.responseEnd,
        });
      }),
    );
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin !== new URL(base).origin || !/\.(?:m?js)$/.test(url.pathname)) return;
    captures.push(
      response.body().then((body) => {
        scripts.set(url.pathname, {
          path: url.pathname,
          bytes: body.length,
          gzipBytes: gzipSync(body).length,
        });
      }),
    );
  });
  await page.addInitScript(() => {
    window.addEventListener('atlas:territories', (event) => {
      if (event.detail.length && !window.atlasMeasuredReady)
        window.atlasMeasuredReady = performance.now();
    });
  });
  if (process.argv.includes('--slow-4g')) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 1_638_400 / 8,
      uploadThroughput: 750_000 / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await page.goto(`${base}/?y=1812`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.atlasMeasuredReady > 0, null, { timeout: 60_000 });
  collecting = false;
  await Promise.all(captures);
  await Promise.all(transferCaptures);
  const environment = await page.evaluate(() => {
    const gl = document.querySelector('.maplibregl-canvas')?.getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      mapReadyMs: window.atlasMeasuredReady,
      mapReadyAt: performance.timeOrigin + window.atlasMeasuredReady,
      renderer: gl && extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unknown',
    };
  });
  const assets = [...scripts.values()].sort((a, b) => a.path.localeCompare(b.path));
  const gzipBytes = assets.reduce((sum, item) => sum + item.gzipBytes, 0);
  const manifestResponse = await page.request.get(`${base}/data/manifest.json`);
  if (!manifestResponse.ok()) throw new Error('Cannot identify the measured dataset');
  const manifest = await manifestResponse.json();
  const completedTransfers = transfers.filter(
    (entry) => entry.finishedAt <= environment.mapReadyAt,
  );
  const transferByKind = {};
  for (const entry of completedTransfers) {
    const kind = entry.path.endsWith('.pmtiles') ? 'pmtiles' : entry.kind;
    transferByKind[kind] = (transferByKind[kind] ?? 0) + entry.encodedBodyBytes;
  }
  const report = {
    method:
      'Unique JavaScript responses through first nonempty rendered territorial view; uncompressed response bodies recompressed with gzip. Includes shell, map module, PMTiles and workers. Intro disabled by explicit year URL, reduced motion enabled.',
    profile: process.argv.includes('--slow-4g')
      ? 'request throttling: 1.6384 Mbps down, 750 Kbps up, 150 ms latency, CPU x4'
      : 'local unthrottled',
    ...environment,
    origin: base,
    totalEvents: manifest.totalEvents,
    corpusBuiltAt: manifest.builtAt,
    mapReadyBudgetMs: 3000,
    mapReadyBudgetMet: environment.mapReadyMs < 3000,
    gzipBytes,
    interactiveJsBudgetBytes: 300_000,
    interactiveJsBudgetMet: gzipBytes < 300_000,
    completedResponseBodyBytes: completedTransfers.reduce(
      (sum, entry) => sum + entry.encodedBodyBytes,
      0,
    ),
    transferByKind,
    assets,
  };
  await mkdir('data/reports', { recursive: true });
  const name = process.argv.includes('--slow-4g') ? 'runtime-slow-4g' : 'runtime';
  await writeFile(`data/reports/${name}.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, assets: undefined }, null, 2));
} finally {
  await browser.close();
}
