import { defineConfig } from '@playwright/test';
import functionalConfig, { getGraphicsArguments } from './playwright.config';

export default defineConfig({
  ...functionalConfig,
  testDir: './tests/performance',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'test-results/performance',
  reporter: [['list'], ['html', { outputFolder: 'performance-report', open: 'never' }]],
  projects: functionalConfig.projects?.map((project) => ({
    ...project,
    use: {
      ...project.use,
      launchOptions: {
        ...project.use?.launchOptions,
        args: getGraphicsArguments(process.env.PLAYWRIGHT_GPU ?? 'native'),
      },
    },
  })),
});
