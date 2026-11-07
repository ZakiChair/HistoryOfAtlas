import type { Locale } from '../types';

const copy = {
  documentedInterval: {
    fr: 'Observation documentée',
    en: 'Documented observation',
    de: 'Dokumentierte Beobachtung',
    es: 'Observación documentada',
    zh: '有据可查的记录',
    ru: 'Документированное наблюдение',
    ar: 'الرصد الموثّق',
  },
  selectedYear: {
    fr: 'Année choisie',
    en: 'Selected year',
    de: 'Gewähltes Jahr',
    es: 'Año seleccionado',
    zh: '所选年份',
    ru: 'Выбранный год',
    ar: 'السنة المختارة',
  },
  navigation: {
    fr: 'Parcourir les observations territoriales',
    en: 'Browse territorial observations',
    de: 'Territoriale Beobachtungen durchsuchen',
    es: 'Recorrer las observaciones territoriales',
    zh: '浏览领土记录',
    ru: 'Просмотр территориальных наблюдений',
    ar: 'تصفّح الأرصاد الإقليمية',
  },
  previous: {
    fr: 'Observation précédente',
    en: 'Previous observation',
    de: 'Vorherige Beobachtung',
    es: 'Observación anterior',
    zh: '上一条记录',
    ru: 'Предыдущее наблюдение',
    ar: 'الرصد السابق',
  },
  next: {
    fr: 'Observation suivante',
    en: 'Next observation',
    de: 'Nächste Beobachtung',
    es: 'Observación siguiente',
    zh: '下一条记录',
    ru: 'Следующее наблюдение',
    ar: 'الرصد التالي',
  },
  outsideTimeline: {
    fr: 'hors frise',
    en: 'outside the timeline',
    de: 'außerhalb der Zeitleiste',
    es: 'fuera de la cronología',
    zh: '超出时间轴范围',
    ru: 'вне шкалы времени',
    ar: 'خارج نطاق الخط الزمني',
  },
} satisfies Record<string, Record<Locale, string>>;

export function territoryObservationText(locale: Locale, key: keyof typeof copy): string {
  return copy[key][locale];
}
