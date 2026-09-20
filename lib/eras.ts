import type { EraId, Locale } from './types';

export const MIN_YEAR = -3500;
// This reads today's year, never interprets a historical year through JavaScript Date.
export const CURRENT_YEAR = Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'UTC' }).format());
export const MAX_YEAR = CURRENT_YEAR;

export interface Era {
  id: EraId;
  start: number;
  end: number;
  weight: number;
  color: string;
  name: Record<Locale, string>;
  short: Record<Locale, string>;
}

/** Editorial navigation periods, not claims that all regions share one chronology. */
export const ERAS: readonly Era[] = [
  { id: 'ancient', start: MIN_YEAR, end: -800, weight: 15, color: '#c1965c', name: { fr: 'Antiquité ancienne', en: 'Early antiquity' }, short: { fr: 'Premiers empires', en: 'Early empires' } },
  { id: 'classical', start: -800, end: 284, weight: 17, color: '#c3a474', name: { fr: 'Antiquité classique', en: 'Classical antiquity' }, short: { fr: 'Antiquité', en: 'Antiquity' } },
  { id: 'late-antiquity', start: 284, end: 476, weight: 6, color: '#948c77', name: { fr: 'Antiquité tardive', en: 'Late antiquity' }, short: { fr: 'Ant. tardive', en: 'Late antiquity' } },
  { id: 'medieval', start: 476, end: 1492, weight: 18, color: '#798a74', name: { fr: 'Moyen Âge', en: 'Middle Ages' }, short: { fr: 'Moyen Âge', en: 'Middle Ages' } },
  { id: 'early-modern', start: 1492, end: 1800, weight: 15, color: '#779aa2', name: { fr: 'Époque moderne', en: 'Early modern era' }, short: { fr: 'Époque moderne', en: 'Early modern' } },
  { id: '19th-century', start: 1800, end: 1900, weight: 10, color: '#bd8a68', name: { fr: 'XIXe siècle', en: '19th century' }, short: { fr: 'XIXe', en: '19th c.' } },
  { id: '20th-century', start: 1900, end: 2000, weight: 12, color: '#b67a76', name: { fr: 'XXe siècle', en: '20th century' }, short: { fr: 'XXe', en: '20th c.' } },
  { id: 'contemporary', start: 2000, end: CURRENT_YEAR, weight: 7, color: '#8a86ad', name: { fr: 'Époque contemporaine', en: 'Contemporary era' }, short: { fr: 'Aujourd’hui', en: 'Today' } },
];

export function classifyEra(year: number): EraId {
  return ERAS.find((era) => year >= era.start && year < era.end)?.id ?? (year < MIN_YEAR ? 'ancient' : 'contemporary');
}

export function getEra(year: number): Era {
  return ERAS.find((era) => era.id === classifyEra(year))!;
}

export function yearToPosition(year: number, maxYear = CURRENT_YEAR): number {
  const bounded = Math.max(MIN_YEAR, Math.min(maxYear, year));
  let offset = 0;
  const weight = ERAS.reduce((total, era) => total + era.weight, 0);
  for (let index = 0; index < ERAS.length; index++) {
    const era = ERAS[index]!;
    const end = index === ERAS.length - 1 ? maxYear : era.end;
    if (bounded <= end) return (offset + Math.max(0, bounded - era.start) / Math.max(1, end - era.start) * era.weight) / weight;
    offset += era.weight;
  }
  return 1;
}

export function positionToYear(position: number, maxYear = CURRENT_YEAR): number {
  const weight = ERAS.reduce((total, era) => total + era.weight, 0);
  const target = Math.max(0, Math.min(1, position)) * weight;
  let offset = 0;
  for (let index = 0; index < ERAS.length; index++) {
    const era = ERAS[index]!;
    if (target <= offset + era.weight) {
      const end = index === ERAS.length - 1 ? maxYear : era.end;
      return Math.round(era.start + (target - offset) / era.weight * (end - era.start)) || 0;
    }
    offset += era.weight;
  }
  return maxYear;
}
