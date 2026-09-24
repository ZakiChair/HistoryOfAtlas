import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import type { StyleSpecification } from 'maplibre-gl';
import { HEAT_COLOR, HEAT_COLOR_STOPS, HEAT_RADIUS } from '../../components/map/heat-style';

const require = createRequire(import.meta.url);
const mapRequire = createRequire(require.resolve('maplibre-gl/package.json'));
const { validateStyleMin } = mapRequire('@maplibre/maplibre-gl-style-spec') as {
  validateStyleMin: (style: StyleSpecification) => { message: string }[];
};

/** CIE L* of an sRGB hex colour. */
function lightness(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const f = y > 216 / 24389 ? Math.cbrt(y) : ((24389 / 27) * y + 16) / 116;
  return 116 * f - 16;
}

describe('event heatmap style', () => {
  it('uses a ramp whose lightness rises with density', () => {
    const values = HEAT_COLOR_STOPS.map(([, color]) => lightness(color));
    for (let index = 1; index < values.length; index++)
      expect(values[index]).toBeGreaterThan(values[index - 1]!);
    const densities = HEAT_COLOR_STOPS.map(([density]) => density);
    expect(densities).toEqual([...densities].sort((a, b) => a - b));
    expect(densities.at(-1)).toBe(1);
  });

  it('widens the kernel from 12 px on the world view to 40 px at regional zooms', () => {
    expect(HEAT_RADIUS).toEqual(['interpolate', ['linear'], ['zoom'], 1, 12, 6, 40]);
    expect(
      validateStyleMin({
        version: 8,
        sources: { events: { type: 'vector', tiles: ['https://example.org/{z}/{x}/{y}.pbf'] } },
        layers: [
          {
            id: 'event-heat',
            type: 'heatmap',
            source: 'events',
            'source-layer': 'events',
            paint: { 'heatmap-radius': HEAT_RADIUS, 'heatmap-color': HEAT_COLOR },
          },
        ],
      }).map((error) => error.message),
    ).toEqual([]);
  });

  it('hides its key under an open dossier or phone notebook, and the compass under the key', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8').replace(
      /\s+/g,
      ' ',
    );
    // Dossiers sit at z-index 12 over right 85–437px; the key spans right 25–215px.
    expect(css).toContain('.detail-is-open .density-key { display: none; }');
    // The compass (right 30px, 50px wide) falls inside the key's box, but not under a dossier.
    expect(css).toContain(
      '.atlas-app:not(.detail-is-open):has(.density-key) .world-compass { display: none; }',
    );
    const phone = css.slice(css.indexOf('@media (max-width: 580px) { .density-key {'));
    expect(phone.slice(0, phone.indexOf('} }') + 3)).toContain(
      '.sidebar-is-open .density-key { display: none; }',
    );
  });
});
