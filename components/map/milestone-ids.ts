export interface MilestoneLayerIds {
  source: string;
  areas: string;
  outlines: string;
  casing: string;
  routes: string;
  arrows: string;
  points: string;
  selectedEmblem: string;
  selection: string;
}

export const milestoneLayerIds = (prefix: string): MilestoneLayerIds => ({
  source: `${prefix}-history`,
  areas: `${prefix}-areas`,
  outlines: `${prefix}-area-outlines`,
  casing: `${prefix}-route-casing`,
  routes: `${prefix}-routes`,
  arrows: `${prefix}-route-directions`,
  points: `${prefix}-milestones`,
  selectedEmblem: `${prefix}-selection-emblem`,
  selection: `${prefix}-selection`,
});

export interface MilestoneSpriteIds {
  medallion(theme: string): string;
  origin(theme: string): string;
  dot(theme: string): string;
  arrow(theme: string): string;
  hatch(theme: string): string;
  selectionRing: string;
  /** Expression prefixes for `['concat', prefix, ['get','theme']]`. */
  prefixes: { medallion: string; origin: string; dot: string; arrow: string; hatch: string };
}

export const milestoneSpriteIds = (prefix: string): MilestoneSpriteIds => ({
  medallion: (theme) => `${prefix}-${theme}`,
  origin: (theme) => `${prefix}-origin-${theme}`,
  dot: (theme) => `${prefix}-dot-${theme}`,
  arrow: (theme) => `${prefix}-arrow-${theme}`,
  hatch: (theme) => `${prefix}-hatch-${theme}`,
  selectionRing: `${prefix}-selection-ring`,
  prefixes: {
    medallion: `${prefix}-`,
    origin: `${prefix}-origin-`,
    dot: `${prefix}-dot-`,
    arrow: `${prefix}-arrow-`,
    hatch: `${prefix}-hatch-`,
  },
});
