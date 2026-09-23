# Batailles et ressources géostratégiques

Ajouter deux commandes persistantes et indépendantes sur la carte : batailles
visibles par défaut, ressources masquées par défaut. Les préférences sont
partageables dans l’URL. Masquer les batailles filtre combats, sièges et batailles
navales dans les points, regroupements, densité, traces et sélection ; la lecture
3D s’arrête. Une ouverture explicite d’une bataille la rend visible.

La préférence utilisateur explicite est **l’exploitation selon l’époque**.
La couche ne retient donc que les sites disposant de périodes d’exploitation
sourcées. Les coordonnées géologiques seules ne suffisent pas. Les productions
annuelles ne sont pas interpolées ; les interruptions documentées restent des
trous. Les bornes historiques approximatives sont signalées. Chaque point expose
sa chronologie et les sources de ses dates et coordonnées. Le filtrage précède le
regroupement pour que les compteurs respectent l’année ou la plage sélectionnée.
Une couverture absente ne prouve pas l’absence de ressources. Les données sont
publiées localement et téléchargées seulement à l’activation de la couche.

Travail réparti : état/URL et filtres ; commandes/traductions/interface ;
acquisition et validation des données ; chargement et rendu MapLibre. Contrôler
les cas chargement interrompu, erreur/reprise, sélection, changement de projection
et mobile. Vérifier tests unitaires, types, lint, export statique et tests navigateur
sur le rendu réel. Aucun déploiement ni commit demandé.

## Livraison et vérification — 23 septembre 2026

- Deux commandes visibles sur ordinateur et mobile, traduites dans les six langues.
  L’URL conserve `battles=0` et `resources=1` ; le mode 3D conserve son réglage distinct.
- 7 639 sites, 7 763 périodes documentées, 103 pays/aires selon les labels sources,
  10 catégories représentées. GEM, SODIR et 17 sites historiques revus ; 80 champs
  GEM norvégiens remplacés par leur série SODIR, sans doublons cartographiques.
- Filtrage avant le regroupement, catégories par période, fermeture des fiches
  devenues hors période, requête initiale différée et reprise après erreur.
- Les regroupements d’événements réappliquent explicitement le filtre courant
  aux requêtes MapLibre. Une course avec les anciennes tuiles sous rendu logiciel
  a été reproduite puis corrigée, avec test de non-régression.
- `pnpm check` : 461 tests unitaires, types validés et zéro erreur ESLint
  (avertissement préexistant `.remember/tmp/last-ndc.ts`). Export statique validé.
- 18 scénarios E2E temporels validés sur navigateur natif et logiciel, ordinateur
  et mobile : bornes d’exploitation, interruptions de Quincy, plage explicite,
  Great Orme avant notre ère, chargement tardif, reprise, dossier superposé,
  masquage/réactivation des batailles et arrêt de la 3D. Sur logiciel, 16 cas ont
  réussi au premier passage et les deux cas antiques ont réussi après adaptation
  de leur période vide au défaut préexistant ci-dessous.
- 8 scénarios de non-régression existants passent également (catalogue 3D,
  reprise et arrêt, mouvements réduits, regroupements globe/Mercator).
- Audit visuel en français à 1440×900, 390×844 et 320×667 : dates et sources
  lisibles, défilement des fiches, aucune erreur de console ni débordement ;
  carnet masqué temporairement sur écran bas et espacement conservé ailleurs.

### Observation préexistante hors périmètre

À l’année −3500, une archive d’événements PMTiles annonce des bornes ponctuelles
identiques (`32.724167,25.901667,32.724167,25.901667`) que MapLibre rejette dans la
console. La couche ressources est correctement vide, mais cette archive devra
être corrigée dans le pipeline d’événements. Le scénario de période vide utilise
l’année 400 ; le scénario avant notre ère reste testé à −1600. Aucun message
d’erreur n’est supprimé dans le harnais de test.

### Pictogrammes demandés le 23 septembre

