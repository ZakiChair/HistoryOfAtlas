# Vérification d’Atlas Belli

Les assertions historiques des tests de navigation utilisent les fichiers du pipeline : l’événement de Waterloo est recherché dans le lot du XIXe siècle, et la campagne est choisie dans le catalogue produit. Les quelques objets synthétiques des tests unitaires vérifient uniquement des contrats logiciels ; ils ne sont jamais distribués dans le corpus.

## Dossiers de batailles et de personnes — 21 septembre 2026

Le corpus enrichi contient **20 415 notices**, dont 20 037 événements datés et géolocalisés, **11 364 personnes** et **22 066 fonctions**. Les 24 972 liens événement/personne sont validés dans les deux sens avec le même identifiant d’assertion, le même rôle et la même propriété source. Les 1 405 catalogues politiques passent également leur schéma. La commande `pnpm data:check` effectue ce contrôle sans dépendre du cache brut ni du réseau. La reconstruction hors ligne produit 35 353 fichiers identiques ; son empreinte est conservée dans `data/reports/idempotence.json`.

Les contrôles de domaine couvrent les calendriers, les dates approximatives ou contradictoires, les limites de vie incompatibles et les périodes de juridiction des fonctions. L’audit indépendant rapproche 2 749 dates de 637 biographies de leurs assertions brutes. Les 295 assertions écartées restent consultables dans le rapport d’enrichissement ; aucun mandat ou lien de commandement n’est complété par supposition. Le registre territorial vérifie explicitement 26 observations et exclut les correspondances ambiguës.

Les nouveaux scénarios navigateur contrôlent la navigation bataille → commandant → retour, les biographies ouvertes depuis un territoire, les liens profonds bilingues, l’absence de téléchargement des biographies avant sélection, l’attribution des résumés Wikipédia et la conservation du focus clavier. La réponse Wikipédia utilisée pour rendre le test reproductible est une capture réelle et attribuée dans `tests/fixtures/wikipedia/`. Le chargement du résumé a aussi été observé directement avec l’API publique pour une bataille et une personne.

La version finale passe **193 tests Vitest, 9 tests Python et 56 tests E2E**. La suite navigateur complète utilise SwiftShader, un seul worker et les profils ordinateur et Pixel 7 émulé ; elle se termine sans échec ni nouvelle tentative en 6,6 minutes. Les six scénarios de lecture automatique contrôlent toujours les polygones effectivement rendus. Les tests clavier ont d’abord reproduit deux défauts : le focus perdu après une sélection déjà en cache, puis la fermeture de la fiche derrière la recherche lors d’un appui sur Échap. Leurs assertions passent après correction, en conservant aussi le paramètre `person` dans l’URL.

TypeScript, ESLint et l’export de 5 496 pages réussissent. La coque initiale mesure **253 182 octets gzip** ; cette mesure exclut toujours le moteur cartographique et les biographies différés. Le rapport `data/reports/dossiers-verification.json` conserve le protocole, le corpus et les empreintes des fichiers contrôlés.

Les résultats des versions précédentes restent datés dans les sections suivantes ; ils ne constituent pas une nouvelle mesure Lighthouse ou matérielle de cet enrichissement.

## Correction de la lecture automatique

Le scénario de régression 1785 → 1945 reproduisait un curseur en mouvement alors que les archives territoriales de 1800 et 1900 ne devenaient pas visibles pendant la lecture. L’instrumentation relevait **489 appels de rechargement en 11 secondes** : les mises à jour successives relançaient le travail des sources avant qu’un rendu puisse être présenté. Les traces CI signalaient aussi des tentatives de modification de couches territoriales déjà supprimées. Ces observations expliquent pourquoi mesurer uniquement la progression du curseur ou les callbacks d’animation ne suffisait pas.

