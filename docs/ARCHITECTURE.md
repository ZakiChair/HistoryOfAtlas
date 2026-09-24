# HistoryOfAtlas — architecture

## Contrat de produit

Atlas mondial en anglais par défaut, avec interfaces française, allemande, espagnole, chinoise et russe, de l’année astronomique −3500 à l’année courante. Les textes des sources utilisent la langue choisie lorsqu’elle est disponible, avec repli en anglais. Le produit doit rendre visibles ses sources, ses absences et les incertitudes. Aucun événement, coordonnée ou frontière ne peut être composé depuis la mémoire du développeur. Les seuils d’acceptation sont des objectifs à mesurer, et non des chiffres à afficher sans preuve.

## Décisions

Priorité confirmée par l’utilisateur : le territoire qui se redessine est le sujet central. La carte ne doit pas être un simple fond fixe couvert de marqueurs. Le contrôle temporel met à jour les géométries politiques et leurs labels ; les campagnes pilotent simultanément les frontières disponibles et les événements. Un changement de possession associé à une bataille doit être explicitement sourcé. La proximité chronologique d’un événement et de deux instantanés ne prouve pas une causalité.

- Next.js App Router, React, TypeScript strict, export statique. Les pages de référence sont produites à la compilation ; l’atlas est un composant client chargé progressivement. Hébergement principal sur Vercel ; la même exportation peut être servie par Nginx de façon autonome (voir « Hébergement »).
- MapLibre GL : globe initial, projection Mercator alternative ; un fond physique Natural Earth et des instantanés de frontières en PMTiles locaux. Requêtes HTTP Range, sans serveur de tuiles. Deck.gl est chargé à l’ouverture d’une campagne pour son tracé animé.
- Deux plans de données : tuiles vectorielles pour les géométries et filtrage dans le moteur cartographique ; petits index par période pour les listes et fiches JSON individuelles. L’interface ne charge pas un GeoJSON mondial.
- Les événements disposent de 61 archives temporelles, avec une marge de 25 ans et inclusion des événements longs par chevauchement. La navigation annuelle utilise une seule source vectorielle et conserve l’archive chargée tant qu’elle couvre la fenêtre visible. Une plage explicite, une guerre complète ou les traces autorisent l’archive globale. Le filtrage dans MapLibre ne remplace pas ce découpage des transferts.
- Zustand porte l’état partageable ; parseur/encodeur URL testé, paramètres bornés et invalides ignorés. La carte s’abonne directement au store pour éviter un rendu React global à chaque année. L’URL publie le dernier état au plus toutes les 250 ms pendant la lecture, immédiatement à la pause ; les retours dans l’historique annulent les écritures différées.
- Dates historiques : module pur sans Date JavaScript, années astronomiques, précision et calendrier explicités. Les conversions des conventions BCE sont testées et documentées.
- Recherche MiniSearch dans un Web Worker, index chargé seulement à la première recherche ; téléchargement progressif des tranches. Les résultats doivent piloter carte et année.
- Wikidata est interrogé par lots limités avec User-Agent, temporisation, reprises et cache. Chaque réponse brute et chaque URL source restent auditables. Les données dérivées sont déterministes ; le rapport distingue données acceptées, rejetées et absentes.
- Les belligérants sans camp sourcé restent dans « autres / camp non renseigné ». Aucun vainqueur, effectif ou trajet d’armée ne sera inféré du nom. Une ligne reliant des batailles est un enchaînement documentaire, pas une route attestée.
- Frontières : fondu des deux instantanés encadrants. Un morphing géométrique arbitraire inventerait de la précision. L’interface indique les années sources et le caractère approximatif. Couleurs déterministes par identifiant stable de la source.
- Source territoriale principale complémentaire : Cliopatria / Seshat, CC BY 4.0, environ 14 000 géométries avec intervalles FromYear/ToYear, de 3400 av. J.-C. à 2024. Les intervalles sont convertis en années astronomiques, découpés en tuiles temporelles et filtrés dans MapLibre. Ce jeu permet une évolution bien plus détaillée que les seuls 50 instantanés mondiaux. Les géométries successives sont fondues à leurs transitions, sans prétendre déduire une limite militaire intermédiaire. Les instantanés historical-basemaps restent un mode de comparaison explicitement sourcé.
- L’éditorial est un fichier versionné de QID validés par l’ingestion. Les parcours s’appuient exclusivement sur les événements obtenus ; les campagnes distinguent itinéraire sourcé et succession de lieux.

