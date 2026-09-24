import type { ExpressionSpecification } from 'maplibre-gl';
import type { EventType } from '@/lib/types';

/**
 * One colour family per map layer, so a symbol's layer reads at a glance:
 * - events (points, groups, 3D battle mode): vermilion and rose, below;
 * - resources: muted tints in lib/resources/colors.ts, where the pictogram names the commodity;
 * - religions: the tradition palette of public/data/religions/history.json;
 * - war tracks: a violet ramp that no other layer uses (WAR_TRACK_RAMP);
 * - amber: selection and interface only (SELECTION_COLORS, `--gold` in app/globals.css).
 * Shape (disc, pictogram, medallion) stays the first cue, including for colour-blind readers;
 * colour only confirms it. tests/unit/semantic-colors.test.ts fails when colours of two
 * different layers come closer than ΔE2000 = 10.
 */
export const EVENT_TYPE_COLORS: Readonly<Record<EventType, string>> = {
  battle: '#de4e32',
  siege: '#ae4a44',
  naval: '#f88ac0',
  war: '#ac204c',
  campaign: '#aa5628',
  // Treaties are not conflicts: a diplomatic teal keeps them apart from the conflict reds.
  treaty: '#2ac0a8',
  conquest: '#a43c7a',
};

/** MapLibre paint expression on a feature's `type`; unknown types read as battles, like EventIcon. */
export const EVENT_COLOR_EXPRESSION = [
  'match',
  ['get', 'type'],
  ...Object.entries(EVENT_TYPE_COLORS).flat(),
  EVENT_TYPE_COLORS.battle,
] as unknown as ExpressionSpecification;

/**
 * Group discs keep a dark fill; their ring carries the event family instead of the UI amber.
 * With the Battles toggle off every conflict is hidden, so groups only hold treaties.
 */
export const EVENT_GROUP_COLORS = {
  fill: '#193948',
  ring: EVENT_TYPE_COLORS.battle,
  ringWithoutConflicts: EVENT_TYPE_COLORS.treaty,
} as const;

/** 3D battle mode points: battles with sourced forces, and the illustrative remainder. */
export const BATTLE_MODE_COLORS = {
  documented: EVENT_TYPE_COLORS.battle,
  undocumented: '#786668',
} as const;

/** Amber marks what the reader chose: selection rings and the route of a chosen campaign. */
export const SELECTION_COLORS = {
  ui: '#d4b880',
  event: '#fff1cb',
  battle: '#ffe2a3',
  campaignRoute: '#e5c487',
  campaignStep: '#f0d9aa',
} as const;

/**
 * Chronology of a selected war's tracks (lib/war-tracks.ts): light violet at the first dated
 * event, dark violet at the last, so order reads without borrowing the event or selection hues.
 * Keep in sync with the `.war-track-key` gradient in app/globals.css.
 */
export const WAR_TRACK_RAMP = ['#f4bfff', '#928fff', '#6e3cbe'] as const;

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
