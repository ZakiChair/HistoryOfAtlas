import { expect, test } from '@playwright/test';
import type { Campaign } from '../../lib/schema';

type CampaignRenderProbe = { contexts: number; instances: number[] };

test('campaign steps reuse one GPU context and draw the updated steps', async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const probe: CampaignRenderProbe = { contexts: 0, instances: [] };
    (window as unknown as { campaignRenderProbe: CampaignRenderProbe }).campaignRenderProbe = probe;
    const contexts = new WeakSet<object>();
    const nativeContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = new Proxy(nativeContext, {
      apply(target, receiver: HTMLCanvasElement, args) {
        const context = Reflect.apply(target, receiver, args);
        if (
          context &&
          String(args[0]).startsWith('webgl') &&
          !receiver.classList.contains('maplibregl-canvas') &&
          !contexts.has(context)
        ) {
          contexts.add(context);
          probe.contexts++;
        }
        return context;
      },
    });
    for (const name of ['drawArraysInstanced', 'drawElementsInstanced'] as const) {
      const original = WebGL2RenderingContext.prototype[name];
      Object.defineProperty(WebGL2RenderingContext.prototype, name, {
        value: new Proxy(original, {
          apply(target, receiver: WebGL2RenderingContext, args) {
            const result = Reflect.apply(target, receiver, args);
            if (contexts.has(receiver)) {
              const instances = Number(args[name === 'drawArraysInstanced' ? 3 : 4]);
              if (!probe.instances.includes(instances)) probe.instances.push(instances);
            }
            return result;
          },
        }),
      });
    }
  });
  const campaigns: Campaign[] = await (await request.get('/data/campaigns.json')).json();
  const campaign = campaigns.find((candidate) => candidate.steps.length >= 3)!;
  expect(campaign).toBeTruthy();
  await page.goto(
    `/?lang=fr&campaign=${campaign.id}&step=0&y=${campaign.steps[0].date.year}&projection=mercator`,
  );
  const rendered = (count: number) =>
    page.evaluate((expected) => {
      const probe = (window as unknown as { campaignRenderProbe: CampaignRenderProbe })
        .campaignRenderProbe;
      return probe.instances.includes(expected);
    }, count);
  await expect.poll(() => rendered(1), { timeout: 30_000 }).toBe(true);
  for (const step of [1, 2]) {
    await page
      .locator('.campaign-controls')
      .getByRole('button', { name: 'Étape suivante', exact: true })
      .click();
    await expect.poll(() => new URL(page.url()).searchParams.get('step')).toBe(String(step));
    await expect.poll(() => rendered(step + 1), { timeout: 30_000 }).toBe(true);
  }
  const contexts = await page.evaluate(
    () =>
      (window as unknown as { campaignRenderProbe: CampaignRenderProbe }).campaignRenderProbe
        .contexts,
  );
  expect(
    contexts,
    'Stepping must update the existing renderer instead of allocating another GPU buffer',
  ).toBe(1);
});
