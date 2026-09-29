import { cumulativeTimeModel, thematicHorizon, thematicMilestonesAt } from '../thematic/time';
import type { ReligionDataset, ReligionMilestone, ReligionText } from './types';
import type { Locale } from '@/lib/types';

/** Religion texts are written in French and English; other interfaces read the English text. */
export const religionLanguage = (locale: Locale): 'fr' | 'en' => (locale === 'fr' ? 'fr' : 'en');

export const religionLabel = (value: ReligionText, locale: Locale): string =>
  value[religionLanguage(locale)];

/** Opacity by years since attestation: older milestones recede instead of reading as present. */
export const RELIGION_AGE_FADE = [
  [0, 1],
  [500, 0.8],
  [1500, 0.45],
] as const;
export const RELIGION_TIME = cumulativeTimeModel(RELIGION_AGE_FADE);
/** Diffusion links are momentary movements, so they fade twice as fast as attestations. */
export const RELIGION_ROUTE_FADE_RATE = 2;

/** Cumulative historical attestations, never a claim about current adherence. */
export function religionMilestonesAt(
  dataset: ReligionDataset,
  year: number,
  range: [number, number] | null = null,
  tradition: string | null = null,
): ReligionMilestone[] {
  return thematicMilestonesAt(
    dataset.milestones,
    thematicHorizon(year, range),
    RELIGION_TIME,
    (milestone) => milestone.traditionId,
    tradition,
  );
}
