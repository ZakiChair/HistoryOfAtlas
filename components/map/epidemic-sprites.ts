import type { Map as MapInstance } from 'maplibre-gl';
import { EPIDEMIC_SYMBOLS } from '@/lib/epidemics/icons';
import { milestoneSpriteIds } from './milestone-ids';
import { createMilestoneSprites } from './milestone-sprites';

export const EPIDEMIC_INK = '#09222e';

export const createEpidemicSprites = (map: MapInstance) =>
  createMilestoneSprites(map, {
    ids: milestoneSpriteIds('epidemic'),
    symbols: EPIDEMIC_SYMBOLS,
    fallbackSymbol: 'influenza',
    ink: EPIDEMIC_INK,
    subject: 'Epidemic emblems',
  });
