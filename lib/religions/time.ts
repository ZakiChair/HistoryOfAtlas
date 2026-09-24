import type { ReligionDataset, ReligionMilestone, ReligionText } from './types';
import type { Locale } from '@/lib/types';

/** Religion texts are written in French and English; other interfaces read the English text. */
export const religionLanguage = (locale: Locale): 'fr' | 'en' => (locale === 'fr' ? 'fr' : 'en');

export const religionLabel = (value: ReligionText, locale: Locale): string =>
  value[religionLanguage(locale)];

/** Cumulative historical attestations, never a claim about current adherence. */
export function religionMilestonesAt(
  dataset: ReligionDataset,
  year: number,
  range: [number, number] | null = null,
  tradition: string | null = null,
): ReligionMilestone[] {
  const horizon = range ? Math.max(...range) : year;
  return dataset.milestones
    .filter((item) => item.year <= horizon && (!tradition || item.traditionId === tradition))
    .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
}