## Direction visuelle

Le globe est l’élément principal. Océan bleu encre #071b29, relief ardoise #253b43, papier clair #ede6d5, or patiné #c6a56a, texte ivoire #f3ecdd. Titres et géographie en serif de type Cormorant Garamond ; interface compacte en sans-serif lisible. Une frise ouverte et large en bas, un carnet latéral à gauche, des commandes cartographiques à droite. Les panneaux restent discrets pour préserver la surface de lecture du monde. Le thème clair reprend les couleurs du papier.

## Frontières entre modules

`pipeline/` produit `public/data/` et `public/geo/`. `lib/schema.ts` définit le contrat Zod partagé. `lib/histdate/` ne dépend ni du réseau ni de React. `lib/data-client/` gère le cache et le chargement ; les consommateurs ignorent les réponses devenues obsolètes. `components/map/` possède le cycle de vie WebGL ; `components/timeline/` anime le temps ; les panneaux sont des consommateurs de données. Les parcours sont déclaratifs dans `content/stories/`.

## Couches thématiques

Trois couches se superposent aux territoires et aux événements : les batailles 3D, les ressources stratégiques et les religions. Chacune vit dans un module de `components/map/` (`battle-overlay.ts`, `resource-overlay.ts`, `religion-overlay.ts`). `WorldMap.tsx` l’importe dynamiquement à sa première activation : ni son code ni ses données n’entrent dans le premier chargement. Le module expose `update(…)`, appelé avec chaque état appliqué par la file de rendu (la couche des ressources n’en reçoit que la visibilité, l’année et la plage), et `dispose()`. Les ressources et les religions exposent aussi `isReady()`, que la file de rendu consulte avant de laisser la lecture avancer d’une année.

Le cycle de vie est le même pour les trois couches :

1. activation depuis les commandes de la carte ou par l’URL ;
2. import du module, puis téléchargement unique de l’index de la couche par `lib/<couche>/client.ts`. La promesse est mise en cache par URL ; un échec l’invalide, si bien que « Réessayer » relance réellement la requête ;
3. installation de la source et des calques MapLibre ;
4. mises à jour par filtres, propriétés de mise en page ou `setData`. Masquer une couche passe ses calques en `visibility: none` sans les retirer : la réactiver ne télécharge rien.

Particularités :

- Ressources (`/data/resources/sites.json`) : une source GeoJSON groupée. Un changement d’année ou de période remplace les données par `setData` sur la même source, sans masquer les symboles ni retirer la source. La dernière image reste affichée pendant le calcul. `isReady()` reste faux tant que la nouvelle période n’est pas rendue, ce qui retient la lecture. Le filtre de catégorie s’applique avant le regroupement, pour que les comptes des groupes respectent la période et la catégorie.
- Religions (`/data/religions/history.json`) : la géométrie est écrite une seule fois. L’année, la tradition choisie, l’affichage des tracés et celui des zones ne modifient que des filtres et des propriétés de mise en page. La couche n’est jamais masquée pendant la lecture.
- Batailles : voir « Batailles 3D ».

`THEMATIC_STACK` (`components/map/thematic-stack.ts`) fixe l’ordre vertical, de bas en haut : zones et tracés religieux, pictogrammes de ressources, emblèmes religieux, puis cartouches de comptage des groupes de ressources. Les archives territoriales sont insérées au fil des années, au-dessus des calques existants. Chaque couche appelle donc `raiseThematicLayers` après ses mises à jour ; la fonction ne déplace rien quand l’ordre est déjà correct, pour ne pas perturber le style pendant la lecture.

