# HistoryOfAtlas — approfondir et comparer l’histoire humaine

Audit du 28 septembre 2026. Public confirmé : passionnés souhaitant approfondir et comparer.

## Diagnostic

HistoryOfAtlas possède un socle sérieux pour situer des faits dans le temps et l’espace : frontières sourcées, événements, dossiers, personnes, ressources, religions, campagnes et parcours. La prochaine étape devrait développer la capacité du lecteur à expliquer, comparer et discuter les preuves.

La structure actuelle privilégie l’histoire militaire et politique. Les ressources et les religions élargissent déjà cette perspective, mais les liens entre ces domaines restent peu exploités. La priorité proposée est donc de produire quelques dossiers transversaux approfondis, accompagnés d’outils comparatifs et de sources contextualisées.

Les recommandations ci-dessous sont des propositions de produit et d’édition. Leur effet sur la compréhension reste à vérifier auprès du public visé.

## Périmètre et méthode

- Code local examiné au commit `f49a87642` : modèles, ingestion, parcours, fiches, recherche, calendrier, couches, état partageable, architecture et contrôles.
- Comptages recalculés sur les JSON publiés. Les anciens nombres du README ne constituent pas la référence pour cet audit.
- Inspection du site public en français : arrivée sur Europe/1812, catalogue des parcours, premières étapes du parcours napoléonien ; vue 1500 avec ressources et religions sur un écran émulé de 390 × 844.
- Trois analyses parallèles ont porté sur couverture historique, pédagogie et faisabilité, puis leurs conclusions ont été confrontées au code et aux observations.
- Cette inspection n’est ni une revue historique de chaque notice, ni un test utilisateur, ni un audit complet d’accessibilité. Aucun build ou test automatisé n’a été exécuté pour ce travail documentaire. La version exacte du déploiement public n’a pas été rapprochée du commit local.
- Aucun code applicatif ni jeu de données n’a été modifié. Ce rapport est le livrable ajouté au dépôt.

## Ce qui existe déjà et mérite d’être conservé

1. Une carte temporelle réelle, avec observations territoriales et deux sources de frontières.
2. Des dossiers comportant provenance, descriptions, résumé encyclopédique chargé à la demande, personnes et chronologie du conflit.
3. Des précautions explicites sur les dates approximatives, les lieux associés, les frontières et les reconstitutions 3D.
4. Une distinction utile entre ressource découverte/attestée et exploitation ; une distinction également explicite entre attestation religieuse et présence actuelle.
5. Un modèle de quantités militaires avec unités, périmètre, fourchettes et sources ; des biographies comportant plusieurs assertions datées.
6. Une architecture statique, des données différées, une recherche dans un Worker, des URL reproductibles et une vue liste accessible pour les événements.

Il serait inexact de proposer comme entièrement absents les récits, les sources, les biographies, les courbes territoriales, la recherche multithématique ou les couches ressources/religions. Le besoin principal concerne leur profondeur, leurs connexions et les possibilités de comparaison.

## Quelques mesures qui orientent les choix

| Élément | État mesuré | Implication pour la compréhension |
| --- | ---: | --- |
| Événements du corpus principal | 20 037 | Volume important, mais sept catégories militaires ou diplomatiques seulement |
| Dossiers d’événements | 20 415, dont 378 de contexte | À distinguer des événements cartographiés |
| Événements classés en Europe | 10 274 / 20 037, soit 51,3 % | La carte reflète aussi la sélection et la documentation disponibles |
| Afrique / Asie / Amérique du Sud / Océanie | 1 723 / 2 864 / 673 / 169 | Ces effectifs ne mesurent ni importance historique ni fréquence réelle des conflits |
| Parcours guidés | 10 parcours, 257 étapes | Tous concernent des guerres ou conquêtes ; textes principalement date/lieu |
| Catalogue distinct des batailles | 23 606 notices, 16 899 cartographiables | Recoupe le corpus principal : ne pas additionner les volumes |
| Ressources | 22 388 sites | Grand catalogue principalement utile pour les périodes récentes |
| Sites avec une exploitation attestée avant 1800 / avant 1500 | 34 / 16 | Faible couverture pour étudier les économies anciennes |
| Sites connus au plus tard en 1500 | 24 | Mesure distincte : connaissance attestée ou exploitation déjà documentée |
| Religions | 16 traditions, 131 jalons, 148 sources | Base éditoriale déjà intéressante pour expliquer les mécanismes de diffusion |
| Dossiers avec description française | 6 915 / 20 415, soit 33,9 % | La présence de six langues d’interface ne garantit pas la même profondeur de contenu |
| Dossiers avec description anglaise | 19 078 / 20 415 | Le contenu existe ; une partie de la lecture repose sur le repli linguistique |
| Dossiers signalant plusieurs dates ou lieux | 578 | Un bon point de départ pour rendre les variantes consultables |

