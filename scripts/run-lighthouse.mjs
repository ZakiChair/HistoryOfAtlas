import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve('@lhci/cli/package.json')), 'src/cli.js');
const software = process.env.PLAYWRIGHT_GPU === 'software';
const flags = software
  ? '--enable-webgl --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader'
  : process.platform === 'darwin'
    ? '--enable-webgl --use-gl=angle --use-angle=metal'
    : '--enable-webgl';
const args = [cli, 'autorun', `--collect.settings.chromeFlags=${flags}`];
if (process.env.PLAYWRIGHT_BASE_URL) {
  const origin = process.env.PLAYWRIGHT_BASE_URL.replace(/\/$/, '');
  args.push(
    `--collect.url=${origin}/`,
    `--collect.url=${origin}/about/`,
    '--collect.startServerCommand=',
  );
}
const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env: { ...process.env, CHROME_PATH: chromium.executablePath() },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
