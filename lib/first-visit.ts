import type { AtlasCamera, AtlasState } from './store';

/** Same breakpoint as the phone layout in app/globals.css. */
export const PHONE_QUERY = '(max-width: 580px)';

/** The opening montage sweeps forward through history and lands on a well-documented year. */
export const INTRO_YEARS: readonly number[] = [
  -3500, -2300, -330, 117, 800, 1206, 1492, 1648, 1812,
];
export const LANDING_YEAR = INTRO_YEARS.at(-1)!;

/**
 * Europe in 1812. On wider screens the centre sits a little west so that the Iberian peninsula
 * stays clear of the notebook on the left.
 */
export function landingCamera(phone: boolean): AtlasCamera {
  return phone
    ? { lon: 14, lat: 49, zoom: 2.3, bearing: 0, pitch: 0 }
    : { lon: 8, lat: 49, zoom: 3, bearing: 0, pitch: 0 };
}

/** The three ways in offered on a first visit; tests check them against the published data. */
export const START_DOORS = {
  /** Napoleonic Wars campaign. */
  campaign: 'Q78994',
  /** Battle of Waterloo reconstruction. */
  battle: 'Q48314',
  religion: 'buddhism',
  /** First dated Buddhist milestone in the religion catalogue. */
  religionYear: -449,
} as const;

/**
 * On a phone the notebook starts folded so the map comes first. A shared link that points at
 * something the notebook shows (a record, a campaign, a story, a war, a battle or the list view)
 * keeps it open.
 */
export function opensNotebook(
  state: Pick<
    AtlasState,
    | 'selectedEvent'
    | 'selectedEntity'
    | 'selectedPerson'
    | 'selectedWar'
    | 'campaignId'
    | 'storyId'
    | 'battleMode'
    | 'mode'
  >,
): boolean {
  return Boolean(
    state.selectedEvent ||
    state.selectedEntity ||
    state.selectedPerson ||
    state.selectedWar ||
    state.campaignId ||
    state.storyId ||
    state.battleMode ||
    state.mode === 'list',
  );
}

/**
 * The query keys that describe a view, as parseAtlasUrl in lib/store reads them. `lang` is left
 * out on purpose, like tracking parameters (fbclid, utm_*…).
 */
export const ATLAS_VIEW_KEYS: ReadonlySet<string> = new Set([
  'y',
  'lon',
  'lat',
  'z',
  'bearing',
  'pitch',
  'theme',
  'projection',
  'borders',
  'mode',
  'speed',
  'filters',
  'from',
  'to',
  'trails',
  'play',
  'e',
  'war',
  'entity',
  'person',
  'campaign',
  'step',
  'cplay',
  'follow',
  'story',
  'chapter',
  'battles',
  'battle',
  'bphase',
  'bspeed',
  'resources',
  'religions',
  'religion',
  'rpaths',
  'rareas',
]);

/**
 * A first visit is an address that names no view: a bare `/`, or one that only carries a language
 * or tracking parameters. The URL sync writes the whole view as soon as the reader changes
 * anything, so this also tells whether they have already chosen something themselves.
 */
export function isLandingQuery(search: string): boolean {
  for (const key of new URLSearchParams(search).keys()) if (ATLAS_VIEW_KEYS.has(key)) return false;
  return true;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Storage can be missing or throw (private windows, blocked site data): never let it break the atlas. */
function browserStorage(kind: 'localStorage' | 'sessionStorage'): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window[kind];
  } catch {
    return null;
  }
}

function read(storage: StorageLike | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(storage: StorageLike | null, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    /* The choice simply is not remembered. */
  }
}

export const START_CARD_KEY = 'atlas-start-card';
export const INTRO_KEY = 'atlas-intro';

export function startCardDismissed(storage = browserStorage('localStorage')): boolean {
  return read(storage, START_CARD_KEY) === 'dismissed';
}

export function rememberStartCardDismissed(storage = browserStorage('localStorage')) {
  write(storage, START_CARD_KEY, 'dismissed');
}

export function introSeen(storage = browserStorage('sessionStorage')): boolean {
  return read(storage, INTRO_KEY) !== null;
}

export function rememberIntroSeen(storage = browserStorage('sessionStorage')) {
  write(storage, INTRO_KEY, 'seen');
}