Sources internes : [manifeste](../public/data/manifest.json), [qualité](../public/data/quality.json), [batailles](../public/data/battles/coverage.json), [ressources](../public/data/resources/sites.json), [religions](../public/data/religions/history.json), [parcours](../public/data/stories.json), dossiers individuels sous `public/data/events/`.

Les catégories régionales sont celles du projet : l’Asie et le Moyen-Orient sont séparés. Les descriptions dénombrées sont les champs stockés dans les dossiers, pas les résumés Wikipédia récupérés à leur ouverture. Les dates des ressources mesurent les preuves encodées ; elles ne donnent pas une liste exhaustive des exploitations historiques.

## 1. Transformer les parcours en dossiers d’enquête — priorité immédiate

**Constat.** Le générateur de parcours compose actuellement des étapes « événement — date — lieu » (`pipeline/build/index.ts:466–481`). Le parcours napoléonien consulté en production suit ce format. Le schéma accepte des étapes limitées à `eventId` et `text` (`lib/schema.ts:347–352`).

**Proposition.** Partir d’une question et organiser six à huit chapitres explicatifs, avec accès à la chronologie détaillée existante. Chaque chapitre devrait distinguer :

- les faits retenus et leur contexte ;
- les acteurs et leurs possibilités d’action ;
- les conditions durables et les déclencheurs ;
- les changements et les continuités ;
- les conséquences pour plusieurs groupes ;
- les preuves et les interprétations discutées.

**Premier terrain possible.** Deux parcours existants, les conquêtes des empires aztèque et inca, permettraient de construire une enquête comparative sur les alliances, les contraintes, les décisions et les transformations. Les réponses devront être recherchées et relues ; la présence des deux chronologies ne suffit pas à les établir. Les acteurs autochtones et leurs divergences devront être étudiés explicitement.

**Critère de réussite.** Après lecture, un passionné peut formuler une explication appuyée sur plusieurs sources, identifier une différence entre les deux cas et préciser une limite de la comparaison.

**Réutilisation.** `StoryPanel`, navigation des étapes, fiches et carte. Protéger les futurs textes rédigés : le chemin `--refresh-editorial` supprime puis régénère les fichiers actuels (`pipeline/build/index.ts:488–500`).

## 2. Construire un espace de comparaison — priorité immédiate

**Constat.** Le store possède une seule année, une seule caméra et une sélection par type (`lib/store/index.ts:28`). On peut explorer successivement deux cas, mais on ne conserve pas une grille de comparaison commune.

**Proposition.** Épingler A et B, puis choisir ce que l’on compare :

| Question | Présentation adaptée | Précaution |
| --- | --- | --- |
| Que change un siècle dans une même région ? | Même cadrage, bascule entre deux dates, observations commentées | Date réelle et source de chaque géométrie visibles |
| Comment deux sociétés contemporaines sont-elles organisées ? | Deux dossiers, période commune, dimensions choisies | Ne pas présumer que les catégories sont équivalentes |
| Comment deux transformations suivent-elles des trajectoires différentes ? | Frises alignées sur leur début, dates absolues conservées | Ne pas confondre temps relatif et contemporanéité |
| Pourquoi deux sources dessinent-elles différemment un territoire ? | Même année, alternance des deux sources disponibles | Décrire méthode, couverture et incertitude |

Commencer par une carte alternant A/B et un tableau commun : acteurs, institutions, moyens matériels, réseaux, conséquences, preuves. Deux cartes simultanées pourront suivre si cette première version apporte une valeur mesurée.

**Critère de réussite.** Le lecteur conserve deux cas pendant son exploration et peut citer une ressemblance, une différence et une donnée non comparable. Une valeur absente reste « inconnue », distincte de zéro.

**Faisabilité.** Les dossiers et séries territoriales sont réutilisables. Deux instances de `WorldMap` demanderaient de séparer leurs états et leur cycle de vie ; copier simplement le composant couplerait les vues au store global et au protocole PMTiles partagé (`components/map/WorldMap.tsx:142`, `:977`, `:1014`).

## 3. Rattacher les preuves aux affirmations — priorité immédiate

**Constat.** Les fiches donnent déjà leurs sources. Le modèle générique de source reste succinct (`lib/schema.ts:10`) et l’alerte de divergence indique seulement plusieurs dates ou lieux (`components/panels/EventPanel.tsx:356`). Le normaliseur choisit une date et une coordonnée représentatives (`pipeline/normalize/index.ts:220–239`).

