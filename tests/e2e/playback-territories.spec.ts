import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { parseHistoricalYear } from '../../lib/histdate';
import type { Map as HistoricalMap } from 'maplibre-gl';

type Shard = { start: number; end: number; url: string };
type RenderSample = {
  year: number;
  time: number;
  expectedSource: string;
  currentRecords: string[];
  visibleSources: string[];
};
type PlaybackProbe = {
  samples: RenderSample[];
  publications: { year: number; ids: string[] }[];
  stop: () => void;
};

const scenarios = [
  {
    name: '1800 and 1900 eras on the globe',
    start: 1785,
    end: 1945,
    crossings: [1800, 1850, 1900],
    projection: 'globe',
    reduced: false,
  },
  {
    name: '1492 era in Mercator with reduced motion',
    start: 1485,
    end: 1540,
    crossings: [1500],
    projection: 'mercator',
    reduced: true,
  },
  {
    name: 'astronomical zero on the globe',
    start: -20,
    end: 70,
    crossings: [1],
    projection: 'globe',
    reduced: true,
  },
] as const;

for (const scenario of scenarios) {
  test(`autoplay renders current territories across ${scenario.name}`, async ({
    page,
    request,
  }, testInfo) => {
    // Playback waits for real rendered tiles. Software GPUs may take much longer
    // than the nominal speed; correctness must still hold within every archive.
    test.setTimeout(180_000);
    const geo: { temporal: { shards: Shard[] } } = await (
      await request.get('/geo/manifest.json')
    ).json();
    const crossings = geo.temporal.shards.filter((shard) =>
      (scenario.crossings as readonly number[]).includes(shard.start),
    );
    expect(crossings.map((shard) => shard.start)).toEqual(scenario.crossings);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: scenario.reduced ? 'reduce' : 'no-preference' });
    await page.goto(
      `/?y=${scenario.start}&z=2.5&lon=12&lat=35&speed=100&lang=en&projection=${scenario.projection}`,
    );
    await expect(page.locator('.world-map-wrap')).toHaveAttribute('data-ready', 'true');

    // Read the existing map ref without exporting a production debug API or mutating
    // the application. A moving slider and requestAnimationFrame are insufficient:
    // workers can reload forever while the canvas retains an earlier century.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            type Hook = { memoizedState?: { current?: HistoricalMap }; next?: Hook };
            type Fiber = { memoizedState?: Hook; return?: Fiber };
            const element = document.querySelector('.world-map');
            if (!element) return false;
            const key = Object.keys(element).find((key) => key.startsWith('__reactFiber'));
            if (!key) return false;
            let fiber = (element as unknown as Record<string, Fiber>)[key];
            for (; fiber; fiber = fiber.return!) {
              for (let hook = fiber.memoizedState; hook; hook = hook.next) {
                const map = hook.memoizedState?.current;
                if (map && typeof map.getStyle === 'function' && typeof map.loaded === 'function') {
                  (window as unknown as { playbackMap: HistoricalMap }).playbackMap = map;
                  return map.loaded() && Boolean(map.getSource('events'));
                }
              }
            }
            return false;
          }),
        { timeout: 30_000 },
      )
      .toBe(true);

    await page.evaluate((shards: Shard[]) => {
      const map = (window as unknown as { playbackMap: HistoricalMap }).playbackMap;
      const probe: PlaybackProbe = { samples: [], publications: [], stop: () => undefined };
      (window as unknown as { playbackProbe: PlaybackProbe }).playbackProbe = probe;
      const year = () => {
        const label =
          document.querySelector('[data-testid="year-slider"]')?.getAttribute('aria-valuetext') ??
          '';
        const numeric = Number(label.match(/\d+/)?.[0]);
        return label.includes('BCE') ? 1 - numeric : numeric;
      };
      let lastSample = -Infinity;
      const sample = () => {
        const now = performance.now();
        if (now - lastSample < 180) return;
        lastSample = now;
        const currentYear = year();
        const shard = shards.find(
          (shard) => shard.start <= currentYear && shard.end >= currentYear,
        );
        if (!shard) return;
        const layers = (map.getStyle().layers ?? [])
          .filter(
            (layer) =>
              layer.type === 'fill' &&
              layer.id.startsWith('territory-') &&
              layer.id.endsWith('-fill') &&
              map.getLayoutProperty(layer.id, 'visibility') !== 'none' &&
              Number(map.getPaintProperty(layer.id, 'fill-opacity')) > 0,
          )
          .map((layer) => layer.id);
        const records = new Set<string>();
        const visibleSources = new Set<string>();
        const expectedSource = `territory-${shard.start}`;
        const container = map.getContainer();
        // Globe queries need screen subdivisions; the full viewport rectangle can
        // miss curved portions of the globe in MapLibre. Only query after rendering.
        for (let x = 0; x < container.clientWidth; x += 256) {
          for (let y = 0; y < container.clientHeight; y += 256) {
            const features = map.queryRenderedFeatures(
              [
                [x, y],
                [
                  Math.min(x + 256, container.clientWidth),
                  Math.min(y + 256, container.clientHeight),
                ],
              ],
              { layers },
            );
            for (const feature of features) {
              visibleSources.add(feature.source);
              const properties = feature.properties;
              if (
                feature.source === expectedSource &&
                Number(properties.fromYear) <= currentYear &&
                Number(properties.toYear) >= currentYear
              )
                records.add(String(properties.id));
            }
          }
        }
        probe.samples.push({
          time: now,
          year: currentYear,
          expectedSource,
          currentRecords: [...records].sort(),
          visibleSources: [...visibleSources].sort(),
        });
      };
      const publication = (event: Event) => {
        const territories = (event as CustomEvent<{ id: string }[]>).detail;
        probe.publications.push({ year: year(), ids: territories.map((item) => item.id).sort() });
      };
      map.on('render', sample);
      window.addEventListener('atlas:territories', publication);
      probe.stop = () => {
        map.off('render', sample);
        window.removeEventListener('atlas:territories', publication);
      };
      sample();
    }, geo.temporal.shards);

    await page.getByTestId('timeline-play').click();
    await expect
      .poll(
        async () =>
          parseHistoricalYear(
            (await page.getByTestId('year-slider').getAttribute('aria-valuetext')) ?? '',
          ),
        { timeout: 150_000 },
      )
      .toBeGreaterThanOrEqual(scenario.end);
    // Capture the evidence before stopping. A map that catches up only after pause
    // must fail even though its final static view is correct.
    const evidence = await page.evaluate(() => {
      const probe = (window as unknown as { playbackProbe: PlaybackProbe }).playbackProbe;
      probe.stop();
      return { samples: probe.samples, publications: probe.publications };
    });
    await page.getByTestId('timeline-play').click();
    const evidencePath = testInfo.outputPath('territories-during-playback.json');
    await writeFile(evidencePath, JSON.stringify({ scenario, ...evidence, errors }, null, 2));
    await testInfo.attach('territories-during-playback', {
      path: evidencePath,
      contentType: 'application/json',
    });
    expect(errors).toEqual([]);
    for (const shard of crossings) {
      const samples = evidence.samples.filter(
        (sample) => sample.year >= shard.start && sample.year <= shard.end,
      );
      expect(samples.length, `Playback must actually cross archive ${shard.start}`).toBeGreaterThan(
        0,
      );
      expect
        .soft(
          samples.some((sample) => sample.currentRecords.length > 0),
          `Archive ${shard.start}: current sourced polygons must render while playing; observed ${JSON.stringify(
            samples.map(({ year, visibleSources }) => ({ year, visibleSources })),
          )}`,
        )
        .toBe(true);
    }
    expect
      .soft(
        evidence.publications.some(
          (publication) =>
            publication.year >= scenario.crossings.at(-1)! && publication.ids.length > 0,
        ),
        'The visible territory list must refresh during playback rather than waiting for idle after pause',
      )
      .toBe(true);
  });
}
