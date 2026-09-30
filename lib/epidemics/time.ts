import { intervalTimeModel, thematicHorizon, thematicMilestonesAt } from '../thematic/time';
import type { EpidemicDataset, EpidemicFront, EpidemicMilestone, EpidemicText } from './types';
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
/** A reached front stays drawn through `endYear`, then fades over ten years. */
export const EPIDEMIC_FRONT_GRACE_YEARS = 10;
export const EPIDEMIC_FRONT_TIME = intervalTimeModel({ grace: EPIDEMIC_FRONT_GRACE_YEARS });

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

/** Spread fronts reached in the window, sorted chronologically. */
export function epidemicFrontsAt(
  dataset: EpidemicDataset,
  horizon: number,
  disease: string | null = null,
): EpidemicFront[] {
  return (dataset.fronts ?? [])
    .filter(
      (front) =>
        EPIDEMIC_FRONT_TIME.includes(front, horizon) && (!disease || front.diseaseId === disease),
    )
    .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
}

/**
 * Fronts are cumulative: only the latest one of each group reached at `horizon` is
 * filled, while every reached front keeps its outline.
 */
export function latestEpidemicFrontIds(
  fronts: readonly EpidemicFront[],
  horizon: number,
): string[] {
  const latest = new Map<string, EpidemicFront>();
  for (const front of fronts) {
    if (!EPIDEMIC_FRONT_TIME.includes(front, horizon) || front.year > horizon) continue;
    const current = latest.get(front.groupId);
    if (!current || front.year > current.year) latest.set(front.groupId, front);
  }
  return [...latest.values()].map((front) => front.id);
}
