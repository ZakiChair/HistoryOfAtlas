import type { Locale } from '../types';

const copy = {
  read: {
    fr: 'Lire la carte',
    en: 'Read the map',
    de: 'Die Karte lesen',
    es: 'Leer el mapa',
    zh: '读懂地图',
    ru: 'Как читать карту',
    ar: 'قراءة الخريطة',
  },
  dated: {
    fr: 'Contours approximatifs',
    en: 'Approximate boundaries',
    de: 'Ungefähre Grenzen',
    es: 'Fronteras aproximadas',
    zh: '近似边界',
    ru: 'Приблизительные границы',
    ar: 'حدود تقريبية',
  },
  snapshot: {
    fr: 'Instantané',
    en: 'Snapshot',
    de: 'Momentaufnahme',
    es: 'Instantánea',
    zh: '历史快照',
    ru: 'Срез',
    ar: 'لقطة زمنية',
  },
  transition: {
    fr: 'Fondu illustratif',
    en: 'Illustrative blend',
    de: 'Illustrative Überblendung',
    es: 'Transición ilustrativa',
    zh: '示意叠化',
    ru: 'Иллюстративное наложение',
    ar: 'تداخل توضيحي',
  },
  earliest: {
    fr: 'Premier instantané disponible',
    en: 'Earliest available snapshot',
    de: 'Früheste verfügbare Momentaufnahme',
    es: 'Primera instantánea disponible',
    zh: '最早可用快照',
    ru: 'Первый доступный срез',
    ar: 'أقدم لقطة متاحة',
  },
  latest: {
    fr: 'Derniers contours disponibles',
    en: 'Latest available boundaries',
    de: 'Letzte verfügbare Grenzen',
    es: 'Últimas fronteras disponibles',
    zh: '最新可用边界',
    ru: 'Последние доступные границы',
    ar: 'أحدث حدود متاحة',
  },
  unavailable: {
    fr: 'Contours indisponibles',
    en: 'Boundaries unavailable',
    de: 'Grenzen nicht verfügbar',
    es: 'Fronteras no disponibles',
    zh: '无可用边界',
    ru: 'Границы недоступны',
    ar: 'الحدود غير متاحة',
  },
} satisfies Record<string, Record<Locale, string>>;

export const mapReadingText = (locale: Locale, key: keyof typeof copy) => copy[key][locale];
