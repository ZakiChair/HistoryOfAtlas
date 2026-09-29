import type { Map as MapInstance } from 'maplibre-gl';
import { RELIGION_SYMBOLS } from '@/lib/religions/icons';
import { milestoneSpriteIds } from './milestone-ids';
import { createMilestoneSprites, MILESTONE_MEDALLION_SIZE } from './milestone-sprites';

/** Shared with the panel key in ReligionKey.tsx, which redraws these sprites as SVG. */
export const RELIGION_INK = '#09222e';
export const RELIGION_MEDALLION_SIZE = MILESTONE_MEDALLION_SIZE;
export const RELIGION_SELECTION_RING = milestoneSpriteIds('religion').selectionRing;

export function createReligionSprites(map: MapInstance) {
  return createMilestoneSprites(map, {
    ids: milestoneSpriteIds('religion'),
    symbols: RELIGION_SYMBOLS,
    fallbackSymbol: 'confucian',
    ink: RELIGION_INK,
    subject: 'Religion emblems',
  });
}
