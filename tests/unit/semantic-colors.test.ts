import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BATTLE_MODE_COLORS,
  EVENT_COLOR_EXPRESSION,
  EVENT_GROUP_COLORS,
  EVENT_TYPE_COLORS,
  SELECTION_COLORS,
  hexToRgb,
} from '../../lib/colors/semantic';
import { RESOURCE_COLORS } from '../../lib/resources/colors';
import { EVENT_TYPES } from '../../lib/types';
import { warTrackColor } from '../../lib/war-tracks';

type Lab = [number, number, number];

/** sRGB (D65) to CIELAB, as in cartography/deltae.py. */
function lab(hex: string): Lab {
  const [x, y, z] = (() => {
    const [r, g, b] = hexToRgb(hex).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }) as Lab;
    return [
      (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047,
      0.2126 * r + 0.7152 * g + 0.0722 * b,
      (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883,
    ];
  })();
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const hue = (b: number, a: number) => {
  if (a === 0 && b === 0) return 0;
  const angle = (Math.atan2(b, a) * 180) / Math.PI;
  return angle < 0 ? angle + 360 : angle;
};

/** CIEDE2000 colour difference (Sharma, Wu and Dalal, 2005). */
function deltaE2000Lab([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const meanC = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(meanC ** 7 / (meanC ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = h2p - h1p;
  if (C1p * C2p === 0) dhp = 0;
  else if (dhp > 180) dhp -= 360;
  else if (dhp < -180) dhp += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(radians(dhp / 2));
  const meanL = (L1 + L2) / 2;
  const meanCp = (C1p + C2p) / 2;
  let meanHp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) meanHp /= 2;
    else meanHp = meanHp < 360 ? (meanHp + 360) / 2 : (meanHp - 360) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos(radians(meanHp - 30)) +
    0.24 * Math.cos(radians(2 * meanHp)) +
    0.32 * Math.cos(radians(3 * meanHp + 6)) -
    0.2 * Math.cos(radians(4 * meanHp - 63));
  const dTheta = 30 * Math.exp(-(((meanHp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(meanCp ** 7 / (meanCp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (meanL - 50) ** 2) / Math.sqrt(20 + (meanL - 50) ** 2);
  const SC = 1 + 0.045 * meanCp;
  const SH = 1 + 0.015 * meanCp * T;
  const RT = -Math.sin(radians(2 * dTheta)) * RC;
  return Math.sqrt(
    (dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH),
  );
}

const deltaE2000 = (first: string, second: string) => deltaE2000Lab(lab(first), lab(second));

const religions = (
  JSON.parse(readFileSync(join(process.cwd(), 'public/data/religions/history.json'), 'utf8')) as {
    traditions: { id: string; color: string }[];
  }
).traditions;

const layers: Record<string, Record<string, string>> = {
  events: {
    ...EVENT_TYPE_COLORS,
    'group ring': EVENT_GROUP_COLORS.ring,
    '3D documented': BATTLE_MODE_COLORS.documented,
    '3D undocumented': BATTLE_MODE_COLORS.undocumented,
  },
  resources: RESOURCE_COLORS,
  religions: Object.fromEntries(religions.map((item) => [item.id, item.color])),
  selection: SELECTION_COLORS,
  // Sampled along the ramp, since every shade in between is drawn too (legs, arrows, points).
  tracks: Object.fromEntries(
    Array.from({ length: 11 }, (_, step) => [
      `ramp ${(step / 10).toFixed(1)}`,
      `#${warTrackColor(step / 10)
        .slice(0, 3)
        .map((channel) => channel.toString(16).padStart(2, '0'))
        .join('')}`,
    ]),
  ),
};

describe('one colour family per map layer', () => {
  it('matches the published CIEDE2000 test pairs', () => {
    const pairs: [Lab, Lab, number][] = [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
      [[50, 0, 0], [50, -1, 2], 2.3669],
      [[50, 2.5, 0], [73, 25, -18], 27.1492],
      [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    ];
    for (const [first, second, expected] of pairs) {
      expect(deltaE2000Lab(first, second)).toBeCloseTo(expected, 4);
      expect(deltaE2000Lab(second, first)).toBeCloseTo(expected, 4);
    }
    expect(deltaE2000('#000000', '#ffffff')).toBeCloseTo(100, 0);
    // The collision this palette removes: the former battle colour against oil.
    expect(deltaE2000('#e7bd78', '#e8bb74')).toBeLessThan(1);
  });

  it('keeps colours of different layers at least ΔE2000 10 apart', () => {
    const close: string[] = [];
    const names = Object.keys(layers);
    for (const [index, first] of names.entries())
      for (const second of names.slice(index + 1))
        for (const [a, colorA] of Object.entries(layers[first]!))
          for (const [b, colorB] of Object.entries(layers[second]!)) {
            const distance = deltaE2000(colorA, colorB);
            if (distance < 10)
              close.push(
                `${first}.${a} ${colorA} ~ ${second}.${b} ${colorB}: ${distance.toFixed(1)}`,
              );
          }
    expect(close).toEqual([]);
  });

  it('colours every event type and draws unknown types as battles', () => {
    expect(Object.keys(EVENT_TYPE_COLORS).sort()).toEqual([...EVENT_TYPES].sort());
    const expression = EVENT_COLOR_EXPRESSION as unknown as unknown[];
    expect(expression.slice(0, 2)).toEqual(['match', ['get', 'type']]);
    for (const type of EVENT_TYPES)
      expect(expression[expression.indexOf(type) + 1]).toBe(EVENT_TYPE_COLORS[type]);
    expect(expression.at(-1)).toBe(EVENT_TYPE_COLORS.battle);
    for (const color of Object.values(layers).flatMap((layer) => Object.values(layer)))
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('keeps event list icons neutral, the map dot carrying the type colour', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
    // The former per-type overrides drew naval in cyan, siege in olive and the rest in amber.
    expect(css).not.toMatch(/\.type-(naval|siege)\b/);
    const icon = css.slice(css.indexOf('\n.event-type-icon {'));
    expect(icon.slice(0, icon.indexOf('}'))).toContain('color: var(--muted);');
    const list = readFileSync(join(process.cwd(), 'components/panels/EventList.tsx'), 'utf8');
    expect(list).toContain('<EventSwatch type={event.type} />');
    expect(list).not.toMatch(/type-\$\{event\.type\}/);
  });

  it('converts hex colours for deck.gl layers', () => {
    expect(hexToRgb(SELECTION_COLORS.campaignRoute)).toEqual([229, 196, 135]);
  });
});
