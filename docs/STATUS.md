# État vérifié de réalisation

## Phase 0 — socle

Commit `179c1cd`. Architecture, Next.js statique, TypeScript strict, dates astronomiques, schéma Zod et état URL. Compilation et tests de domaine réussis. Le périmètre prioritaire est l’évolution réelle des polygones territoriaux, conformément à la précision de l’utilisateur.

## Phase 1 — pipeline et premier lot

Commit `06da828`. Le premier jalon contenait 5 590 événements datés et géolocalisés, 1 352 notices de contexte, chaque événement avec QID et provenance. L’acquisition était encore partielle à ce jalon ; l’objectif de 20 000 n’était alors pas déclaré atteint. Les vérifications comprenaient 46 tests Vitest, TypeScript, ESLint et un export de 2 975 routes.

La publication finale contient **20 037 événements datés et géolocalisés**, tous avec un QID unique et une provenance, 378 notices de contexte, 240 QID éditoriaux, 40 séquences chronologiques et 10 parcours. Le rapport `data/reports/quality.json` porte désormais `complete-acquisition` pour la sélection de sources interrogée ; cela ne signifie pas que toute l’histoire militaire est couverte.

Le pipeline inclut acquisition et reprises, cache brut, normalisation, déduplication, score, contrôle des dates et des coordonnées, contrôle mer/terre avec tolérance côtière, rapports, recherche partitionnée, fiches individuelles et 61 archives PMTiles temporelles. Les 4 699 relations écartées sont consignées indépendamment des événements : certaines sont hors périmètre militaire, sans date exploitable ou incompatibles avec les intervalles sourcés. La publication prépare un répertoire complet avant remplacement, avec restauration en cas d’échec ; les deux renommages ne garantissent pas une absence totale d’interruption aux lecteurs concurrents. Les artefacts reconstruits sont identiques octet pour octet avec le même cache source et les mêmes versions d’outils.

## Phases 2 à 6 — atlas intégré

Commit `299cad7`. Les surfaces ont été développées en parallèle puis intégrées ensemble : globe/Mercator, véritables polygones datés, frise non linéaire, lecture, filtres, recherche dans un Worker, fiches sourcées, campagnes chronologiques, entités et observations de superficie, parcours, URL, FR/EN, thèmes, mobile et accessibilité. Ce jalon regroupe plusieurs phases du plan initial dans un commit d’intégration.

Les frontières principales proviennent de **13 380 observations Cliopatria pour 1 583 entités**, réparties dans 39 archives temporelles. Les 50 instantanés Historical Basemaps constituent une seconde source sélectionnable. Natural Earth fournit le contexte physique. Les sources, licences, révisions et archives correspondantes accompagnent la publication.

Les tests navigateur contrôlent les territoires effectivement rendus avant et après changement d’année, la restauration des liens profonds, les campagnes, les récits et les deux langues. La revue a corrigé le worker MapLibre 6, les transitions entre archives, la rétention des labels historiques et les omissions de la requête globale en projection globe. La navigation ordinaire utilise les archives temporelles ; la liste charge ses données lorsqu’elle est consultée.

## Phase 7 — export, déploiement et réception

L’export statique génère **5 496 pages**, dont 3 878 événements et 1 610 guerres, avec métadonnées, sitemap et Open Graph. Docker/Nginx, CI fonctionnelle, audits d’accessibilité et benchmark GPU séparé sont disponibles. Le conteneur local a été construit et vérifié. Le site est publié sur [atlas-belli.vercel.app](https://atlas-belli.vercel.app) et le code sur [GitHub — ZakiChair/atlas-belli](https://github.com/ZakiChair/atlas-belli).

Les commandes, résultats, profils matériels et limites mesurées sont dans [QA.md](QA.md) et `data/reports/`. Les contrôles de compilation, les 130 tests unitaires TypeScript et les 7 tests de géographie Python passent. Les 38 tests navigateur, dont six audits axe, passent. Les médianes Lighthouse sont de 93/100/100 pour l’atlas et de 100/100/100 pour la méthodologie. Ces résultats sont conservés séparément des mesures de transfert et de disponibilité de la carte.

La réception des performances reste **partielle** : le JavaScript initial de l’interface respecte 300 Ko gzip, mais l’ensemble du moteur cartographique et de ses workers dépasse ce volume. La carte complète s’affiche en 9,22 secondes avec le profil réseau lent documenté, au-delà des 3 secondes demandées ; son JavaScript complet représente 670 543 octets gzip, contre 252 011 pour la coque initiale. La cadence mesurée sur Apple M4 Max ne certifie pas un ordinateur portable moyen, un téléphone physique ou un corpus de 50 000 événements. Les chiffres détaillés du dernier passage font foi dans [QA.md](QA.md).

## Limites historiques explicites

Les observations Cliopatria s’arrêtent en 2024 et les instantanés Historical Basemaps en 2010. L’interface indique la dernière date sourcée lorsqu’une année ultérieure est choisie. Les polygones anciens sont des approximations ; les lacunes ne sont pas interpolées en nouvelles affirmations historiques. Les batailles et les changements de territoires partagent la chronologie sans leur attribuer automatiquement un lien causal. Les séquences relient les événements documentés et ne constituent pas des itinéraires de marche attestés.

La sélection éditoriale corrige partiellement les déséquilibres régionaux des sources ; elle ne remplace pas une revue scientifique par des historiens. Les effectifs, pertes, vainqueurs et textes restent tributaires des propriétés effectivement disponibles. Aucun fait manquant n’est complété de mémoire.
