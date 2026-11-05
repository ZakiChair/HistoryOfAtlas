import type { Locale } from '@/lib/types';

const copy = {
  label: {
    fr: 'Échelle non linéaire',
    en: 'Nonlinear time scale',
    de: 'Nichtlineare Zeitskala',
    es: 'Escala temporal no lineal',
    zh: '非线性时间轴',
    ru: 'Нелинейная шкала времени',
    ar: 'مقياس زمني غير خطي',
  },
  territorialDensity: {
    fr: 'Densité des observations territoriales documentées au fil du temps',
    en: 'Density of documented territorial observations over time',
    de: 'Dichte dokumentierter territorialer Beobachtungen im Zeitverlauf',
    es: 'Densidad de observaciones territoriales documentadas a lo largo del tiempo',
    zh: '有记录的领土观测随时间的密度',
    ru: 'Плотность документированных наблюдений за территориями во времени',
    ar: 'كثافة الرصود الإقليمية الموثّقة عبر الزمن',
  },
} satisfies Record<string, Record<Locale, string>>;

export function timelineReadingText(locale: Locale, key: keyof typeof copy): string {
  return copy[key][locale];
}