L’état des couches est partagé dans l’URL (analyse et sérialisation dans `lib/store/index.ts`, synchronisation dans `lib/store/url-sync.ts`) : `battles=0` masque les batailles, `battle=1` ouvre les batailles 3D avec leur phase `bphase` et leur vitesse `bspeed`, `resources=1` affiche les ressources, `religions=1` les religions, `religion=` choisit une tradition, `rpaths=0` et `rareas=0` masquent les tracés et les zones.

## Priorité des clics

Un clic revient à l’élément dessiné au-dessus. Avant d’agir, chaque gestionnaire interroge les modules `components/map/*-hit.ts` ; `preventDefault()` signale ensuite aux autres gestionnaires qu’un clic est déjà traité. L’ordre est le suivant :

1. cartouches de comptage des ressources (`hasResourceCountAt`) ;
2. emblèmes religieux (`hasReligionAt`) ; les zones et les tracés ne captent pas les clics ;
3. sites et groupes de ressources (`hasResourceAt`) ;
4. points du catalogue en mode bataille, groupes et marqueurs d’événements ;
5. territoires, seulement hors mode bataille et quand aucun événement ne se trouve sous le pointeur.

Une nouvelle couche cliquable fournit son propre test `hasXAt` et l’ajoute aux gestionnaires des couches qu’elle recouvre. Le survol suit la même règle : quitter un symbole pour un symbole voisin d’une autre couche conserve le pointeur. `tests/unit/thematic-stack.test.ts` vérifie l’ordre des calques ; les scénarios `religions.spec.ts` et `map-layers.spec.ts` couvrent les sélections.

## Batailles 3D

Le mode bataille (`battle=1`) charge `battle-overlay.ts`, three.js et l’index `/data/battles/index.json`. Le catalogue devient une source de cercles MapLibre ; choisir une bataille charge sa notice `/data/battles/events/<id>.json`. Les armées sont dessinées par une couche personnalisée MapLibre (`renderingMode: '3d'`) qui partage le contexte WebGL de la carte. `lib/battles/projection.ts` calcule les matrices de projection, globe compris.

`lib/battles/simulation.ts` répartit un budget de modèles entre les armées. Les effectifs sourcés partagent une échelle commune ; une armée sans effectif connu reçoit un groupe symbolique, sans échelle. Formations, avancées et pertes sont calculées de façon déterministe. `lib/battles/units.ts` associe chaque armée à un profil d’équipement daté et sourcé, et chaque profil à l’un des modèles glTF de `public/models/battles/`, produits par `scripts/generate-battle-models.py`. La reconstruction reste illustrative : ni les mouvements ni la disposition ne restituent la tactique réelle.

La lecture parcourt la bataille en 40 secondes à vitesse 1. Elle n’avance que si la carte est prête (`isPlaybackMapReady`) et l’onglet visible. L’état du rendu (`loading`, `ready`, `empty`, `error`) est publié par `lib/battles/status.ts` pour le panneau et pour les tests.

## Hébergement

- Principal : Vercel, lié au dépôt GitHub. `main` est la branche de production : chaque poussée sur `main` déclenche un déploiement par l’intégration Git. `vercel.json` fournit les types MIME et les en-têtes de cache des PMTiles et des modules MapLibre ; le CDN fournit les plages d’octets et la compression. Ce déploiement n’attend pas encore le verdict de la CI.
- Secondaire : l’image Docker (compilation Node, puis Nginx sans privilèges avec `nginx.conf`) sert la même exportation statique sur un serveur autonome.

Les commandes, variables et contrôles de chaque hébergement sont dans [DEPLOYMENT.md](DEPLOYMENT.md).

## Intégration continue et budgets