- Les points de ressources deviennent des symboles représentatifs : goutte,
  flamme, charbon, bobine de cuivre, lingots, cristaux, etc. Quinze dessins
  vectoriels sont partagés entre sprites MapLibre haute définition et légende SVG.
- Les catégories exploitées simultanément sont affichées côte à côte. Les
  regroupements montrent la catégorie la plus fréquente et le nombre de sites,
  avec explication dans les six langues. Compteur et pictogramme partagent une
  zone cliquable ; un cadre à coins marque le site sélectionné.
- La revue a reproduit un chevauchement entre Ulaan Ovoo et un groupe au zoom 3
  en 2024 : le clic privilégie maintenant le site au premier plan sans lancer
  également un zoom. Un test de non-régression couvre cette délégation MapLibre.
- Validation : 20 scénarios E2E natifs et 6 contrôles logiciels ciblés passent
  sur ordinateur/mobile. Les tests des catégories temporelles vérifient aussi
  le changement de pictogramme quand l’exploitation d’un même site évolue.

## Enrichissement et correction de lecture — 23 septembre 2026

Le catalogue publié contient maintenant 9 392 sites, 10 134 périodes et 30 catégories,
avec 70 sources et 126 pays/zones après harmonisation des variantes de noms.
Les ressources hors pétrole/gaz/charbon représentent 1 768 sites. Les apports sont
reproductibles hors ligne : MinCan, FINEPRINT, GEM iron, 13 sites historiques
supplémentaires, 30 sites/districts d'Afrique de l'Ouest et 26 exploitations assorties
d'observations récentes. Les rapprochements intersources explicites conservent les
périodes et catégories d'origine sans interpoler les lacunes.

Dix mines modernes du Mali sont documentées. Les attestations d'extraction 2026
couvrent Loulo/Gounkoto (preuve au niveau du complexe), Fekola, Syama, Sadiola et
Nampala. Les districts historiques approximatifs de Bambuk et Buré apparaissent
en 1324. Les fermetures et périodes de traitement de stocks restent distinctes.
Le catalogue est sensiblement élargi, mais n'est pas un inventaire exhaustif de
toute extraction historique ou artisanale.

Le clignotement provenait du masquage complet des couches symboles pendant chaque
mise à jour GeoJSON, suivi de l'attente de `idle` : le fondu MapLibre de 350 ms
redémarrait à chaque changement d'année. Le correctif garde la dernière image,
attend `setData`, la bonne révision et `isSourceLoaded` dans un événement `render`,
puis libère la lecture. Les clics restent bloqués pendant le remplacement de la
source et une sélection devenue inactive est immédiatement fermée.

Avant/après instrumenté sur Falun : 1 capture visible sur 20 avant correction,
30 sur 30 après (vitesses 25×/100×, GPU natif/logiciel). La période après 1992 retire
correctement le site. Les 30 pictogrammes partagés SVG/canvas ont été inspectés à
22/26/32 px sur fonds clair et sombre. La suite unité/typecheck/lint passe avec
469 tests ; seul subsiste l'avertissement préexistant dans `.remember/tmp/last-ndc.ts`.
Build statique réussi (5 496 pages). Les données exportées et servies par HTTP ont
la même empreinte SHA-256 que le fichier public final.

Vérification navigateur finale : 24 scénarios natifs desktop/mobile validés
(22 lors de la suite complète et 2 retestés après adaptation de l'époque vide),
plus 6 ciblés en GPU logiciel : lecture normale, regroupements et Mali.
Le test d'absence de ressource utilise -2700, une archive aux bornes valides ;
les archives préexistantes -2500 et -1800 ont des bornes réduites à un point et
émettent une erreur PMTiles indépendante des ressources. Aucune erreur console
n'est filtrée pour contourner ce problème.
Audit visuel séparé : 35 captures à 1440, 390 et 320 px, Mali1324/2025/2026,
fiches et 30 catégories, sans débordement ni erreur console/page.
