import { intervalTimeModel, thematicHorizon, thematicMilestonesAt } from '../thematic/time';
import type { EpidemicDataset, EpidemicMilestone, EpidemicText } from './types';
import type { Locale } from '@/lib/types';

/** Epidemic texts are written in French and English; other interfaces read the English text. */
export const epidemicLanguage = (locale: Locale): 'fr' | 'en' => (locale === 'fr' ? 'fr' : 'en');

export const epidemicLabel = (value: EpidemicText, locale: Locale): string =>
  value[epidemicLanguage(locale)];

/** An outbreak stays fully drawn through `endYear`, then fades over twenty-five years. */
export const EPIDEMIC_GRACE_YEARS = 25;
export const EPIDEMIC_TIME = intervalTimeModel({ grace: EPIDEMIC_GRACE_YEARS });
/** Spread links are momentary movements, so they fade twice as fast as outbreaks. */
export const EPIDEMIC_ROUTE_FADE_RATE = 2;

/** Outbreaks documented in the window, never a claim about prevalence. */
export function epidemicMilestonesAt(
  dataset: EpidemicDataset,
  year: number,
  range: [number, number] | null = null,
  disease: string | null = null,
): EpidemicMilestone[] {
  return thematicMilestonesAt(
    dataset.milestones,
    thematicHorizon(year, range),
    EPIDEMIC_TIME,
    (milestone) => milestone.diseaseId,
    disease,
  );
}
