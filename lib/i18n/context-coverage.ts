import type { Locale } from '../types';

const copy = {
  title: { fr: 'Couverture des sources territoriales', en: 'Territorial source coverage' },
  period: { fr: 'Période examinée', en: 'Period examined' },
  entries: { fr: 'Entrées', en: 'Entries' },
  observations: { fr: 'Observations', en: 'Observations' },
  regions: { fr: 'Région de référence', en: 'Reference region' },
  outsideRegions: { fr: 'Hors régions définies', en: 'Outside defined regions' },
  table: {
    fr: 'Entrées documentées, regroupées par point de référence',
    en: 'Documented entries grouped by reference point',
  },
  inventory: {
    fr: 'Ces nombres décrivent le catalogue choisi, pas son exhaustivité ni le nombre réel d’États ou d’habitants.',
    en: 'These counts describe the selected catalogue, not its completeness or the actual number of states or inhabitants.',
  },
  identities: {
    fr: 'Une entrée correspond à un nom propre à la source. Un même ensemble politique peut avoir plusieurs noms ou représentations. Chaque entrée n’est comptée qu’une fois dans la période ; ses observations datées sont comptées séparément.',
    en: 'An entry is a source-specific name. One political formation may have several names or representations. Each entry is counted once within the period; its dated observations are counted separately.',
  },
  anchors: {
    fr: 'Les points sont les ancrages fixes du catalogue, issus d’une géométrie de référence. Ils ne localisent ni une capitale, ni une population, ni le centre du territoire à l’année choisie.',
    en: 'Points are fixed catalogue anchors derived from a reference geometry. They locate neither a capital, a population nor the territory’s centre in the selected year.',
  },
  regionMethod: {
    fr: 'Le regroupement utilise les grandes régions d’exploration de l’atlas à partir de ces coordonnées fixes. Une entrée transcontinentale est rangée dans une seule région ; le tableau ne mesure pas l’étendue des territoires dans chaque région.',
    en: 'Grouping uses the atlas’s broad browsing regions and these fixed coordinates. A transcontinental entry belongs to one group; the table does not measure territorial extent in each region.',
  },
  approximate: {
    fr: 'Les contours sont approximatifs. Aucune précision géographique chiffrée ni probabilité de certitude n’est disponible ici.',
    en: 'Boundaries are approximate. No numerical geographic precision or probability of certainty is available here.',
  },
  empty: {
    fr: 'Aucune observation dans cette sélection. Cela ne signifie pas absence de population ou de pouvoir politique.',
    en: 'No observation within this selection. This does not mean there was no population or political authority.',
  },
  outside: {
    fr: 'La sélection est hors de la couverture datée de cette source. Le comptage ne prolonge pas les observations ; la carte peut conserver un autre état sourcé.',
    en: 'The selection is outside this source’s dated coverage. Counts do not extend observations; the map may retain another sourced state.',
  },
  noSnapshot: {
    fr: 'Aucun instantané n’est daté de cette année. Le fondu visible sur la carte ne constitue pas une observation annuelle supplémentaire.',
    en: 'No snapshot is dated to this year. The blend visible on the map does not constitute another annual observation.',
  },
  snapshotPeriod: {
    fr: 'Seuls les instantanés effectivement datés dans la période sont comptés. Les années entre deux instantanés ne sont pas interpolées.',
    en: 'Only snapshots actually dated within the period are counted. Years between snapshots are not interpolated.',
  },
  previous: { fr: 'Instantané précédent', en: 'Previous snapshot' },
  next: { fr: 'Instantané suivant', en: 'Next snapshot' },
  latest: { fr: 'Voir la dernière année sourcée', en: 'View the latest sourced year' },
  sourceRange: { fr: 'Étendue chronologique de la source', en: 'Source date range' },
  sourceLink: { fr: 'Consulter la source', en: 'Read the source' },
  clear: { fr: 'Toutes les régions', en: 'All regions' },
  locate: { fr: 'Centrer sur cette région', en: 'Centre on this region' },
  method: { fr: 'Méthode et limites du comptage', en: 'Counting method and limits' },
  documented: {
    fr: 'Ancrage avec observation dans la sélection',
    en: 'Anchor with an observation in the selection',
  },
  undocumented: { fr: 'Autre ancrage du catalogue', en: 'Other catalogue anchor' },
  alternate: {
    fr: 'La commande des frontières permet de consulter Cliopatria ou Historical Basemaps. Leurs entrées et leurs méthodes diffèrent : leurs comptes ne doivent pas être additionnés.',
    en: 'The boundary control lets you inspect Cliopatria or Historical Basemaps. Their entries and methods differ: their counts must not be added together.',
  },
} as const;

export function coverageText(locale: Locale, key: keyof typeof copy) {
  return copy[key][locale === 'fr' ? 'fr' : 'en'];
}
