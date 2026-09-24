import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { ReligionDataset } from '../../lib/religions/types';

test('normal-motion playback preserves religious symbols and one geometry source', async ({
  page,
}, testInfo) => {
  const data = JSON.parse(
    readFileSync(new URL('../../public/data/religions/history.json', import.meta.url), 'utf8'),
  ) as ReligionDataset;
  const stage = data.milestones.find((item) => item.fromId && item.year > 100 && item.year < 1800)!;
  expect(stage).toBeTruthy();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  let geometryWrites = 0;
  const hidden: string[][] = [];
  await page.exposeFunction('religionGeometryWritten', () => {
    geometryWrites++;
  });
  await page.exposeFunction('religionLayersHidden', (ids: string[]) => hidden.push(ids));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args) {
        const worker = Reflect.construct(target, args) as Worker;
        worker.postMessage = new Proxy(worker.postMessage, {
          apply(target, receiver, args) {
            const message = args[0] as {
              type?: string;
              data?: {
                source?: string;
                data?: { type?: string };
                layers?: { id: string; layout?: { visibility?: string } }[];
              };
            };
            const callbacks = window as unknown as {
              religionGeometryWritten: () => Promise<void>;
              religionLayersHidden: (ids: string[]) => Promise<void>;
            };
            if (
              message.data?.source === 'religion-history' &&
              message.data.data?.type === 'FeatureCollection'
            )
              void callbacks.religionGeometryWritten();
            const hidden = message.data?.layers
              ?.filter(
                (layer) => layer.id.startsWith('religion-') && layer.layout?.visibility === 'none',
              )
              .map((layer) => layer.id);
            if (message.type === 'UL' && hidden?.length)
              void callbacks.religionLayersHidden(hidden);
            return Reflect.apply(target, receiver, args);
          },
        });
        return worker;
      },
    });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const query = new URLSearchParams({
    lang: 'en',
    y: String(stage.year - 2),
    religions: '1',
    religion: stage.traditionId,
    battles: '0',
    lon: String(stage.coordinates[0]),
    lat: String(stage.coordinates[1]),
    z: '3',
    speed: '100',
  });
  await page.goto(`/?${query}`);
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  const collapse = page.getByRole('button', { name: 'Collapse notebook', exact: true });
  if (await collapse.isVisible()) await collapse.click();
  await expect.poll(() => geometryWrites).toBe(1);
  await expect(page.getByTestId('religions-status')).toContainText('attested milestones');
  await page.getByTestId('timeline-play').click();
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('y')), { timeout: 20000 })
    .toBeGreaterThanOrEqual(stage.year + 2);
  await page.getByTestId('timeline-play').click();
  await expect(page.getByTestId('timeline-play')).toHaveAttribute('aria-label', 'Play timeline');
  const year = Number(new URL(page.url()).searchParams.get('y'));
  const count = data.milestones.filter(
    (item) => item.traditionId === stage.traditionId && item.year <= year,
  ).length;
  await expect(page.getByTestId('religions-status')).toContainText(`${count} attested milestones`);
  expect(geometryWrites).toBe(1);
  expect(hidden).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('religions-after-playback.png'),
    fullPage: true,
  });
});