Le correctif conserve une seule mise à jour cartographique en cours et la dernière année reçue, puis attend un rendu terminé avant de poursuivre. L’horloge attend également les sources : sans cette coordination, le rendu logiciel présentait encore les frontières de 1850 lorsque le curseur atteignait 1911. La vitesse choisie devient une cible maximale, réduite par la densité documentaire et la disponibilité du rendu. L’attente ne s’accumule pas en années à rattraper. Les sauts manuels et la pause restent prioritaires. Le retrait des anciennes sources protège les callbacks réentrants ; la publication du carnet s’appuie également sur le rendu, sans attendre uniquement `idle`. L’URL utilise désormais une cadence de 250 ms avec le dernier état, une écriture immédiate à la pause et l’annulation des écritures différées lors du retour historique ou du démontage. Son test a d’abord reproduit une URL bloquée en 1800 après une progression jusqu’en 1900, puis est passé au vert.

La vérification finale passe **144 tests unitaires et 44 tests E2E**, dont six régressions de lecture sur ordinateur et mobile : passage des archives de 1800, 1850 et 1900 sur le globe, changement d’ère de 1492 en Mercator et passage de l’année astronomique zéro. Les tests lisent les polygones effectivement rendus et leurs intervalles sources avant toute pause. La suite complète avec SwiftShader, un seul worker, passe en 5,2 minutes. Le délai fonctionnel de lecture tient compte de l’attente du rendu ; les budgets de performance restent séparés. Les résultats et empreintes des fichiers sont dans `data/reports/playback-verification.json`.

L’export produit **5 496 pages**. Le JavaScript initial représente **252 453 octets gzip**, pour la coque de l’interface ; le moteur cartographique différé se mesure séparément. Les résultats des passages précédents ci-dessous restent associés à leurs révisions et protocoles.

Un contrôle réseau injecte une réponse 404 après 3,5 secondes pour l’archive territoriale de 1800. L’année reste 1800 pendant l’attente, puis la lecture reprend après l’erreur. Un saut manuel vers 1851 charge ensuite l’archive de 1850. Aucune exception JavaScript n’est relevée ; les avertissements HTTP attendus restent visibles. Les erreurs de source réveillent la vérification du rendu ; une carte retirée ou indisponible libère son verrou.

