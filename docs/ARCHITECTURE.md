# Atlas Belli — architecture

## Contrat de produit

Atlas mondial francophone/anglophone, de l’année astronomique −3500 à l’année courante. Le produit doit rendre visibles ses sources, ses absences et les incertitudes. Aucun événement, coordonnée ou frontière ne peut être composé depuis la mémoire du développeur. Les seuils d’acceptation sont des objectifs à mesurer, et non des chiffres à afficher sans preuve.

## Décisions

Priorité confirmée par l’utilisateur : le territoire qui se redessine est le sujet central. La carte ne doit pas être un simple fond fixe couvert de marqueurs. Le contrôle temporel met à jour les géométries politiques et leurs labels ; les campagnes pilotent simultanément les frontières disponibles et les événements. Un changement de possession associé à une bataille doit être explicitement sourcé. La proximité chronologique d’un événement et de deux instantanés ne prouve pas une causalité.

- Next.js App Router, React, TypeScript strict, export statique. Les pages de référence sont produites à la compilation ; l’atlas est un composant client chargé progressivement. Déploiement autonome Nginx, sans service propriétaire.
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
