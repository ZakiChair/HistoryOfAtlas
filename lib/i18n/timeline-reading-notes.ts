import type { Locale } from '@/lib/types';

// Read only once someone opens the timeline note, so these sentences stay out of the initial shell.
const copy = {
  scale: {
    fr: 'Une même distance ne représente pas toujours le même nombre d’années. Les périodes récentes occupent davantage d’espace par année.',
    en: 'The same distance does not always represent the same number of years. Recent periods have more space per year.',
    de: 'Die gleiche Strecke steht nicht immer für gleich viele Jahre. Neuere Zeiträume erhalten mehr Platz pro Jahr.',
    es: 'Una misma distancia no siempre representa el mismo número de años. Los períodos recientes tienen más espacio por año.',
    zh: '相同的距离并不总是代表相同的年数。近期的历史时期每年占据更多空间。',
    ru: 'Одинаковое расстояние не всегда означает одинаковое число лет. Для недавних периодов на каждый год отведено больше места.',
    ar: 'لا تمثّل المسافة نفسها دائمًا العدد نفسه من السنوات. تشغل الفترات الحديثة مساحة أكبر لكل سنة.',
  },
  bars: {
    fr: 'Les barres indiquent la quantité d’événements ou d’observations territoriales documentés dans l’atlas, pas l’intensité de l’histoire. Une absence de barre peut refléter un manque de données.',
    en: 'Bars show how many events or territorial observations are documented in the atlas, not how intense history was. A missing bar may reflect missing data.',
    de: 'Die Balken zeigen die Menge der im Atlas dokumentierten Ereignisse oder territorialen Beobachtungen, nicht die Intensität der Geschichte. Ein fehlender Balken kann auf fehlende Daten hinweisen.',
    es: 'Las barras indican cuántos acontecimientos u observaciones territoriales están documentados en el atlas, no la intensidad de la historia. Una barra ausente puede reflejar datos faltantes.',
    zh: '柱形表示地图集中记录的事件或领土观测数量，而非历史活动的强度。没有柱形可能意味着数据缺失。',
    ru: 'Столбцы показывают количество документированных событий или наблюдений за территориями в атласе, а не насыщенность истории. Отсутствие столбца может означать нехватку данных.',
    ar: 'تُظهر الأعمدة عدد الأحداث أو الرصود الإقليمية الموثّقة في الأطلس، لا كثافة الأحداث التاريخية. وقد يعكس غياب عمود نقصًا في البيانات.',
  },
  periods: {
    fr: 'Les noms de périodes servent à naviguer : toutes les régions du monde ne suivent pas ce découpage.',
    en: 'Period names help with navigation: this division of history does not apply to every region of the world.',
    de: 'Die Epochennamen dienen der Navigation: Diese Einteilung gilt nicht für alle Regionen der Welt.',
    es: 'Los nombres de los períodos facilitan la navegación: esta división de la historia no se aplica a todas las regiones del mundo.',
    zh: '时期名称用于方便导航：世界各地区并不都遵循这种历史分期。',
    ru: 'Названия периодов помогают ориентироваться: такое деление истории подходит не для всех регионов мира.',
    ar: 'تساعد أسماء الفترات على التنقّل؛ ولا تتّبع جميع مناطق العالم هذا التقسيم التاريخي.',
  },
} satisfies Record<string, Record<Locale, string>>;

export const timelineReadingNote = (locale: Locale, key: keyof typeof copy) => copy[key][locale];
