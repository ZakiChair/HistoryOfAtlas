import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('timeline playback maintains a measured 30 fps in this browser', async ({
  page,
  request,
}, testInfo) => {
  const manifest = await (await request.get('/data/manifest.json')).json();
  await page.goto('/?lang=fr&y=1800&lon=15&lat=40&z=2');
  await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: /100 ans par seconde$/ }).click();
  await page.getByTestId('timeline-play').click();
  const measurement = await page.evaluate(async () => {
    const canvas = document.querySelector<HTMLCanvasElement>('.maplibregl-canvas');
    const gl = canvas?.getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer =
      gl && extension ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : 'not exposed';
    const intervals: number[] = [];
    let previous = performance.now();
    const started = previous;
    await new Promise<void>((resolve) => {
      const measure = (time: number) => {
        intervals.push(time - previous);
        previous = time;
        if (time - started >= 6000) resolve();
        else requestAnimationFrame(measure);
      };
      requestAnimationFrame(measure);
    });
    const ordered = intervals.slice(2).sort((a, b) => a - b);
    return {
      renderer,
      frames: ordered.length,
      averageFps: 1000 / (ordered.reduce((a, b) => a + b, 0) / ordered.length),
      p95FrameMs: ordered[Math.floor(ordered.length * 0.95)],
    };
  });
  await page.getByTestId('timeline-play').click();
  const lastDisplayedYear = await page.getByTestId('year-slider').getAttribute('aria-valuetext');
  await testInfo.attach('frame-measurement', {
    body: JSON.stringify(
      {
        ...measurement,
        totalEvents: manifest.totalEvents,
        corpusBuiltAt: manifest.builtAt,
        firstYear: 1800,
        lastDisplayedYear,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(Number(lastDisplayedYear)).toBeGreaterThan(1800);
  expect(measurement.averageFps).toBeGreaterThanOrEqual(30);
  expect(measurement.p95FrameMs).toBeLessThanOrEqual(1000 / 30 + 0.5);
});
