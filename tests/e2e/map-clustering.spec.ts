import { expect, test } from '@playwright/test';
import type { HistoricalEvent } from '../../lib/schema';

type Probe = { queries: { ids: string[]; projection: string }[] };

test('globe clustering includes sourced visible points and remains correct in Mercator', async ({
  page,
  request,
}) => {
  // The source record reproduces a point omitted by MapLibre's whole-globe rectangle query.
  const response = await request.get('/data/events/Q52226.json');
  expect(response.ok()).toBe(true);
  const event: HistoricalEvent = await response.json();
  expect(event.sources.length).toBeGreaterThan(0);
  expect(event.coords).toBeTruthy();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const probe: Probe = { queries: [] };
    (window as unknown as { clusterProbe: Probe }).clusterProbe = probe;
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, argumentsList) {
        const worker = Reflect.construct(target, argumentsList) as Worker;
        worker.postMessage = new Proxy(worker.postMessage, {
          apply(target, receiver, argumentsList) {
            const message = argumentsList[0] as { points?: { id: string }[] } | undefined;
            if (Array.isArray(message?.points))
              probe.queries.push({
                ids: message.points.map((point) => point.id),
                projection: new URL(location.href).searchParams.get('projection') ?? 'globe',
              });
            return Reflect.apply(target, receiver, argumentsList);
          },
        });
        return worker;
      },
    });
  });
  await page.goto('/?lang=fr&y=1812&z=1.8&lon=18&lat=32&from=1700&to=2000');
  const includesSource = () =>
    page.evaluate((id) => {
      const { queries } = (window as unknown as { clusterProbe: Probe }).clusterProbe;
      return queries.at(-1)?.ids.includes(id) ?? false;
    }, event.id);
  await expect.poll(includesSource, { timeout: 60_000 }).toBe(true);
  const firstQueries = await page.evaluate(
    () => (window as unknown as { clusterProbe: Probe }).clusterProbe.queries.length,
  );
  await page.getByRole('button', { name: 'Carte plane', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('projection')).toBe('mercator');
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { clusterProbe: Probe }).clusterProbe.queries.length,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(firstQueries);
  await expect.poll(includesSource).toBe(true);
  const mercatorQueries = await page.evaluate(
    () => (window as unknown as { clusterProbe: Probe }).clusterProbe.queries.length,
  );
  await page.getByRole('button', { name: 'Globe', exact: true }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { clusterProbe: Probe }).clusterProbe.queries.length,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(mercatorQueries);
  await expect.poll(includesSource).toBe(true);
});