`.github/workflows/ci.yml` s’exécute sur chaque PR, sur chaque poussée sur `main` et à la demande :

- `static` : TypeScript, Vitest, ESLint, tests Python, contrôles `data:*:check`, budget des données au premier chargement par couche (`scripts/measure-data.mjs`, en avertissement seulement pour l’instant) et `pnpm audit` des dépendances de production ;
- `quality` : huit shards compilent l’exportation puis exécutent Playwright. Le premier mesure aussi la coque JavaScript (`scripts/measure-bundle.mjs`) : les polyfills `noModule`, que les navigateurs modernes ne téléchargent pas, sont exclus du budget et rapportés à part, et le détail par chunk figure dans le résumé du run. Les balayages par bataille (catalogue, équipements, équipements terrestres, métadonnées revues) ne tournent que sur le profil ordinateur ;
- `ci-ok` : le seul contrôle à exiger. Il n’est vert que si `static` et tous les shards le sont.

La documentation ne recopie pas le nombre de tests : le dernier run vert de `main` fait foi.

## Risques et critères mesurables

1. Le nombre réel d’événements Wikidata datés et géolocalisés peut être inférieur à 20 000. Le rapport expose le volume réel ; il est interdit de dupliquer ou d’inventer pour atteindre le seuil.
2. WDQS peut imposer des délais ou indisponibilités : cache, pagination, backoff et reprises. Un échec source ne doit jamais produire silencieusement un jeu « complet ».
3. Les frontières anciennes sont approximatives et espacées. Le dépôt vérifié utilise GPL-3.0, contient 54 instantanés au total, dont environ 50 utiles à la période, et s’arrête à 2010. Les géométries dérivées restent distribuées avec cette licence et leurs sources. Une animation ne comble pas l’absence de frontières attestées à chaque bataille. Ne pas confondre licence du code et licence des données dérivées.
4. La détection mer/terre dépend de la résolution Natural Earth : tolérance côtière explicite et rejets auditables ; pas de déplacement automatique des points.
5. Les budgets 300 Ko JS initial / 3 s / 30–60 fps sont vérifiés sur build de production. MapLibre et deck.gl sont séparés en chunks ; les mesures totales et initiales doivent être distinguées. Aucun score Lighthouse ne sera annoncé sans exécution.
6. WebGL n’est pas garanti : vue liste utilisable et erreur explicite. Mobile, clavier et mouvement réduit sont testés.

## Plan de réalisation et vérification

0. Architecture, configuration, compilation et premier commit.
1. Ingestion réelle, Zod, dates/scoring/validation testés, statistiques et provenance, commit.
2. Globe, tuiles d’événements et frise non linéaire, lecture et tests, commit.
3. Instantanés historiques, fondu, attributions et vérification, commit.
4. Fiches, recherche Worker, filtres, URL et tests, commit.
5. Guerres, séquences de campagnes, entités et superficie estimée, commit.
6. Parcours, introduction, FR/EN, mobile et accessibilité, commit.
7. Mesures réelles, pages SEO, E2E, CI, Docker et documentation, commit.

Les couches indépendantes peuvent être préparées en parallèle ; chaque jalon intégré est compilé et testé avant son commit. Les preuves et écarts sont consignés dans `docs/STATUS.md`.

## Références techniques

- https://nextjs.org/docs/app/guides/static-exports
- https://docs.protomaps.com/pmtiles/maplibre
- https://deck.gl/docs/api-reference/mapbox/mapbox-overlay
- https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service
- https://github.com/aourednik/historical-basemaps
- https://www.naturalearthdata.com/about/terms-of-use/
- https://github.com/Seshat-Global-History-Databank/cliopatria
- https://doi.org/10.1038/s41597-025-04516-9

## Ajustements issus des essais

