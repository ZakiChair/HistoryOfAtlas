# Épidémies : corpus des foyers documentés

`public/data/epidemics/history.json` est un corpus éditorial bilingue, consulté et vérifié le **29 septembre 2026** : une première graine de **6 maladies, 12 foyers et étapes (3 émergences, 7 foyers ou vagues, 2 fins documentées), 1 relation de propagation, 9 bilans et 18 sources**, de la peste de 1347 à la COVID-19. Ce document reprend les conventions de [docs/religions-data.md](religions-data.md), dont il partage le socle de jalons datés (`lib/thematic/`). EpiMedDat (collecte ouverte d’épidémies historiques, Leibniz-Institut/FactGrid) est une source candidate pour un import médiéval systématique ultérieur.

## Ce qu’est un foyer

Une étape est une **attestation datée et localisée** : l’émergence d’une maladie, une épidémie ou une vague régionale, ou la fin documentée d’une épidémie (dernier cas, certification). Elle date l’attestation, pas l’ensemble du phénomène : une émergence n’est pas automatiquement la première occurrence jamais survenue, et une fin documentée ne prétend pas que le pathogène a disparu partout.

- `kind: "emergence"` — première apparition documentée d’une maladie ou d’une pandémie, dessinée avec l’emblème à double anneau ;
- `kind: "outbreak"` — foyer ou vague daté, emblème simple ;
- `kind: "eradication"` — fin documentée, emblème barré ; elle peut porter `closesId` vers le foyer qu’elle clôt, qui est alors atténué sans être effacé.

## Temps : intervalles et fondu

Contrairement aux repères religieux cumulatifs, un foyer possède un `endYear`. Le symbole apparaît à `year`, demeure jusqu’à `endYear`, puis s’estompe pendant **25 ans** (`intervalTimeModel`). Un `endYear` absent marque une épidémie ou une endémie en cours : le symbole reste affiché indéfiniment. Le panneau affiche « {année} — en cours » dans ce cas, et la chronologie signale un foyer terminé quand `endYear + 25` est passé. Les années suivent la convention astronomique de l’atlas (`year = 1 - année_avant_notre_ère`) ; `approximate: true` signale une datation discutée ou représentative.

## Contextes de transmission

Le champ `mechanisms` porte des contextes documentés : `trade`, `shipping`, `war`, `pilgrimage`, `migration`, `colonization`, `rail`, `air-travel`, `water`, `undocumented`. Ce sont des contextes de propagation attestés, pas une preuve du trajet exact du pathogène ; `undocumented` affirme explicitement que le contexte n’est pas établi.

## Bilans

Chaque `toll` conserve la forme de sa source : `value` pour un chiffre cité, `min`/`max` pour une fourchette, `kind` parmi `deaths`, `cases`, `share` (part de la population concernée, ≤ 1). Le `scope` texte nomme la population ou la zone couverte ; les `sourceIds` propres au bilan sont résolus et vérifiés comme ceux de l’étape. Aucune fourchette n’est ramenée à un chiffre unique.

## Géographie et relations

Comme pour les religions, les `area.ring` sont des **dessins éditoriaux grossiers** des zones touchées, pas des données épidémiologiques ; un `fromId` relie deux étapes de la même maladie dont l’année est antérieure ou égale — à la granularité annuelle, Messine et Catane partagent 1347 — et exprime une relation de propagation documentée, jamais un itinéraire reconstitué.

## Sources et réutilisation

Chaque étape et chaque bilan citent des `sourceIds` résolus vers des notices HTTPS. Les textes français et anglais sont des synthèses originales ; le corpus ne redistribue pas les contenus des sources. Les notices apparaissent dans `licenses.json` et sur la page « À propos ».

## Validation

`EpidemicDatasetSchema` (`lib/epidemics/types.ts`) contrôle les types, les bornes des coordonnées et des années, les IDs uniques, la résolution des sources, maladies et bilans, les liens chronologiquement valides, les clôtures (`closesId`, réservé à `eradication`, vers une étape antérieure de la même maladie) et la fermeture des polygones :

```sh
pnpm exec tsx -e "import fs from 'node:fs'; import { EpidemicDatasetSchema } from './lib/epidemics/types.ts'; const d = EpidemicDatasetSchema.parse(JSON.parse(fs.readFileSync('public/data/epidemics/history.json', 'utf8'))); console.log(d.diseases.length, d.milestones.length, d.sources.length);"
```

## Affichage

La couche est indépendante : `epidemics=1` l’affiche, `epidemic=<id>` retient le filtre par maladie dans l’URL partagée, et les préférences survivent à un masquage temporaire. Le panneau et la légende s’ouvrent depuis le chevron du groupe de couches.
