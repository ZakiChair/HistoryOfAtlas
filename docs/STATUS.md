# État vérifié de réalisation

## Phase 0 — socle

Commit `179c1cd`. Architecture, Next.js statique, TypeScript strict, dates astronomiques, schéma Zod et état URL. Compilation de production réussie ; tests de domaine réussis. Le périmètre prioritaire est l’évolution réelle des polygones territoriaux, conformément à la précision de l’utilisateur.

## Phase 1 — pipeline et premier lot

Premier lot vérifié : 5 590 événements datés et géolocalisés, 1 352 notices de contexte, chaque événement avec QID et provenance. L’acquisition complète est encore en cours à ce jalon ; `quality.json` porte explicitement `partial-acquisition`. L’objectif de 20 000 n’est pas déclaré atteint. Les 20 113 candidats éligibles détectés ne sont pas des événements déjà validés.

Le pipeline inclut téléchargement/cache/reprises, normalisation, déduplication, score, contrôle des dates et des coordonnées, contrôle mer/terre avec tolérance côtière, rapports, index temporels, fiches individuelles et PMTiles. La source Wikidata impose actuellement des limites de débit exceptionnelles ; les reprises sont conservées.

La géographie est acquise : 50 instantanés historical-basemaps, 39 archives temporelles Cliopatria, 13 380 observations territoriales et 1 583 entités. Les licences, versions sources, archives correspondantes et limites sont conservées. Les fonds Natural Earth sont tuilés.

Vérification au jalon : `pnpm typecheck`, 46 tests Vitest, ESLint, `pnpm build` (2 975 routes statiques sur ce lot). Les tests navigateur, mesures Lighthouse et critères finaux restent à mesurer sur l’intégration complète.

## Phases suivantes

Les composants carte/frise/frontières et les interfaces sont préparés en parallèle. La validation visuelle et les tests d’intégration détermineront leur statut ; la présence de fichiers n’est pas une preuve de validation. Les contrôles finaux seront consignés ici avec leurs résultats réels.
