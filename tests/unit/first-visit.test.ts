import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ATLAS_VIEW_KEYS,
  INTRO_YEARS,
  LANDING_YEAR,
  START_DOORS,
  introSeen,
  isLandingQuery,
  landingCamera,
  opensNotebook,
  rememberIntroSeen,
  rememberStartCardDismissed,
  startCardDismissed,
} from '../../lib/first-visit';
import { onboardingText } from '../../lib/i18n/onboarding';
import { DEFAULT_ATLAS_STATE, parseAtlasUrl, serializeAtlasUrl } from '../../lib/store';
import { LOCALES } from '../../lib/types';

const published = <T>(path: string): T =>
  JSON.parse(readFileSync(join(process.cwd(), 'public', path), 'utf8')) as T;

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

const blockedStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('phone notebook', () => {
  it('starts folded for a plain visit and open for links to what it shows', () => {
    for (const query of ['', '?lang=fr', '?lang=fr&y=1812&lon=12&lat=43&z=3', '?resources=1'])
      expect(opensNotebook(parseAtlasUrl(query)), query).toBe(false);
    for (const query of [
      '?e=Q48314',
      '?person=Q517',
      '?entity=cliopatria-1',
      '?war=Q78994',
      '?campaign=Q78994&step=3',
      '?story=Q362',
      '?battle=1&e=Q48314',
      '?mode=list',
    ])
      expect(opensNotebook(parseAtlasUrl(query)), query).toBe(true);
  });

  it('ignores a battle link whose layer is switched off', () => {
    expect(opensNotebook(parseAtlasUrl('?battle=1&battles=0'))).toBe(false);
  });
});

describe('first-visit address', () => {
  it('treats a bare address, a language or tracking parameters as a first visit', () => {
    for (const query of [
      '',
      '?',
      '?lang=fr',
      '?fbclid=IwAR0abc',
      '?utm_source=newsletter&utm_medium=email&utm_campaign=launch',
      '?gclid=abc&lang=de',
    ])
      expect(isLandingQuery(query), query).toBe(true);
  });

  it('treats any view the atlas reads, or one the reader has chosen, as a shared view', () => {
    for (const query of ['?y=1812', '?e=Q48314', '?fbclid=x&resources=1', '?lang=fr&theme=light'])
      expect(isLandingQuery(query), query).toBe(false);
    // The URL sync always writes the year and camera once the reader changes anything.
    expect(isLandingQuery(serializeAtlasUrl(DEFAULT_ATLAS_STATE))).toBe(false);
  });

  it('knows every view key the atlas reads and writes', () => {
    const source = readFileSync(join(process.cwd(), 'lib/store/index.ts'), 'utf8');
    const read = new Set(
      [...source.matchAll(/query\.(?:get|has)\('([^']+)'\)/g)].map((match) => match[1]),
    );
    read.delete('lang');
    expect([...read].sort()).toEqual([...ATLAS_VIEW_KEYS].sort());
    const shared = parseAtlasUrl(
      '?y=1815&e=Q48314&war=Q78994&from=1800&to=1820&trails=1&battles=0&resources=1&religions=1' +
        '&religion=buddhism&rpaths=0&rareas=0&borders=historical-basemaps&campaign=Q78994&step=2' +
        '&story=Q362&chapter=1&person=Q517&entity=clio-1&speed=25&mode=list&theme=light',
    );
    const battle = parseAtlasUrl('?battle=1&e=Q48314&bphase=0.5&bspeed=2&play=1');
    for (const state of [shared, battle, { ...shared, campaignPlaying: true, playing: true }])
      for (const key of new URLSearchParams(serializeAtlasUrl(state)).keys())
        if (key !== 'lang') expect(ATLAS_VIEW_KEYS.has(key), key).toBe(true);
  });
});

describe('first visit', () => {
  it('sweeps forward through history and lands on the default year over Europe', () => {
    expect(LANDING_YEAR).toBe(1812);
    expect(LANDING_YEAR).toBe(DEFAULT_ATLAS_STATE.year);
    expect([...INTRO_YEARS].sort((a, b) => a - b)).toEqual(INTRO_YEARS);
    for (const phone of [true, false]) {
      const camera = landingCamera(phone);
      expect(camera.lon).toBeGreaterThan(-10);
      expect(camera.lon).toBeLessThan(30);
      expect(camera.lat).toBeGreaterThan(40);
      expect(camera.lat).toBeLessThan(60);
      expect(camera.zoom).toBeGreaterThan(DEFAULT_ATLAS_STATE.camera.zoom);
      expect(camera.pitch).toBe(0);
    }
    expect(landingCamera(true).zoom).toBeLessThan(landingCamera(false).zoom);
  });

  it('offers three ways in that exist in the published data', () => {
    const campaigns = published<{ id: string; name: { en: string } }[]>('data/campaigns.json');
    expect(campaigns.find((item) => item.id === START_DOORS.campaign)?.name.en).toBe(
      'Napoleonic Wars',
    );
    const battlePath = `data/battles/events/${START_DOORS.battle}.json`;
    expect(existsSync(join(process.cwd(), 'public', battlePath))).toBe(true);
    const battle = published<{ name: { en: string }; start: { year: number } }>(battlePath);
    expect(battle.name.en).toMatch(/Waterloo/);
    expect(battle.start.year).toBe(1815);
    const religions = published<{
      traditions: { id: string }[];
      milestones: { traditionId: string; year: number }[];
    }>('data/religions/history.json');
    expect(religions.traditions.some((item) => item.id === START_DOORS.religion)).toBe(true);
    const first = Math.min(
      ...religions.milestones
        .filter((item) => item.traditionId === START_DOORS.religion)
        .map((item) => item.year),
    );
    expect(START_DOORS.religionYear).toBe(first);
  });

  it('remembers a dismissed start card and survives unavailable storage', () => {
    const local = memoryStorage();
    expect(startCardDismissed(local)).toBe(false);
    rememberStartCardDismissed(local);
    expect(startCardDismissed(local)).toBe(true);
    const session = memoryStorage();
    expect(introSeen(session)).toBe(false);
    rememberIntroSeen(session);
    expect(introSeen(session)).toBe(true);
    expect(() => rememberStartCardDismissed(blockedStorage)).not.toThrow();
    expect(startCardDismissed(blockedStorage)).toBe(false);
    expect(introSeen(blockedStorage)).toBe(false);
    expect(startCardDismissed(null)).toBe(false);
    // Outside a browser there is no storage at all.
    expect(startCardDismissed()).toBe(false);
  });

  it('writes the start card and help sheet in all six languages', () => {
    const keys = [
      'startTitle',
      'napoleonTitle',
      'waterlooTitle',
      'buddhismTitle',
      'dismiss',
      'helpTitle',
      'keySpace',
      'keyArrows',
      'keySearch',
      'keyEscape',
      'layerBattles',
      'layerResources',
      'layerReligions',
    ] as const;
    for (const key of keys) {
      const texts = LOCALES.map((locale) => onboardingText(locale, key));
      for (const text of texts) expect(text.trim(), key).not.toBe('');
      // Each language has its own wording rather than an English fallback.
      expect(new Set(texts).size, key).toBeGreaterThan(3);
    }
  });
});