**Proposition.** Pour les dossiers pilotes, permettre l’ouverture de chaque affirmation importante : auteur ou institution, nature du document, date, page ou passage, objet exact de la preuve, limites, date de consultation. Distinguer une source primaire contextualisée, une synthèse scientifique et une notice communautaire. Une source primaire n’est pas automatiquement plus fiable pour toutes les questions.

Quand les données divergent, présenter les variantes et la justification du choix affiché. Une divergence entre propriétés Wikidata n’est pas automatiquement un débat entre historiens. Éviter les pourcentages de confiance sans méthode et la mise à égalité mécanique d’arguments inégalement étayés.

**Réutilisation.** `BattleQuantitySchema` possède déjà minimum, maximum, unité, périmètre, notes et sources (`lib/battles/schema.ts:12–44`). Les dates et relations biographiques conservent également des assertions sourcées. Étendre ces principes à l’explication et à la comparaison.

**Critère de réussite.** Le lecteur peut répondre à « d’où vient cette affirmation ? » et « que permet réellement de conclure cette source ? » sans devoir reconstituer seul toute la chaîne documentaire.

## 4. Clarifier les temporalités et la couverture — priorité immédiate

La même année commande actuellement trois opérations différentes :

| Couche | Signification effective |
| --- | --- |
| Événements | Fenêtre autour de l’année ; à l’arrêt, ±3 ans sauf période explicite (`lib/map-time.ts:12`) |
| Ressources | Connaissance cumulée jusqu’à l’année ou la fin de période ; les sites restent connus après fermeture (`lib/resources/time.ts:77`) |
| Religions | Attestations cumulées jusqu’à l’année ou la fin de période (`lib/religions/time.ts:10`) |
| Territoires | Observations selon intervalles ou instantanés de la source choisie |

Les libellés « Ressources connues » et « Attestations jusqu’en… » sont déjà visibles, y compris sur l’écran mobile inspecté. L’amélioration serait de rendre ces définitions directement disponibles dans les comparaisons et de permettre, lorsqu’on possède les preuves, des vues explicitement distinctes : connaissances acquises, exploitation documentée pendant la période, nouveaux jalons pendant la période. Une persistance religieuse contemporaine demanderait d’autres données.

Ajouter une fiche de couverture par région et période : notices, champs renseignés, précision géographique et temporelle, sources et langues. Les comptes de points et la carte de chaleur ne doivent pas devenir des mesures automatiques de violence, de richesse ou de puissance.

Le filtre « Importance minimale » mérite une formulation pédagogique : le score correspond à une priorité d’affichage, avec jusqu’à 55 points issus du nombre de sitelinks (`pipeline/score/index.ts:15`). Expliquer ce choix et proposer une sélection éditoriale justifiée évitera de présenter la visibilité documentaire comme une mesure universelle d’importance historique.

## 5. Donner une lecture mondiale simultanée — priorité suivante

**Proposition.** Une vue « Au même moment » dans laquelle le lecteur choisit trois régions, une période commune et quelques thèmes. Afficher des chronologies parallèles, avec quelques explications et des connexions explicitement documentées. Une simple contemporanéité doit rester distincte d’une interaction.

La frise actuelle attribue des poids différents aux époques (`lib/eras.ts:205`). Pour comparer des durées, proposer une échelle linéaire avec unité visible. Les repères « Moyen Âge » ou « 1492 » peuvent rester des outils de navigation choisis ; offrir parallèlement des repères régionaux évite d’en faire une périodisation universelle.

**Critère de réussite.** Le lecteur sait replacer son dossier dans un contexte plus large, identifier des transformations simultanées et dire lesquelles sont reliées par les sources.

## 6. Expliquer les réseaux et les échanges — priorité suivante

**Constat.** Des mines, des étapes religieuses et des territoires sont présents, mais leur superposition n’explique ni transport, ni circulation, ni transmission. Le modèle religieux dispose pourtant déjà de mécanismes comme commerce, migration, patronage, diaspora et réforme (`lib/religions/types.ts:23–38`).

**Proposition.** Un premier dossier « Comment biens, savoirs et croyances circulent-ils ? », limité à un espace et une période documentés. Associer quelques lieux, acteurs, produits, techniques et institutions ; chaque relation doit posséder une date ou intervalle, une justification et une source.

