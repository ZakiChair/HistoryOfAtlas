# Dossiers de batailles et de dirigeants

La demande étend l'atlas existant : rendre les informations des batailles réellement lisibles et relier les acteurs documentés à leur biographie, leurs fonctions datées et leurs événements militaires. L'autorisation de publier sur le dépôt public et Vercel reste applicable.

## Constats vérifiés

- Les événements conservent leurs liens Wikipédia dans `wikipedia`, alors que le lecteur de résumés ne consultait que `sources`. Les résumés étaient donc absents malgré une source disponible.
- Les descriptions Wikidata sont déjà acquises mais ne sont pas distribuées.
- Les participants P710 ne désignent pas nécessairement des commandants ; une personne participant à une bataille n'en devient pas automatiquement le dirigeant.
- Les identifiants politiques de Cliopatria comportent des associations ambiguës. Une jointure brute ferait attribuer certains dirigeants au mauvais territoire.

## Contrats et réalisation

1. Corriger le lecteur encyclopédique, tester les liens normalisés, le repli FR/EN et les URL invalides. Mutualiser résumé, illustration et attribution dans `EncyclopediaContent`, chargé avec les panneaux.
2. Enrichir les données à partir des déclarations Wikidata : descriptions, personnes liées, fonctions avec qualificatifs temporels, liens militaires explicites. Conserver les sources des assertions et les dates imprécises. Aucun camp, règne ou commandement ne sera inféré d'une simple proximité temporelle.
3. Publier les personnes en JSON individuels, les relations politiques séparément et un index de recherche léger. Les biographies et portraits sont demandés seulement à l'ouverture du dossier.
4. Ajouter `selectedPerson` et le paramètre `person` dans l'URL. Depuis une bataille, conserver le contexte et permettre de revenir à sa fiche. Suspendre les lectures lors de l'ouverture et fermer le dossier lors d'une nouvelle sélection cartographique.
5. Ajouter les biographies, repères biographiques, fonctions/règnes documentés et événements liés, puis les liens depuis les batailles et territoires dont l'identité a été vérifiée.
6. Vérifier schémas, extraction, provenance, liens profonds, langues, erreurs réseau et parcours mobile. Reconstruire le corpus et le site, contrôler le chargement différé, puis publier et tester l'URL publique.

## Répartition

- Données : acquisition, normalisation, construction et rapport de couverture.
- Interface personnes : schéma partagé, état/URL/navigation, recherche, panneau des personnes et intégration shell.
- Identités politiques : registre vérifié, résolution conservatrice et liens dans la fiche territoriale.
- Intégration : lecteur encyclopédique, enrichissement des fiches de bataille, pages événement, tests navigateur, documentation et publication.

## Critères

- Chaque personne et relation affichée possède une source ; aucun champ absent n'est remplacé par une donnée historique inventée.
- Les résumés français sont affichés lorsqu'ils existent, avec repli anglais et attribution Wikipédia.
- Une URL `person=Q…` restaure le dossier ; le retour à la bataille préserve la sélection et la vue.
- Une fonction non monarchique n'est pas appelée « règne » par défaut. Les liens militaires décrivent exactement le rôle de la source.
- Le rapport compte la couverture et les lacunes, les correspondances politiques rejetées et les données indisponibles.
- La navigation temporelle et les corrections du rendu des frontières restent couvertes par les tests existants.
