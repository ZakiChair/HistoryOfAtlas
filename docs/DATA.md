# Données, provenance et reconstruction

Atlas Belli conserve les identifiants et les sources ; aucune date, coordonnée, bataille ou frontière n’est écrite de mémoire dans le jeu affiché. Les chiffres exacts figurent dans `data/reports/quality.json` et sa version publique `/data/quality.json`. Une valeur cible n’est jamais présentée comme une couverture mesurée.

## Exécution

Prérequis : Node.js 22+, pnpm, Python 3 et [tippecanoe](https://github.com/felt/tippecanoe). Sur macOS : `brew install tippecanoe`. Sur Linux, installer ou compiler la version récente prenant en charge PMTiles.

```sh
pnpm data:build
```

Cette commande télécharge les fonds géographiques et frontières, découvre les classes Wikidata puis les événements, enrichit les entités, normalise, déduplique par QID, calcule l’importance, valide et construit les sorties. Les acquisitions brutes sont dans `data/raw`, ignoré par Git. Les fichiers `.sparql` conservent les requêtes exactes ; les `.meta.json` conservent URL, horodatage et SHA-256. Une reconstruction utilise le cache existant ; supprimer `data/raw` provoque une acquisition entièrement neuve. Une source vivante peut évoluer entre deux acquisitions : les révisions Wikidata sont inscrites dans les liens sources lorsqu’elles sont fournies. Le premier cache acquis ne comportait pas cette métadonnée ; ses empreintes et dates de téléchargement restent conservées, et ses liens pointent vers les pages Wikidata vivantes.

```sh
pnpm data:build --offline          # reconstruire depuis le cache complet
pnpm data:build --events-only      # réutiliser les fonds déjà acquis
pnpm data:build --offline --partial # contrôle explicite d'une acquisition en cours
pnpm data:build --offline --verify  # comparer chaque octet au corpus publié, sans le remplacer
pnpm data:build --offline --refresh-editorial # renouvellement éditorial explicite des étapes/récits
```

Le mode partiel l’indique dans le rapport et ne fige pas la sélection éditoriale. Il sert au développement pendant une longue acquisition ; ce n’est pas une preuve de couverture complète.

La publication prépare un répertoire complet puis remplace les sorties précédentes. Les notices désormais rejetées et les anciennes tranches sont ainsi supprimées, sans toucher aux sélections éditoriales. Un échec avant publication conserve le jeu précédent. Un mode complet refuse un cache dont l’acquisition n’est pas terminée, y compris l’enrichissement des entités liées et des intitulés originaux. Le mode `--verify` reconstruit dans un répertoire temporaire, compare les listes de fichiers et chaque octet, puis écrit une empreinte globale dans `data/reports/idempotence.json`. Il ne remplace pas le corpus utilisé par les audits du site.

## Sources et licences

| Source                                                                     | Usage                                              | Licence                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access)             | événements, liens, dates, coordonnées et identités | CC0                                                  |
| [historical-basemaps](https://github.com/aourednik/historical-basemaps)    | instantanés de frontières                          | voir `docs/GEOGRAPHY.md` et licence source conservée |
| [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)      | terres, côtes, fleuves et contrôle des points      | domaine public                                       |
| [Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria) | intervalles territoriaux datés                     | CC BY 4.0 ; voir documentation géographique          |
| [Wikipédia](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)     | résumés récupérés à l’ouverture d’une fiche        | attribution CC BY-SA, licence propre de chaque image |

Le graphe Wikidata principal est interrogé via SPARQL. Les racines vérifiées sont bataille Q178561, siège Q188055, bataille navale Q1261499, guerre Q198, campagne militaire Q831663, traité de paix Q625298 et conquête Q1361229. La fermeture des sous-classes est téléchargée une seule fois ; les pages suivantes utilisent des identifiants de classe explicites pour éviter les parcours transitifs coûteux.

L’API Wikibase `wbgetentities` enrichit les QID par lots de 50. Cette interface officielle permet de continuer l’enrichissement lorsque WDQS est dégradé. Un User-Agent explicite, une cadence limitée, un cache, des reprises et le respect de `Retry-After` sont appliqués. Une erreur définitive arrête la construction : aucune fausse donnée de remplacement n’est insérée.

## Dates et normalisation

Les dates utilisent le module `lib/histdate`, jamais `Date` de JavaScript. Les années de Wikibase JSON avant notre ère sont converties en années astronomiques (−1 historique devient 0). Les années RDF/WDQS sont déjà astronomiques : [documentation Wikidata](https://www.wikidata.org/wiki/Help:Dates#Years_BC). La précision de la déclaration et son calendrier sont conservés ; plusieurs dates concurrentes déclenchent le badge d’incertitude. Les déclarations obsolètes sont écartées ; les déclarations de rang préféré priment.

La comparaison d’une date de fin imprécise utilise son intervalle possible : une fin déclarée seulement « 1945 » n’est pas transformée en 1er janvier. Une inversion certaine est rejetée. Les précisions plus larges qu’un siècle sont rejetées, car le schéma de l’atlas ne permet pas de les représenter fidèlement.

Les coordonnées P625 de l’événement sont prioritaires. En leur absence, P276 peut fournir les coordonnées d’un lieu explicitement lié ; `coordinateSource.kind = "place"` le signale et la source du lieu est ajoutée. Une coordonnée héritée n’est jamais présentée comme une localisation archéologique précise.

L’absence de libellé français et anglais ne suffit pas à exclure un événement : un complément récupère ses libellés Wikidata dans toutes les langues et conserve un intitulé original avec `nameLanguage`. Par compatibilité avec le schéma, `name.en` sert alors de repli d’affichage ; le badge de la fiche indique la langue réelle. Aucune traduction n’est fabriquée. Un enregistrement dépourvu de tout intitulé sourcé reste rejeté.

P710 ne définit pas systématiquement deux camps. Les participants sans camp sourcé restent `side: "other"` ; le pipeline ne les répartit pas arbitrairement. Les résumés Wikipédia et images sont chargés uniquement à l’ouverture des fiches. Les régions sont des catégories de navigation géographiques approximatives, pas des affirmations de souveraineté.

Pour les points terrestres, les continents et sous-régions proviennent du masque Natural Earth 1:50m. L’Asie occidentale et les pays asiatiques de sa région « Middle East & North Africa » forment la catégorie « Moyen-Orient ». Des exceptions géographiques évitent d’attribuer Hawaï à l’Amérique ou la Sibérie à l’Europe uniquement à partir du continent administratif d’un État. Les points marins utilisent un découpage géographique approximatif documenté dans `pipeline/normalize/region.ts`.

Les quantités conservent leur sens : [P1132](https://www.wikidata.org/wiki/Property:P1132) fournit les participants dénombrés, [P1120](https://www.wikidata.org/wiki/Property:P1120) les morts, [P1590](https://www.wikidata.org/wiki/Property:P1590) les morts et blessés combinés. Une estimation en intervalle, plusieurs valeurs concurrentes ou un chiffre qualifié pour une partie seulement ne sont pas convertis en total exact. Ces assertions restent consultables dans la source brute et sur Wikidata. L’image P18 fournit seulement une URL Commons différée ; son fichier possède sa propre licence consultable depuis la fiche.

## Validation et limites

Les contrôles rejettent les coordonnées invalides ou explicitement non terrestres, les dates incohérentes, les événements hors de la période de l’atlas et les batailles/sièges/conquêtes terrestres situés en pleine mer. La vérification des terres utilise Natural Earth 1:10m et une distance géodésique maximale de 25 km au contour, afin de conserver les petites îles et côtes généralisées. Les batailles navales et les combats aériens explicitement classés comme tels dans la source sont exemptés. Une description contenant exactement « naval battle » ou « bataille navale » peut préciser une catégorie générique « bataille » ; cette origine est signalée dans les sources de la notice. Une guerre sans coordonnées peut subsister comme fiche de contexte, sans compter parmi les événements géolocalisés.

Les classes explicitement fictives, hypothétiques ou légendaires sont exclues du corpus factuel et comptées dans les rejets. Les règles et QID correspondants sont versionnés dans `data/curated/excluded-classes.json`. `excluded-records.json` conserve les QID et descriptions source de cas explicitement hypothétiques ou (semi-)légendaires malgré un classement générique. Une mention de fausse alerte ne suffit pas à exclure un événement réellement survenu. Les exemptions aériennes sont documentées dans `medium-classes.json`. Ces contrôles ne prétendent pas résoudre les désaccords historiographiques de chaque notice.

Le rapport contient les décomptes par type, ère et région, tous les rejets avec motifs, les notices de contexte, la provenance et le contrôle de l’objectif de 20 000. Wikidata comporte des lacunes importantes, surtout pour les périodes anciennes et certaines régions ; le pipeline mesure ces lacunes au lieu de les masquer. Une provenance Wikidata rend l’assertion traçable, mais n’équivaut pas à une vérification historiographique indépendante.

## Importance et sélection éditoriale

L’importance 0–100 combine une échelle logarithmique du nombre de sitelinks (55 points), l’appartenance à la sélection (15), la taille documentée de la guerre parente (15), des effectifs documentés (10), et une base de 10, plafonnée à 100. Ce score règle la visibilité des marqueurs ; il n’évalue ni la souffrance, ni la légitimité des parties.

`data/curated/events.json` contient une sélection versionnée de QID vérifiés. Son amorçage retient quatre événements par combinaison région/ère disponible, puis complète selon les sitelinks jusqu’à 240. Son statut explicite est « sélection éditoriale initiale vérifiée par la source », pas « canon validé par des historiens ». Toute modification éditoriale peut conserver les identifiants et changer les raisons de sélection ; aucune date ou coordonnée n’y est inventée.

## Séquences et territoires

Les séquences utilisent exclusivement les liens Wikidata P361 (« partie de ») et P527 (« comprend »), puis ordonnent les événements datés. Les groupes de guerre suivent aussi ces liens à travers les campagnes intermédiaires, avec exclusion des parents dont la classe n’est pas militaire. Les arêtes formant un cycle sont mises en quarantaine. Un parent sans date source ne peut pas délimiter une séquence. Chaque relation, puis chaque événement par rapport à chaque ancêtre, doit être compatible avec les bornes temporelles source : une campagne commençant avant sa guerre parente ou finissant après celle-ci ne se rattache pas automatiquement à elle. Les dates partielles conservent leur intervalle possible ; les précisions à la décennie/au siècle bénéficient d’une marge conservatrice de neuf/quatre-vingt-dix-neuf années autour de la valeur. Ce contrôle ne convertit pas les calendriers source et les cas proches d’une borne restent à examiner dans leur source. Les parents explicitement fictifs ou hypothétiques restent exclus. Les vagues politiques recensées dans `excluded-war-groups.json` sont écartées des regroupements militaires, sans supprimer automatiquement leurs notices individuelles. Les traits de liaison ne sont pas les itinéraires empruntés par une armée. Cette distinction est inscrite dans chaque description de séquence. Une reconstruction de campagne au sens strict demanderait des tracés sourcés supplémentaires.

Les quarante conflits et campagnes ont été sélectionnés explicitement dans le catalogue ingéré, avec leurs QID, intitulés et sources dans `data/curated/campaign-selection.json`. La sélection couvre l’Afrique, l’Asie, les Amériques précolombiennes et l’Océanie, ainsi que les périodes disponibles ; elle ne constitue pas une validation historiographique indépendante. Les quarante étapes les plus documentées au maximum par séquence sont figées dans `data/curated/campaigns.json` et dix parcours dans `content/stories`. Les reconstructions suivantes respectent ces choix et échouent explicitement si une étape n’est plus validée ou liée à son parent. Un renouvellement passe uniquement par `--refresh-editorial` après revue.

Le rapport `data/reports/relations.json` conserve les relations rejetées, leur propriété, la déclaration source et, pour les rejets transitifs, le chemin parcouru. Les dates des événements ne sont pas corrigées pour forcer un rattachement. Exemple constaté : Q110197514 (« War in Gilboa », année astronomique −1009) porte un lien P361 vers Q3491398 (« Arab–Israeli Wars »), parent dépourvu de dates ; le lien est mis en quarantaine. La conquête romaine de la Bretagne Q1258062 est également absente des parcours faute de date source pour le parent.

Dans la livraison mesurée : 20 037 événements géolocalisés et datés, 378 notices de contexte, 240 entrées éditoriales, 40 séquences et 10 récits. Les étapes couvrent les sept régions géographiques. La sélection ne comporte aucune étape d’« Antiquité ancienne » ni d’époque contemporaine ; sa première séquence est celle des guerres médiques. Ces lacunes sont signalées, sans fabriquer de campagne ancienne pour les combler.

Les changements territoriaux proviennent des intervalles et géométries des sources géographiques. Les identifiants d’événements ne sont pas attribués aux changements sur la seule base d’une proximité de date. L’affichage synchronisé fournit un contexte temporel, pas une preuve de causalité.

## Sorties pour le navigateur

- `public/data/manifest.json` : index léger, couverture et histogramme annuel.
- `public/data/event-shards/{tranche}.pmtiles` : archives temporelles utilisées au démarrage. Un siècle avant 1800, une décennie ensuite, uniquement pour les tranches où un événement sourcé commence. Chaque archive contient **tous** les événements dont la durée chevauche la tranche prolongée de 25 ans de chaque côté, même s’ils commencent des siècles plus tôt. `manifest.eventShards` fournit la tranche nominale, sa fenêtre de validité, son URL et son effectif.
- `public/data/events.pmtiles` : archive complète réservée aux demandes explicites de plage, de guerre ou de traces. Couche vectorielle `events` identique dans toutes les archives ; attributs `id`, `start`, `end`, `importance`, `type`, `era`, `region`, `parentWar`, `name_fr`, `name_en`, `entities` et `wars` (QID délimités par `|` pour éviter les correspondances partielles). `wars` contient les ancêtres militaires attestés et validés ; `parentWar` reste le parent principal. Le filtrage GPU ne réduit pas le transfert des tuiles : le découpage temporel évite donc de charger tous les événements au zoom zéro. Les chemins de génération et noms Tippecanoe sont stables pour produire des archives identiques au bit près.
- `public/data/chunks/{tranche}.json` : notices légères par décennie depuis 1800, par siècle auparavant ; l’intervalle du manifeste tient compte des événements longs.
- `public/data/events/{QID}.json` : une notice complète par requête.
- `public/data/search-manifest.json` et `search/{tranche}.json` : index de recherche découpé, exploité dans un Worker ; noms de lieux, participants et guerre parente servent d’alias sourcés.
- `public/data/wars.json`, `wars/{QID}.json` : catalogue et événements liés d’une guerre.
- `public/data/campaigns.json` : séquences chronologiques sourcées.
- `public/data/stories.json` : parcours versionnés.
- `public/data/on-this-day/{MM-DD}.json` : événements dont la source fournit réellement un mois et un jour.

Les tableaux bruts de toutes les géométries ne sont jamais importés par le code de l’interface.

## Dossiers de batailles et de personnes

L’enrichissement est intégré à `pnpm data:build`. `pipeline/fetch/enrichment.py` acquiert par lots les personnes explicitement liées aux événements, les dirigeants déclarés des entités politiques sources, leurs fonctions et les juridictions de ces fonctions. Le cache conserve réponses, révisions, empreintes, progression et indisponibilités. Un build complet refuse une acquisition inachevée ou dont les entrées ont changé.

Les descriptions FR/EN de Wikidata sont copiées dans `description`, séparément des résumés Wikipédia. Le lecteur encyclopédique consulte les liens `wikipedia` normalisés, avec repli de langue et attribution ; descriptions et repères restent disponibles si l’API Wikipédia ne répond pas. Les champs riches sont retirés des tranches temporelles et des listes de guerre.

Le [commandement P4791](https://www.wikidata.org/wiki/Property:P4791), directement sur l’événement ou comme qualificatif d’un participant P710, produit un lien `commander`. P710, [P1344](https://www.wikidata.org/wiki/Property:P1344) et [P607](https://www.wikidata.org/wiki/Property:P607) établissent seulement une participation. Le pipeline n’attribue pas toutes les batailles d’une guerre à chacun de ses commandants. Les liens inverses événement/personne conservent la même déclaration et ses références.

Les naissances P569, décès P570 et fonctions P39, P35/P6 conservent les déclarations non obsolètes, y compris les anciens mandats de rang normal. Chaque date contient calendrier, précision, approximation éventuelle, identifiant de déclaration, entité source et références bibliographiques disponibles. Les variantes ne sont pas écrasées. Les marqueurs d’incertitude et bornes qualificatives déclenchent une approximation ; leurs détails restent consultables dans la déclaration originale. Les valeurs invalides et les relations certainement incompatibles avec la vie de la personne sont consignées dans le rapport.

La juridiction d’une fonction repose sur P1001. L’identification des fonctions de chef d’État ou de gouvernement utilise les déclarations explicites P1906/P1313 du territoire. Quand une association est datée, elle doit couvrir le mandat entier avec des calendriers compatibles. Une fonction traversant une transition de juridiction reste une fonction sans territoire déduit : aucune durée n’est découpée ou réécrite pour forcer la correspondance.

Les correspondances de carte passent par `data/curated/polity-identities.json` : 26 observations vérifiées, 24 QID distincts et deux associations erronées explicitement exclues. Les libellés et révisions vérifiés figurent dans `data/reports/polity-identity-review.json`. Une identité non revue n’est pas utilisée pour attribuer des dirigeants ou des guerres à un polygone. Ce registre ne modifie pas les géométries de la source.

Les sorties supplémentaires sont :

- `people/{QID}.json` : biographie structurée, fonctions datées, événements et sources, chargée seulement à l’ouverture.
- `people-index.json` : noms et alias pour le worker, chargé seulement à l’ouverture de la recherche.
- `polity-leaders/{QID}.json` : fonctions explicitement rattachées à une entité source.
- `enrichment.json` : couverture et motifs de rejet, version détaillée dans `data/reports/enrichment.json`.

Le relevé du 21 septembre 2026 contient 11 364 personnes, 19 174 notices avec description, 6 849 notices avec personnes liées, 14 790 liens de commandement, 10 182 liens de participation et 22 066 fonctions, dont 15 570 avec début et fin. Ces effectifs décrivent les déclarations disponibles, pas une liste exhaustive des souverains, des états-majors ou des règnes. `pnpm data:check` vérifie les schémas, la provenance et les 24 972 liens réciproques dans les artefacts publiés, sans accès réseau ni cache brut.
