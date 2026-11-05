# Mieux comprendre l’évolution des cartes

## Compléments apportés à l’atlas

- Le territoire sélectionné est repéré par un contour contrasté, lié à son identité et aux intervalles documentés. Le contour disparaît quand l’entité n’est plus représentée dans la source affichée.
- La fiche territoriale indique l’intervalle de l’observation active. Des boutons permettent de passer à l’observation précédente ou suivante, et un repère situe l’année choisie sur la courbe de superficie. Les lacunes restent visibles, sans interpolation.
- L’attribution utilise la même sélection d’instantanés que la carte : une année exacte n’annonce plus l’instantané suivant. Les fondus illustratifs, les derniers contours conservés et le recours à Historical Basemaps sont explicités.
- « Lire la carte » distingue l’année demandée des dates sources et explique la couverture partielle, les contours approximatifs et le fond physique contemporain.
- La frise explique son échelle non linéaire et la nature documentaire de son histogramme. L’aide décrit aussi les épidémies et distingue religion du pouvoir et croyances de la population.
- Ces compléments sont disponibles dans les sept langues de l’interface.

La couverture historique reste celle des sources publiées. Compléter l’interface ne permet pas de combler honnêtement les régions ou les années non documentées.

## Ajouts recommandés, par ordre de priorité

Les points **2, 3, 4 et 5** disposent maintenant d’une première version dans le bouton
**Comprendre** : 30 transformations expliquées, un inventaire de couverture par région
et période, 14 réseaux schématiques et 195 lieux avec capitales ou observations
démographiques datées. Les corpus explicatifs sont des sélections documentées.
Voir [la méthode et les données](context-data.md).

| Priorité | Ajout                                     | Question historique éclairée                                                     | Première version utile                                                                                                                          |
| -------- | ----------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Comparaison de deux dates                 | Qu’est-ce qui change dans une même région ?                                      | Alternance A/B avec cadrage identique et dates sources visibles. Conserver le choix de source pour comparer des observations compatibles.       |
| 2        | Explications sourcées des transformations | Pourquoi une frontière change-t-elle ?                                           | Quelques dossiers reliant explicitement un changement à un traité, une conquête, une indépendance ou une unification, avec références précises. |
| 3        | Couverture par région et période          | Que savons-nous, et où manquent les preuves ?                                    | Indiquer les périodes documentées, les lacunes et les désaccords entre sources. Ne pas représenter une donnée inconnue comme zéro.              |
| 4        | Réseaux commerciaux et migrations         | Comment circulent les populations, les marchandises et les idées ?               | Un corpus pilote de routes et de flux datés, avec sens, période, source et caractère schématique explicites.                                    |
| 5        | Villes et démographie                     | Comment les transformations territoriales s’articulent-elles avec les sociétés ? | Relier capitales, observations de population et évolution des villes, avec dates de référence et fourchettes conservées.                        |
| 6        | « Au même moment ailleurs »               | Quelles transformations sont contemporaines dans d’autres régions ?              | Parcours synchronisés entre plusieurs régions ; proposer une frise linéaire lorsque la comparaison des durées est l’objectif.                   |

## Points de méthode pour les prochaines étapes

Une comparaison géométrique montre des différences entre sources datées : elle ne prouve pas à elle seule une annexion, une souveraineté exclusive ou une cause historique. Il faut distinguer changement réel, changement de couverture et changement de méthode.

Le journal `public/geo/territorial-changes.json` énumère des changements de géométrie. Il ne remplace pas les intervalles des fiches territoriales pour compter les entités présentes une année donnée. Un contour inchangé peut être prolongé sans nouveau changement géométrique.

La comparaison A/B reste une évolution distincte. Les 30 notices actuelles permettent
d’éprouver la présentation des mécanismes et conséquences avant d’étendre la couverture
chronologique et régionale du corpus.