Autres candidats à documenter : les réseaux de l’océan Indien, les échanges transsahariens, la circulation du papier et de l’imprimerie, ou une chaîne de production et d’échange autour d’un site déjà présent. Le programme des Routes de la soie de l’UNESCO fournit un point de départ éditorial sur les échanges matériels et culturels ; sa présentation ne constitue pas un réseau SIG prêt à importer. [UNESCO — About the Silk Roads](https://www.unesco.org/en/silk-roads/about-silk-roads).

**Garde-fou.** Une ligne entre deux points peut représenter une relation schématique, une succession ou un trajet attesté. Son apparence et son libellé doivent préciser laquelle.

## 7. Introduire les vies ordinaires et les structures sociales — priorité suivante

Les types centraux sont tous militaires ou diplomatiques (`lib/types.ts:1–9`). Les dossiers de personnes proviennent principalement des participants militaires et des fonctions politiques. Pour comprendre les sociétés, compléter ce cadre par quelques microhistoires localisées : se nourrir, travailler, se déplacer, payer l’impôt, apprendre, pratiquer une religion, vivre une transformation politique.

Un dossier pourrait suivre un lieu sur plusieurs générations et distinguer ce qui change pour les cultivateurs, les artisans, les commerçants, les élites, les femmes ou les personnes asservies, selon les preuves disponibles. Inclure des acteurs collectifs et des objets, pas seulement des biographies de figures célèbres. Éviter d’inventer une personne pour incarner des statistiques collectives.

Population, urbanisation, alimentation, énergie, travail et institutions peuvent devenir des dimensions comparatives. Les indicateurs doivent conserver définition, unités, période, zone et incertitude. La base Seshat propose notamment des variables sociales et démographiques ainsi qu’une méthode de traitement des désaccords ; toute intégration devrait examiner sa couverture et son appariement au corpus local. [Seshat — méthodes](https://www.seshat-db.com/methods/), [Seshat — variables](https://www.seshat-db.com/variable-hierarchy/). Ces pages ont été repérées par leurs extraits indexés ; leur contenu intégral était inaccessible à l’outil pendant l’audit.

## 8. Étendre progressivement le temps long — chantier distinct

La limite interne `MIN_YEAR = -3500` correspond à 3501 avant notre ère avec la convention astronomique utilisée (`lib/eras.ts:3`). Elle laisse hors du projet des dimensions indispensables à une ambition couvrant toute l’histoire humaine : peuplements anciens, domestications, sédentarisation, transformations environnementales et premiers foyers urbains.

Prévoir une vue du temps long séparée, avec échelles adaptées, intervalles de datation, zones approximatives et hypothèses discutées. Les migrations préhistoriques ne doivent pas prendre la forme de trajets précis arbitraires. Le Smithsonian offre un exemple de présentation qui associe évolution humaine, climat et jalons documentés. [Smithsonian — Human Evolution Interactive Timeline](https://humanorigins.si.edu/evidence/human-evolution-interactive-timeline).

Ce chantier demande un corpus et une représentation adaptés. Il ne se résume pas à diminuer la constante minimale de la frise.

## 9. Aider un passionné à poursuivre son enquête

Deux améliorations complémentaires :

- **Recherche par problème et thème.** Ajouter un vocabulaire éditorial limité : administration, ravitaillement, travail, échanges, migrations, transmission, transformations institutionnelles. La recherche couvre déjà événements, territoires, personnes, religions et campagnes ; les ressources et parcours ne sont pas des types de résultat (`lib/search-records.ts:5`). Commencer par indexer les dossiers réellement annotés.
- **Carnet personnel.** Épingler vues, dossiers, références, comparaisons et notes ; export et reprise locale, sans compte nécessaire pour une première version. Distinguer notes personnelles et contenu éditorial. Les URL savent déjà conserver une grande partie du contexte ; compléter la sélection précise d’un site ou d’un jalon religieux et le filtre de ressource, actuellement absents du sérialiseur (`lib/store/index.ts:258`, stores des ressources et religions).

Pour l’interface française, concentrer le premier travail éditorial sur les dossiers pilotes : descriptions, lieux, concepts et résumés cohérents. Le repli en anglais doit rester identifiable. La traduction d’une interprétation historique mérite la même relecture que sa version initiale.

## Socle technique proposé

Conserver l’export statique et les modèles spécialisés. Ajouter progressivement :

1. Des références typées vers événement, personne, territoire, site, jalon religieux, source ou dossier ; une étape de récit ne serait plus obligatoirement un événement QID.
2. Des relations sourcées dont la nature est explicite : appartenance, transmission, contexte ou interprétation argumentée. La proximité géographique ou chronologique n’en crée aucune automatiquement.
3. Un état comparatif A/B sérialisable, puis un carnet local.
4. Des index cartographiques légers et des détails chargés à la sélection.

Le dernier point compte avant d’ajouter des vues simultanées. `public/data/resources/sites.json` pèse actuellement 31 081 892 octets bruts, environ 1,3 à 1,4 Mo gzip selon le niveau de compression ; il est téléchargé et validé intégralement à l’ouverture de la couche (`lib/resources/client.ts:6`). Les événements montrent déjà comment séparer index et dossiers. La mesure de taille n’est pas une mesure actuelle de temps de chargement ; les anciens rapports de performance ne doivent pas être présentés comme tels.

Sur téléphone, privilégier l’alternance des cas et une lecture structurée. La vue inspectée de 390 × 844 conserve une carte lisible avec carnet replié, mais les couches passent par une rangée horizontale et les commandes restent nombreuses. Des ensembles de couches adaptés à la question étudiée et un mode lecture simplifieraient l’analyse. Cela reste une hypothèse d’usage à tester, pas un défaut d’accessibilité établi.

## Ordre conseillé et effort relatif

S = changement limité ; M = plusieurs composants ou modèles ; L = nouveau corpus ou sous-système. Ces niveaux ne constituent pas une estimation calendaire. La recherche et la relecture peuvent dominer le coût du développement.

| Lot | Livrable | Technique | Recherche / édition | Condition pour élargir |
| --- | --- | --- | --- | --- |
| 1 | Deux dossiers d’enquête comparables, puis un troisième transversal | M | L | Les lecteurs peuvent expliquer et citer leurs preuves |
| 1 | Sources par affirmation, variantes, unités et limites | M | M/L | Les affirmations centrales sont traçables et relues |
| 1 | Comparaison A/B, tableau commun, vues sauvegardables | M | M | Les comparaisons restent compréhensibles avec des données absentes |
| 1 | Définitions temporelles et couverture au point de comparaison | S/M | M | Le lecteur distingue stock d’attestations et activité pendant une période |
| 2 | Index thématiques légers, recherche des ressources et dossiers | M | S/M | Ouverture et lecture vérifiées sur téléphone physique |
| 2 | Au même moment ; repères régionaux et frise linéaire | M | M/L | Les liens et les simples contemporanéités restent distincts |
| 2 | Premier réseau d’échanges et microhistoire sociale | M | L | Sources, limites et acteurs collectifs documentés |
| 3 | Temps long, données démographiques plus larges, doubles cartes | L | L | Besoin confirmé par l’usage des premiers dossiers |

Je commencerais par le lot 1 en réduisant le corpus pilote à ce qui peut être correctement documenté. Les deux cas existants cités plus haut offrent une entrée comparative ; le troisième dossier devrait sortir du seul cadre militaire, par exemple une diffusion religieuse liée à des échanges documentés.

## Comment vérifier le progrès pédagogique

Faire lire les pilotes à cinq à huit passionnés pour une première étude qualitative, sans prétention statistique. Observer leur raisonnement sur quelques tâches :

1. Expliquer deux facteurs d’une transformation et citer les passages qui les étayent.
2. Formuler une similitude et une différence entre les deux cas, puis une limite de cette comparaison.
3. Distinguer découverte d’une ressource, exploitation documentée et connaissance conservée après fermeture.
4. Distinguer attestation religieuse et adhésion d’une population à une date.
5. Retrouver une divergence de source et expliquer pourquoi la carte affiche une version donnée.
6. Revenir à une comparaison sauvegardée et partager ses références sans perdre le contexte.

Les erreurs récurrentes, les moments de confusion et la capacité à retrouver les preuves seront plus instructifs qu’un simple temps passé ou un nombre de clics. Pour le développement : contrôler liens et identités, références, restauration des états A/B, données manquantes, clavier et petits écrans.

Cette orientation rejoint les dimensions du Historical Thinking Project : preuves, changement et continuité, causes et conséquences, perspectives historiques. Le cadre sert ici à formuler des objectifs ; il ne prouve pas à lui seul l’efficacité des interfaces proposées. [Historical Thinking Project — concepts](https://www.historicalthinking.ca/historical-thinking-concepts), [causes et conséquences](https://www.historicalthinking.ca/cause-and-consequence).

## Décisions à différer

L’ajout massif de nouvelles notices, la multiplication des scènes 3D, un classement global des civilisations, une simulation contrefactuelle ou un assistant donnant des explications non traçables n’aideraient pas directement à valider les priorités ci-dessus. La 3D existante reste pertinente pour comprendre les ordres de grandeur documentés, à condition de conserver sa qualification illustrative.

Le premier investissement devrait rendre quelques questions historiques réellement explorables de bout en bout : problème, contexte, faits, interprétations, comparaison et preuves.