- MapLibre 6 distribue un worker ESM séparé. Un pré-script copie ses modules et sa licence sous une URL locale versionnée ; le navigateur reçoit cette URL explicitement. Nginx sert correctement les fichiers `.mjs`.
- À faible zoom et au repos, un worker regroupe les seuls événements déjà rendus et filtrés par les tuiles, dans l’espace écran. Les QID sont dédupliqués. Le petit GeoJSON de regroupement est un résultat de visualisation, pas une nouvelle source historique. Les marqueurs vectoriels reprennent immédiatement pendant la lecture, le déplacement ou les changements de filtre.
- Les ancêtres militaires attestés par P361/P527 sont propagés avec protection contre les cycles : une guerre peut retrouver les batailles de ses campagnes intermédiaires. Un parent géographique ou organisationnel ne devient pas artificiellement une guerre.
- Les relations militaires sans dates parentales suffisantes ou incompatibles avec leurs bornes sont mises en quarantaine, séparément des événements. La vue liste utilise les mêmes regroupements validés que la carte.
- Les labels temporels sont conservés dès le zoom mondial lors de la génération PMTiles. Une suppression préalable des points rendrait certains noms définitivement indisponibles après filtrage par année. La taille des noms dépend du zoom et de la superficie documentée.
- MapLibre 6 sous-compte certaines requêtes sur tout le viewport en projection globe. Les lectures sont donc découpées en rectangles de 256 pixels et dédupliquées ; Mercator conserve sa requête unique. Les regroupements de marqueurs sont calculés au repos ; le carnet des territoires est publié après un rendu, à une cadence maximale de quatre fois par seconde pendant la lecture.
- `setFilter` provoque un retraitement des tuiles dans les workers MapLibre. Un seul lot temporel reste en cours pendant la lecture ; les années demandées entre-temps sont remplacées par la plus récente. Le lot suivant commence après le rendu des sources chargées, sans attendre `idle`. L’horloge attend ce rendu via un verrou éphémère appartenant à chaque instance de carte ; le temps de chargement ne crée aucune dette à rattraper. Les actions autres que l’avancement annuel sont prioritaires. Le retrait des anciennes couches est protégé contre les événements synchrones émis par la suppression des sources.
- Les fiches s’ouvrent explicitement depuis campagnes et récits, afin de préserver leurs commandes sur mobile. Les titres disponibles seulement dans une langue d’origine sont conservés avec cette langue indiquée ; aucune traduction historique n’est inventée.
- Les tests fonctionnels restent indépendants du benchmark GPU. L’audit Lighthouse applique le ralentissement mobile pendant la capture (`devtools`) et conserve les seuils 85/95/95. La mesure du délai de rendu territorial et du JavaScript complet est séparée : le score Lighthouse ne suffit pas à certifier ces budgets.

## Dossiers de personnes

Les relations d’événements vers les personnes sont portées par les seules notices détaillées. Les dossiers `Person` sont des JSON indépendants : dates biographiques multivaluées, fonctions avec bornes sourcées, liens militaires portant leur rôle exact et leur déclaration. Le panneau réutilise le lecteur encyclopédique des batailles et son attribution. Aucun résumé ou portrait n’est chargé lors de la navigation cartographique ordinaire.

`selectedPerson` est sérialisé dans `person=QID`. Ouvrir une personne suspend la lecture et conserve le contexte appelant ; fermer le dossier retourne à cette bataille, campagne ou entité. Une nouvelle sélection explicite remplace ce contexte. Les requêtes de navigation asynchrones sont invalidées lors d’une fermeture ou d’un changement de sélection. Le worker de recherche charge un index séparé de noms et peut continuer avec les autres catalogues si l’un d’eux est indisponible.

Les identités politiques sont résolues par un registre versionné de correspondances revues. Les dates de fonction et de juridiction sont distinctes des observations de frontières. Les assertions de commandement, de participation, de chef d’État et de titulaire d’une fonction ont des invariants de schéma séparés ; leur provenance n’est pas fusionnée en une attribution implicite de conquête.
