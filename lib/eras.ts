import type { EraId, Locale } from './types';

export const MIN_YEAR = -3500;
// This reads today's year, never interprets a historical year through JavaScript Date.
export const CURRENT_YEAR = Number(
  new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'UTC' }).format(),
);
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
  {
    id: 'ancient',
    start: MIN_YEAR,
    end: -800,
    weight: 15,
    color: '#c1965c',
    name: {
      fr: 'Antiquité ancienne',
      en: 'Early antiquity',
      de: 'Frühe Antike',
      es: 'Antigüedad temprana',
      zh: '早期古代',
      ru: 'Ранняя древность',
    },
    short: {
      fr: 'Premiers empires',
      en: 'Early empires',
      de: 'Frühe Reiche',
      es: 'Primeros imperios',
      zh: '早期帝国',
      ru: 'Первые империи',
    },
  },
  {
    id: 'classical',
    start: -800,
    end: 284,
    weight: 17,
    color: '#c3a474',
    name: {
      fr: 'Antiquité classique',
      en: 'Classical antiquity',
      de: 'Klassische Antike',
      es: 'Antigüedad clásica',
      zh: '古典时代',
      ru: 'Классическая античность',
    },
    short: {
      fr: 'Antiquité',
      en: 'Antiquity',
      de: 'Antike',
      es: 'Antigüedad',
      zh: '古代',
      ru: 'Античность',
    },
  },
  {
    id: 'late-antiquity',
    start: 284,
    end: 476,
    weight: 6,
    color: '#948c77',
    name: {
      fr: 'Antiquité tardive',
      en: 'Late antiquity',
      de: 'Spätantike',
      es: 'Antigüedad tardía',
      zh: '古代晚期',
      ru: 'Поздняя античность',
    },
    short: {
      fr: 'Ant. tardive',
      en: 'Late antiquity',
      de: 'Spätantike',
      es: 'Ant. tardía',
      zh: '古代晚期',
      ru: 'Поздняя античность',
    },
  },
  {
    id: 'medieval',
    start: 476,
    end: 1492,
    weight: 18,
    color: '#798a74',
    name: {
      fr: 'Moyen Âge',
      en: 'Middle Ages',
      de: 'Mittelalter',
      es: 'Edad Media',
      zh: '中世纪',
      ru: 'Средние века',
    },
    short: {
      fr: 'Moyen Âge',
      en: 'Middle Ages',
      de: 'Mittelalter',
      es: 'Edad Media',
      zh: '中世纪',
      ru: 'Средние века',
    },
  },
  {
    id: 'early-modern',
    start: 1492,
    end: 1800,
    weight: 15,
    color: '#779aa2',
    name: {
      fr: 'Époque moderne',
      en: 'Early modern era',
      de: 'Frühe Neuzeit',
      es: 'Edad Moderna',
      zh: '近代早期',
      ru: 'Раннее Новое время',
    },
    short: {
      fr: 'Époque moderne',
      en: 'Early modern',
      de: 'Frühe Neuzeit',
      es: 'Edad Moderna',
      zh: '近代早期',
      ru: 'Раннее Новое время',
    },
  },
  {
    id: '19th-century',
    start: 1800,
    end: 1900,
    weight: 10,
    color: '#bd8a68',
    name: {
      fr: 'XIXe siècle',
      en: '19th century',
      de: '19. Jahrhundert',
      es: 'Siglo XIX',
      zh: '19世纪',
      ru: 'XIX век',
    },
    short: { fr: 'XIXe', en: '19th c.', de: '19. Jh.', es: 'S. XIX', zh: '19世纪', ru: 'XIX в.' },
  },
  {
    id: '20th-century',
    start: 1900,
    end: 2000,
    weight: 12,
    color: '#b67a76',
    name: {
      fr: 'XXe siècle',
      en: '20th century',
      de: '20. Jahrhundert',
      es: 'Siglo XX',
      zh: '20世纪',
      ru: 'XX век',
    },
    short: { fr: 'XXe', en: '20th c.', de: '20. Jh.', es: 'S. XX', zh: '20世纪', ru: 'XX в.' },
  },
  {
    id: 'contemporary',
    start: 2000,
    end: CURRENT_YEAR,
    weight: 7,
    color: '#8a86ad',
    name: {
      fr: 'Époque contemporaine',
      en: 'Contemporary era',
      de: 'Gegenwart',
      es: 'Época contemporánea',
      zh: '当代',
      ru: 'Современная эпоха',
    },
    short: {
      fr: 'Aujourd’hui',
      en: 'Today',
      de: 'Heute',
      es: 'Actualidad',
      zh: '当今',
      ru: 'Сегодня',
    },
  },
];

export function classifyEra(year: number): EraId {
  return (
    ERAS.find((era) => year >= era.start && year < era.end)?.id ??
    (year < MIN_YEAR ? 'ancient' : 'contemporary')
  );
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
    if (bounded <= end)
      return (
        (offset + (Math.max(0, bounded - era.start) / Math.max(1, end - era.start)) * era.weight) /
        weight
      );
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
      return Math.round(era.start + ((target - offset) / era.weight) * (end - era.start)) || 0;
    }
    offset += era.weight;
  }
  return maxYear;
}
