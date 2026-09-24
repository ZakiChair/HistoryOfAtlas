import { defineConfig, devices } from '@playwright/test';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
export const getGraphicsArguments = (mode = process.env.PLAYWRIGHT_GPU ?? 'software') =>
  mode === 'native'
    ? [
        '--enable-webgl',
        ...(process.platform === 'darwin' ? ['--use-gl=angle', '--use-angle=metal'] : []),
      ]
    : [
        '--enable-webgl',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ];
// Per-battle scene sweeps replay one browser scene per catalogued battle. Their assertions
// concern published data and the 3D scene, not the viewport, so they run on desktop only.
const DESKTOP_ONLY_BATTLE_SWEEPS =
  /battle-(?:catalogue-scenes|equipment-scenes|land-equipment|reviewed-metadata)\.spec\.ts$/;
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Source-backed map scenarios include several navigations on CI's software GPU.
  // Keep their functional waits separate from the explicit performance audits.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  // One retry absorbs a software-GPU hiccup; a shard stops early once a regression is clear.
  retries: process.env.CI ? 1 : 0,
  maxFailures: process.env.CI ? 10 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: getGraphicsArguments(),
        },
      },
    },
    {
      name: 'mobile-chromium',
      testIgnore: DESKTOP_ONLY_BATTLE_SWEEPS,
      use: {
        ...devices['Pixel 7'],
        launchOptions: {
          args: getGraphicsArguments(),
        },
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm preview',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