## Commandes reproductibles

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm preview
pnpm test:e2e --workers=1
# Benchmark séparé : GPU natif par défaut, un seul worker, mêmes seuils stricts.
pnpm test:performance
# Comparaison explicite avec le rendu logiciel, dont les échecs sont conservés :
PLAYWRIGHT_GPU=software pnpm test:performance
```

Le serveur d’aperçu doit servir le répertoire `out`. Le lanceur Playwright démarre `pnpm preview` si aucun serveur ne répond ; `PLAYWRIGHT_BASE_URL` permet de viser explicitement un autre déploiement. Les régressions fonctionnelles sont dans `tests/e2e`, le benchmark dans `tests/performance`, avec sa configuration `playwright.performance.config.ts`. Le rapport fonctionnel est `playwright-report`, le rapport matériel `performance-report` : une exécution ne remplace pas le résultat de l’autre. Les mesures graphiques s’exécutent sans autres tests concurrents pour éviter que plusieurs contextes WebGL se disputent les mêmes ressources.

## Contrats vérifiés

- Dates astronomiques : absence d’année historique zéro dans le formatage, distinction Wikidata JSON/RDF, respect de la précision, calendriers julien et grégorien, rejet des précisions plus grossières que le schéma.
- Données : provenance obligatoire, coordonnées et durées valides, étapes chronologiques des campagnes, retry des lectures interrompues, réutilisation des téléchargements, chargement des seules tranches temporelles nécessaires.
- Navigation : changement d’année au clavier et saisie avant notre ère, ouverture d’une fiche sourcée, recherche approchée, restitution de la vue par URL, traduction, campagne et tiroir mobile.
- Parcours : territoire choisi parmi les polygones réellement rendus, graphe des observations sourcées, suivi et arrêt ; récit choisi dans le catalogue, progression de l’année, ouverture explicite d’une fiche puis restauration du chapitre après recharge mobile. Les états `follow=1` et `cplay=1` distinguent le suivi territorial et la lecture d’une campagne de la lecture temporelle générale.
- Frontières : le test compare les identifiants issus de `queryRenderedFeatures` avant et après un changement d’année. Un simple changement du libellé de l’année ne peut pas satisfaire cette assertion.
- Accessibilité : axe analyse les règles WCAG A/AA 2.0, 2.1, 2.2 et les bonnes pratiques sur l’atlas, la recherche et une fiche mobile. Le test clavier vérifie aussi le retour du focus après fermeture de la recherche.
- Fluidité : une collecte de six secondes mesure la cadence `requestAnimationFrame` pendant la lecture temporelle et conserve le nom du moteur graphique. Les seuils sont 30 images/s en moyenne et 33,83 ms au 95e percentile.

## Interprétation des mesures

La configuration fonctionnelle emploie SwiftShader pour rendre WebGL reproductible dans une CI sans GPU. Le benchmark utilise le GPU natif par défaut : ANGLE/Metal sur macOS, moteur natif disponible sur les autres systèmes. `PLAYWRIGHT_GPU=native` ou `PLAYWRIGHT_GPU=software` permet un choix explicite pour les deux configurations. Une mesure obtenue avec SwiftShader caractérise le rendu logiciel ; elle ne prouve pas la performance sur un ordinateur portable avec GPU. Le résultat doit toujours être accompagné du moteur graphique enregistré. Une cadence `requestAnimationFrame` est un indicateur de réactivité du navigateur, pas un comptage garanti des images GPU effectivement présentées. Le benchmark conserve les seuils de 30 images/s et de 33,83 ms au 95e percentile ; aucune dérogation ne masque un résultat insuffisant sur un moteur donné.

Un audit axe sans anomalie ne constitue pas à lui seul une certification WCAG : l’ordre de lecture, la pertinence des descriptions, la navigation avec un lecteur d’écran et l’usage tactile réel demandent aussi une revue manuelle. Les budgets Lighthouse doivent être mesurés sur l’export de production, jamais sur le serveur Next.js de développement.

## Régressions identifiées lors de la revue

La revue a ajouté des assertions concernant deux cas qui échappaient aux premiers parcours : un identifiant `Q0` ne doit provoquer aucune requête, et un numéro d’étape hors limites doit être ramené à l’étape réellement affichée. Elle a également signalé l’absence initiale des participants dans les propriétés vectorielles, les changements de langue des labels cartographiques, et la restauration d’un conflit depuis un lien profond.

Les rapports Playwright contiennent les traces et captures d’échec, les anomalies axe en JSON et le relevé de cadence par navigateur. Les résultats observés doivent être associés à la révision testée et à la volumétrie effective du corpus, qui peuvent évoluer indépendamment du code de l’interface.

## Mesure logicielle du 20 septembre 2026

Export de production servi sur `localhost:3000`, corpus de 5 590 événements, un seul worker Playwright, Chromium avec `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)`.

| Profil        | Images mesurées | Cadence moyenne | Intervalle au 95e percentile | Seuil de 30 images/s |
| ------------- | --------------: | --------------: | ---------------------------: | -------------------- |
| Ordinateur    |              31 |   5,11 images/s |                    566,70 ms | Non atteint          |
| Pixel 7 émulé |              30 |   4,40 images/s |                    866,60 ms | Non atteint          |

Cette première suite complète obtient 20 succès sur 24 : les six audits axe, la recherche, les dates, la fiche sourcée, la langue, le tiroir mobile, les frontières rendues et la restitution de l’URL passent. Deux échecs concernent la fluidité ci-dessus. Le parcours de campagne a aussi révélé que l’ouverture automatique d’une fiche masquait les commandes sur mobile ; sa correction conserve désormais les commandes et propose l’ouverture de la fiche explicitement. L’assertion de campagne vérifie l’étape effectivement arrêtée, son année et sa source, car une étape supplémentaire peut être parcourue pendant une interaction lente.

Ces résultats ne valident ni le budget de 50 000 événements ni celui d’un ordinateur portable moyen. Le corpus et le matériel effectivement mesurés sont conservés pour permettre une comparaison honnête avec les essais suivants.

## Mesure matérielle du 20 septembre 2026

Même corpus et même protocole de six secondes, avec `PLAYWRIGHT_GPU=native` : moteur `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Max, Unspecified Version)`.

| Profil        | Images mesurées | Cadence moyenne | Intervalle au 95e percentile | Seuil de 30 images/s |
| ------------- | --------------: | --------------: | ---------------------------: | -------------------- |
| Ordinateur    |             359 | 60,003 images/s |                     16,70 ms | Atteint              |
| Pixel 7 émulé |             359 | 60,002 images/s |                     16,80 ms | Atteint              |

Les 24 scénarios initiaux passent sur ce moteur. Les deux scénarios supplémentaires du filtre par participant passent après correction de leur sélecteur de test : le champ est identifié par son rôle et son nom accessibles. La campagne conserve ses commandes sur mobile et le test vérifie l’année et le libellé de l’étape arrêtée. Les six audits ont ensuite été étendus à WCAG 2.2 AA, aux bonnes pratiques et à la règle expérimentale de cohérence entre libellé visible et nom accessible. Ce passage étendu est désormais vert après correction du raccourci de recherche, des sélecteurs de langue, des liens tactiles et de la hiérarchie de titres. Les deux tests supplémentaires de lien de campagne hors limites passent également.

Après séparation des configurations, `pnpm test:performance` passe sur les deux profils natifs avec les mêmes seuils. La pièce jointe `frame-measurement` contient aussi le nombre d’événements, la date de construction du corpus et les années de début et de fin de lecture ; le test exige une progression temporelle effective pendant la mesure.

Le chemin CI a également été vérifié séparément : `pnpm test:e2e --workers=1`, sans option GPU, passe les 26 tests fonctionnels avec SwiftShader en 1,6 minute. Ce résultat comprend les six audits étendus et les deux liens de campagne hors limites. Il ne transforme pas le rendu logiciel en preuve de performance : ses mesures insuffisantes restent consignées dans la section précédente.

Le M4 Max est un GPU puissant. Ces résultats montrent que la limitation SwiftShader est propre au rendu logiciel, mais ne suffisent pas à établir le budget sur un ordinateur portable moyen ou sur un téléphone physique. Le profil Pixel 7 émule le viewport et les entrées ; il utilise toujours le GPU du Mac hôte.

## Lighthouse : méthode de ralentissement

La configuration finale emploie `throttlingMethod: devtools`, avec les valeurs mobiles standard de Lighthouse : réseau « Slow 4G » et ralentissement CPU ×4. Le ralentissement est appliqué pendant la capture ; il ne s’agit pas d’une extrapolation d’une trace non ralentie. La distinction est documentée par [Lighthouse](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md). Les résultats dépendent toujours du matériel et du pilote graphique.

Avant les corrections de chargement, la simulation Lighthouse a donné P32/A96/SEO100 avec SwiftShader, puis P37/A96/SEO100 avec Metal. Après correction du premier rendu, chargement différé de la liste hors écran et corrections d’accessibilité, un passage mobile DevTools sur Metal donne P94/A100/SEO100 : FCP et LCP 1,6 s, blocage total 180 ms. La page Méthodologie donne P100/A100/SEO100. Ces passages exploratoires ne remplacent pas les trois exécutions du bilan final sur le corpus final. Les changements de code et de méthode empêchent d’attribuer tout le gain à un seul facteur.

## Carte complète et budget de transfert

La mesure dédiée ne confond pas l’apparition du texte et la disponibilité des territoires. Sur le lot de 5 590 événements, un passage à 1,6384 Mbit/s, latence de 150 ms et CPU ×4 a observé les premiers territoires effectivement rendus après 9 757,5 ms. Le JavaScript total reçu jusque-là, moteur et workers compris, représente 669 792 octets gzip ; la coque HTML initiale représente 251 656 octets gzip. Ainsi, le budget de 300 Ko est respecté pour les scripts initiaux de la coque, mais pas pour l’ensemble des scripts nécessaires à la carte. Le délai de 3 s n’est pas atteint par la carte complète sur ce profil lent. Un bon score Lighthouse ne suffit pas à certifier ce délai cartographique.

Ces mesures sont reproductibles avec `pnpm measure:bundle` et `pnpm measure:runtime -- --slow-4g`. Les rapports détaillent chaque script et le protocole dans `data/reports/`. Le passage renouvelé sur la publication finale et Nginx figure ci-dessous.

`PLAYWRIGHT_BASE_URL` permet de mesurer le serveur Nginx du conteneur avec les mêmes scripts, y compris `pnpm audit:lighthouse`. Le relevé de démarrage conserve aussi le volume des corps de réponses réellement transférés, après compression HTTP et avant les premiers territoires : tuiles, scripts, fontes et autres ressources. Il est distinct de la recompression gzip de chaque script utilisée pour comparer le budget de JavaScript.

## Vérification finale du corpus publié

L’export final contient 20 037 événements (manifeste du 20 septembre 2026 à 12:41:25 UTC), 40 campagnes et 10 parcours. La suite fonctionnelle complète passe **38 tests sur 38** avec SwiftShader, en 3,2 minutes, sur les profils ordinateur et mobile. Elle vérifie notamment que la navigation ordinaire télécharge les archives temporelles, que les guerres incluent leurs batailles imbriquées dans des campagnes, et que le clustering reçoit effectivement un point visible omis par la requête globale de MapLibre en projection globe. Le test répète ce contrôle après les bascules Mercator et globe.

Les six audits axe étendus passent. Les régressions de reprise du suivi territorial, de la lecture des campagnes et du retour au chapitre d’un récit après fermeture d’une fiche sont également couvertes. Le suivi territorial restauré s’arrête à la dernière observation sourcée ; la lecture d’une campagne s’arrête lorsque son contexte est quitté.

Le benchmark matériel final passe les deux profils avec ANGLE/Metal sur Apple M4 Max : 359 intervalles mesurés par profil, 60,002 images/s et 16,70 ms au 95e percentile sur ordinateur ; 60,003 images/s et 16,70 ms sur le profil Pixel 7 émulé. La lecture progresse de 1800 à 1942 durant les six secondes de mesure. Les limites matérielles exposées plus haut restent applicables : ce résultat ne certifie ni un téléphone physique, ni un ordinateur portable moyen, ni un corpus de 50 000 événements.

## Reconstruction complète et déploiement local

La commande littérale `pnpm data:build`, relancée avec le cache brut intact le 20 septembre 2026, réussit en 66 secondes, sans nouvelle acquisition. Les **24 352 fichiers** distribués (22 582 pour les événements, 1 770 pour la géographie) sont identiques octet pour octet avant et après cette exécution. Les empreintes, horaires et comptes sont conservés dans `data/reports/full-build-verification.json` et `data/reports/idempotence.json`. Cette mesure vérifie la reconstruction déterministe avec le même cache source et les mêmes versions d’outils ; elle ne prétend pas mesurer la durée d’un nouveau téléchargement de tout Wikidata.

L’export de production génère 5 496 pages. TypeScript strict, ESLint, 130 tests Vitest et 7 tests Python de géographie passent. Le conteneur Docker a été construit et servi localement sur le port 18080, sans déploiement public. Les contrôles Nginx couvrent le code HTTP des pages et erreurs, les redirections, l’image Open Graph, la compression des scripts et leur type MIME, ainsi que 64 archives PMTiles : chaque demande des 127 premiers octets reçoit un `206 Partial Content` sans compression additionnelle. Le rapport `data/reports/docker-verification.json` identifie l’image effectivement vérifiée.

Le chargement de la liste du panneau d’accueil se fait désormais avec le bouton « Voir les événements de cette période ». Une simple observation de visibilité provoquait une course au démarrage : la liste était visible avant le chargement des territoires, puis repoussée hors écran. Le test réseau conserve l’invariant d’absence de téléchargement des chunks détaillés avant la consultation, y compris sur le viewport 1440 × 960 utilisé par la mesure de démarrage. La vue liste générale reste accessible directement.

La vérification a été renouvelée sur le commit `299cad7` après remplacement du déclenchement automatique de la liste par un bouton explicite. Sur 1440 × 960 et sur le profil mobile, aucun fichier `/data/chunks/` n’est demandé au démarrage, ni lorsque le bouton arrive à l’écran : seul son clic charge les données. Le premier essai a reproduit la course initiale : avant l’arrivée des territoires, un emplacement vide de 96 px était visible et déclenchait six archives, puis se retrouvait hors écran après le rendu des frontières. Les 38 scénarios et les deux benchmarks passent avec le correctif final.

## Démarrage final sur Nginx

Sur le commit `299cad7a`, le corpus de 20 037 événements et Nginx avec gzip niveau 6, la mesure finale emploie le même profil : 1,6384 Mbit/s descendant, 750 kbit/s montant, latence de 150 ms, CPU ×4, viewport 1440 × 960, ANGLE/Metal sur Apple M4 Max. L’URL fixe explicitement 1812 et désactive donc l’introduction. Le premier événement contenant des territoires effectivement rendus survient après **9 221,9 ms**.

| Mesure                                               |         Résultat | Réception                                          |
| ---------------------------------------------------- | ---------------: | -------------------------------------------------- |
| JavaScript de la coque initiale, gzip                |   252 011 octets | Budget de 300 000 octets respecté pour cette coque |
| JavaScript complet jusqu’à la carte, gzip            |   670 543 octets | Dépasse 300 000 octets                             |
| Premiers territoires rendus                          |           9,22 s | Dépasse 3 s sur ce profil lent                     |
| Corps des réponses transférées avant ces territoires | 1 425 181 octets | Mesure HTTP réelle, tous types de ressources       |
| Dont archives PMTiles                                |   647 532 octets | Lectures partielles des archives temporelles       |
| Dont JSON et autres requêtes fetch                   |    21 116 octets | Aucun chunk détaillé de la liste au démarrage      |

Le passage précédent, avec préchargement transitoire de la liste et gzip au niveau par défaut, mesurait 14 365,9 ms et 2 513 202 octets transférés. Les deux corrections réduisent le temps mesuré d’environ 36 % et le transfert d’environ 43 %. Un seul passage ne caractérise pas toute la variabilité du réseau ; les budgets non atteints restent signalés comme tels dans `data/reports/runtime-slow-4g.json`. La cadence de navigation à 60 images/s ne compense pas ce délai de démarrage.

## Lighthouse final sur Nginx

Sur le même commit `299cad7a`, le même corpus et le conteneur avec gzip niveau 6, les **six audits finaux passent**. Chaque page est mesurée trois fois, sans test graphique concurrent, avec ralentissement mobile DevTools et CPU ×4 sur ANGLE/Metal Apple M4 Max.

| Page          | Performance médiane | Accessibilité médiane | SEO médian |
| ------------- | ------------------: | --------------------: | ---------: |
| Atlas         |              **93** |               **100** |    **100** |
| Méthodologie  |             **100** |               **100** |    **100** |
| Seuil demandé |                  85 |                    95 |         95 |

Les trois scores de performance de l’atlas sont 92, 93 et 93 ; son LCP est compris entre 1 505 et 1 544 ms. Ces résultats, leurs heures et leur protocole sont dans `data/reports/lighthouse.json`. Ils remplacent les scores exploratoires pour la réception de cette révision. Ils mesurent l’expérience selon les métriques Lighthouse : le temps jusqu’aux premiers territoires, mesuré séparément à 9,22 secondes sur le profil documenté, reste supérieur au budget demandé.

Le bilan structuré `data/reports/acceptance.json` distingue les critères mesurés réussis, les budgets non atteints et les essais matériels restant non vérifiés. Le dépôt ne présente pas une réception complète de tous les critères du cahier des charges.
