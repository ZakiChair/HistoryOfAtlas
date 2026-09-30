# Religions : dominantes par État, zones quantitatives et repères historiques

La couche **Religions** propose deux représentations complémentaires : **Religions dominantes** (par défaut), qui colore les contours politiques de Cliopatria selon la religion attribuée à chaque État et superpose les zones quantitatives RCS/Seshat documentées, et **Repères historiques**, qui conserve les attestations, étapes de diffusion et foyers du corpus éditorial. Le changement de mode ne transforme pas un sanctuaire, une religion officielle ou la religion d’un souverain en majorité démographique.

## Zones quantitatives RCS/Seshat

L’index [`public/data/religions/coverage-index.json`](../public/data/religions/coverage-index.json) rassemble les observations quantitatives RCS et les observations qualitatives Seshat, résumées pour le rendu (géométries arrondies à 1e-4°, majorité et traditions présentes par observation). Il est chargé à l’activation de la couche ; les couleurs et hachures résument les données disponibles pour l’année de l’atlas, ou la fin de la plage sélectionnée. Un clic sur une zone charge le fichier `coverage/<région>.json` correspondant, qui donne accès au périmètre de population, à la date ou à l’intervalle de référence, aux parts ou qualifications documentées et aux sources.

### Lire les couleurs et les seuils

- **Majorité quantitative : strictement plus de 50 %** de la population. Une part de 50 % ne suffit pas. Le fond prend la couleur de la religion concernée.
- **Autres religions fortement présentes : au moins 20 %**. Les hachures rendent visibles ces autres groupes, y compris lorsqu’aucune religion ne dépasse 50 %. Le groupe le plus nombreux n’est donc pas automatiquement présenté comme majoritaire.
- **Sans affiliation religieuse** est une catégorie distincte, avec une représentation neutre ; elle n’est pas présentée comme une religion.
- Les regroupements de traditions sont signalés comme **agrégats**. Une catégorie telle que « traditions d’Asie orientale » ne devient pas une religion unique, et les catégories parentes ne sont jamais additionnées à leurs sous-catégories.

Seshat apporte une autre forme d’information : ses codes explicites « vaste majorité » et « plus de la moitié » établissent une majorité qualitative ; « minorité importante » établit une présence importante. **Cette dernière qualification ne signifie pas qu’un seuil de 20 % a été mesuré.** Aucun pourcentage n’est inventé pour ces observations. Un rang tel que « religion la plus répandue », sans qualification de prévalence, ne suffit pas.

Une zone sans coloration peut correspondre à une absence de majorité, à des données trop anciennes, à une observation écartée ou à un manque de documentation. Elle ne démontre pas l’absence d’une religion. Les proportions concernent une population agrégée ; elles ne localisent pas les croyants à l’intérieur du contour et ne permettent aucune déduction sur une personne.

Dans cette vue, les remplissages politiques sont masqués et leurs contours neutralisés : leurs couleurs ne doivent pas être prises pour des données religieuses. Ils retrouvent leur représentation habituelle lorsque la couche est désactivée ou que l’on revient aux repères historiques. Le filtre affiche seulement la couleur et les hachures de la tradition choisie ; la fiche conserve la composition complète de la zone.

### Dates et couverture

Pour les données quantitatives, le mode utilise le dernier repère disponible qui ne dépasse pas l’année sélectionnée, avec un **âge maximal de 15 ans**. Son année d’origine reste affichée. Consulter une estimation de 2015 en 2026 ne produit donc pas une estimation de 2026. Aucune interpolation supplémentaire n’est ajoutée par l’atlas. Les observations qualitatives Seshat sont visibles uniquement dans leurs intervalles documentés, limités aussi par la validité de leur géométrie historique.

La livraison du 28 septembre 2026 comprend :

| Source                          | Couverture intégrée                                                    | Nature et limites                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RCS-Dem 2.0**                 | **107 régions**, **6 952 repères annuels**, de 1700 à 2015             | Estimations à périmètres relus ; la série source contient déjà des interpolations et extrapolations. Une ligne annuelle n’est pas nécessairement un recensement de cette année. |
| **Seshat, Widespread Religion** | **Six régions**, **42 observations par intervalle**, entre 287 et 1802 | Sélection qualitative pour Rome, Aksum, l’Islande, Adal, la confédération haudenosaunee et le Yémen qasimide ; intervalles discontinus et couverture ancienne très partielle.   |

Ces totaux ne sont pas le nombre de zones visibles simultanément. RCS renseigne ici deux régions en 1800, 17 en 1900, 104 en 2010 et 99 en 2015. Les grandes lacunes anciennes sont conservées. Les chiffres reproductibles figurent dans le [rapport RCS](../data/curated/religion-coverage-rcs-report.json), le [rapport Seshat](../data/reports/religion-coverage-seshat.json) et le [rapport combiné](../public/data/religions/coverage-report.json).

### Périmètres, sources et réutilisation

Chaque correspondance RCS lie un identifiant source exact, une période et un périmètre de population relu dans l’annexe A du codebook. Une égalité de code ISO ne suffit pas. Les contours Natural Earth sont des contours de référence contemporains : lorsque RCS estime une population ancienne à l’intérieur de frontières contemporaines, ce choix est explicitement indiqué. Il ne reconstitue pas les frontières politiques de cette année.

La France utilise seulement la métropole, la Russie exclut la Crimée conformément au périmètre RCS, et la Chine inclut Hong Kong et Macao uniquement pour les années retenues à partir de 1999. Les géométries historiques Seshat viennent de Cliopatria, avec correspondance d’identité et intersection des dates ; elles ne proviennent pas des croquis éditoriaux des repères historiques.

Les parts manquantes restent inconnues. Les valeurs négatives, les répartitions incohérentes et les majorités contradictoires sont écartées et signalées dans les rapports ; les valeurs ne sont pas ramenées artificiellement à 100 %. Les branches d’une même tradition ne sont pas additionnées pour fabriquer une majorité.

Les estimations RCS conservent les **conditions d’utilisation ARDA**, avec attribution à l’ARDA et à Davis Brown et Patrick James ; elles ne sont pas présentées comme des données sous licence Creative Commons. Les données Seshat sont attribuées sous **CC BY-SA 4.0**, leurs contours Cliopatria sous **CC BY 4.0**, et les contours Natural Earth relèvent du **domaine public**. Les références et les conditions détaillées sont conservées dans les données et les guides d’acquisition.

### Reproduction

```sh
pnpm data:religions
pnpm data:religions:check
```

La reconstruction normale utilise les extraits versionnés dans le dépôt, sans accès réseau. La réacquisition complète est une opération séparée, documentée dans le [guide RCS](../pipeline/religions/README.md) et le [guide Seshat](../pipeline/religions/SESHAT.md). Ces guides détaillent les filtres, les correspondances géographiques, les empreintes des sources et les vérifications propres à chaque import. `ReligionCoverageDatasetSchema` dans `lib/religions/coverage.ts` contrôle les observations, leurs références, les parts et les géométries avant publication ; `ReligionCoverageIndexSchema` et `ReligionCoverageRegionSchema` valident ensuite l’index publié et chaque fichier de région.

## Religion dominante par État (vue par défaut)

`public/data/religions/polities.json` attribue à chaque État Cliopatria la religion dominante de sa population, ou à défaut sa religion d’État, année par année — **824 entités sur 1 583, 1 203 intervalles** (dont cinq agrégats coloniaux pluricontinentaux émis sans couleur — `exclude`). Trois preuves graduées se combinent :

- `majority` — Seshat « Widespread Religion », codes `v_m`/`o_h_p` : majorité documentée dans la population ;
- `predominant` — Seshat, autre code de prévalence en première position : religion la plus répandue sans majorité mesurée ;
- `state` — Wikidata P140 (religion ou conception du monde) de l’item de l’État : religion de l’État, population non documentée ; ou supplément éditorial (`editorial`) qui peut afficher l’un ou l’autre niveau.

Chaque intervalle garde le libellé de sa source (« Orthodoxie byzantine — vaste majorité », item Wikidata, famille éditoriale), ses liens et ses `sourceIds` ; `others` liste les autres religions Seshat codées pour la même entité, et `state` peut reporter la religion d’État Wikidata quand le remplissage vient d’une autre famille. Les choix Wikidata non tranchables entre familles sont marqués `ambiguous` avec leurs `alternatives`, et un item Wikidata de la famille `unaffiliated` ne colore pas la carte : il produit une mention `secular`.

Règle de datation : à la différence du fragment de couverture relu, un code Seshat de premier rang **non daté est appliqué à la durée du régime politique** (choix assumé, toujours signalé dans la note de l’intervalle). Les codes datés coupent les non datés ; deux codes datés concurrents de familles différentes annulent leur recouvrement (report `conflicts`). Une lacune de dix ans ou moins entre deux attributions Seshat de même famille est comblée et signalée dans la note. Une affirmation Wikidata ne peut pas peindre une dénomination avant son existence (famille `minYear`, items `wikidataItemMinYear`). Priorité de fusion : supplément éditorial > Seshat > supplément « de repli » (`priority: fallback`) > Wikidata ; un niveau inférieur ne comble que les années non couvertes. Les fragments Wikidata de deux ans ou moins coincés entre deux autres attributions sont écartés comme artefacts du découpage. Le supplément `data/curated/religion-polities-supplement.json` (366 sujets). Cinq agrégats coloniaux pluricontinentaux (British Africa, French Africa, French Indochina, German Africa, Italian Africa) portent `exclude` au lieu d’intervalles : ils sont émis sans aucune couleur (`spans: []`, raison bilingue affichée dans la fiche) quoi que disent Seshat ou Wikidata. s’appuie sur des notices encyclopédiques identifiées comme telles.

Une couleur affirme la religion dominante **de l’État**, pas le lieu de résidence des croyants : le polygone est le contour politique approximatif de Cliopatria, une religion d’État n’est pas une majorité de population, et une zone non colorée n’établit pas l’absence de religion. Reproduction : `pipeline/religions/POLITIES.md`.

## Repères historiques

`public/data/religions/history.json` est un corpus éditorial bilingue, consulté et vérifié le **23 septembre 2026**, puis complété le **24 septembre 2026** de 39 étapes de diffusion postérieures à 1600, chacune revérifiée sur ses sources par un relecteur indépendant, puis enrichi le **29 septembre 2026** de 14 étapes documentant des schismes, des reculs attestés et des lacunes médiévales, chaque source ayant été consultée le jour même (les pages du Metropolitan Museum, d’Archnet et de l’Encyclopaedia Iranica, qui refusent les consultations automatisées, l’ont été par leurs extraits indexés). Il contient **16 traditions, 145 étapes, 54 zones schématiques, 27 relations de transmission, 6 clôtures et 169 sources**. Ses premiers et derniers jalons sont respectivement 3200 av. J.-C. et 1988.

Ce mode conserve les **repères historiques cumulés jusqu’à l’année sélectionnée**. Un marqueur, un trait ou une zone conservé à une date ultérieure signifie que cette attestation a déjà eu lieu. Il ne démontre ni une pratique toujours vivante, ni une présence continue, ni une majorité religieuse, ni une frontière. Les traditions peuvent se superposer géographiquement et chronologiquement.

### Périmètre

| ID               | Tradition ou famille de traditions    | Étapes | Zones | Relations |
| ---------------- | ------------------------------------- | -----: | ----: | --------: |
| `mesopotamian`   | Traditions mésopotamiennes            |      4 |     2 |         0 |
| `egyptian`       | Traditions de l’Égypte ancienne       |      5 |     2 |         1 |
| `hinduism`       | Traditions védiques et hindoues       |     10 |     4 |         1 |
| `andean`         | Traditions andines et incas           |      4 |     3 |         1 |
| `zoroastrianism` | Zoroastrisme                          |      6 |     2 |         1 |
| `greco-roman`    | Traditions grecques et romaines       |      5 |     3 |         1 |
| `judaism`        | Judaïsme                              |     12 |     1 |         4 |
| `jainism`        | Jaïnisme                              |      5 |     2 |         0 |
| `daoism`         | Traditions taoïstes                   |      6 |     2 |         0 |
| `confucianism`   | Traditions confucéennes               |      5 |     2 |         0 |
| `buddhism`       | Bouddhismes                           |     15 |     9 |         7 |
| `christianity`   | Christianismes                        |     28 |     7 |         4 |
| `islam`          | Islam                                 |     20 |     9 |         3 |
| `shinto`         | Cultes des kami et shinto             |      6 |     2 |         0 |
| `yoruba-orisha`  | Traditions yoruba, òrìṣà et diasporas |      7 |     3 |         3 |
| `sikhism`        | Sikhisme                              |      7 |     1 |         1 |

Les étapes de genre `schism` (4) et `contraction` (6) sont comprises dans ces totaux ; chaque recul nomme le foyer qu’il clôt : Chang’an (845), Philae (535), Rome (391), Cordoue (1236 pour la mosquée, 1492 pour la synagogue) et Kagoshima (1614).

Les catégories sont des outils de lecture. « Traditions andines » rassemble des cultures distinctes : aucune filiation Chavín → Tiwanaku → Inca n’est tracée. Les traditions gréco-romaines, mésopotamiennes et égyptiennes sont également plurielles. Le classement des traditions confucéennes comme religion, éthique ou philosophie dépend du contexte. Les communautés diasporiques ne sont pas considérées comme des copies inchangées d’une tradition d’origine.

Ce premier corpus ne recense pas toutes les traditions ni toutes leurs implantations. Il laisse notamment de vastes lacunes pour les traditions autochtones d’Amérique du Nord et d’Océanie, de nombreuses traditions africaines, le bön et plusieurs mouvements religieux récents. Une absence sur la carte n’est pas une absence historique. Le nombre de jalons ne mesure ni l’importance ni le nombre de fidèles d’une tradition.

### Temps : repères choisis et fourchettes

`kind: "origin"` signifie **premier repère sélectionné dans ce corpus pour cette tradition**. Il ne signifie pas automatiquement date de fondation, première attestation connue dans la recherche, lieu de naissance d’un fondateur ou origine unique. C’est particulièrement important pour :

- `judaism-jerusalem` : 600 av. J.-C. est un repère judéen antérieur aux prises babyloniennes, pas la fondation du judaïsme ;
- `confucianism-qufu` : 478 av. J.-C. date le sanctuaire commémoratif de Qufu, pas les premiers enseignements de Confucius ;
- `shinto-ise` : 690 date le renouvellement rituel du sanctuaire intérieur d’Ise, pas l’apparition des cultes des kami ;
- `yoruba-ife` : 1100 ouvre une période documentée de rayonnement d’Ife, pas la création de la religion yoruba ;
- les traditions védiques, taoïstes, mésopotamiennes, égyptiennes et andines : les jalons sont des repères dans des développements de longue durée.

Les années suivent la convention astronomique de l’atlas : `year = 1 - année_avant_notre_ère`. Ainsi, 3200 av. J.-C. vaut `-3199`, 600 av. J.-C. vaut `-599` et 1 av. J.-C. vaut `0`. Les années de notre ère conservent leur valeur usuelle.

`kind: "schism"` date une division documentée à une date et un lieu : un schisme ou une séparation attestée, sans prétendre dater l’ensemble du processus de séparation. `kind: "contraction"` date un recul attesté — interdiction, expulsion ou fermeture — et porte un `closesId` vers le foyer qu’il clôt ; le centre clos est atténué à partir de la date du recul, sans dater la disparition de toute pratique ni celle des fidèles, et sans effacer l’attestation antérieure.

`approximate: true` signale soit une datation discutée, soit une année représentative d’un siècle, d’une phase ou d’une fourchette explicitée dans le texte. L’affichage commence à cette année représentative ; il ne prétend pas trancher à l’année près une incertitude pluriséculaire. Les cas les plus sensibles sont :

| Étape                                      | Traitement                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zarathoustra                               | Repère 1000 av. J.-C. ; chronologie largement discutée dans les IIe–Ier millénaires et localisation orientale régionale, sans lieu de naissance établi. |
| Bouddha et Mahavira                        | Repères des VIe–Ve siècles av. J.-C., sans transformer les chronologies traditionnelles en certitudes biographiques.                                    |
| Sanjan                                     | Repère 850 pour les migrations parsies médiévales, VIIIe–Xe siècles ; le récit tardif de Sanjan n’est pas traité comme un registre contemporain.        |
| Asuka                                      | 552 est une date traditionnelle de transmission à la cour ; l’alternative 538 et les contacts antérieurs sont indiqués.                                 |
| Qingcheng                                  | 142 est explicitement une date traditionnellement associée à Zhang Ling et aux Maîtres célestes.                                                        |
| Samyé, Prambanan, Angkor, Bagan, Sukhothai | Années représentatives de phases de fondation, patronage ou transmission ; elles ne datent pas tous les monuments du site.                              |
| Yushima Seido                              | Repère 1690, avec la phase 1690–1691 indiquée.                                                                                                          |
| La Havane et Salvador                      | Repères de communautés documentées au XIXe siècle ; aucune date unique d’arrivée des traditions diasporiques n’est prétendue.                           |
| Philae, fermeture                          | Repère 535 selon le Metropolitan Museum ; la notice égyptienne ne donne que le règne de Justinien (527–565).                                            |
| Konya                                      | Repère 1220 (achèvement selon Archnet) pour un chantier de 1116 aux années 1230.                                                                        |
| Samudra Pasai                              | Repère 1297 (décès d’al-Malik al-Sālih) ; ses pierres tombales sont des remplacements tardifs selon Lambourn.                                           |

Une date de monument atteste un foyer local à ce moment, sans être automatiquement la première arrivée de la tradition dans la région. Une décision royale, un synode, une réforme ou un texte n’est pas transformé en conversion générale de la population. Les croyances rapportées par les traditions sont présentées comme telles.

### Géographie et relations

Les coordonnées WGS84 sont des positions de référence des lieux nommés, généralement arrondies. Les marqueurs régionaux — premiers courants védiques, monde iranien oriental, plaine gangétique ou Chine ancienne — sont explicitement décrits comme tels. Ils ne sont pas des coordonnées établies de naissance, d’enseignement ou de rédaction.

Les `area.ring` sont des **dessins éditoriaux grossiers de foyers et de contextes géographiques nommés dans les sources** : vallées, plaines, ensembles de sanctuaires, centres urbains ou réseaux locaux. Ils ne proviennent pas d’un jeu SIG de frontières religieuses. Leurs sommets ne sont pas des données archéologiques. Leur taille ne mesure pas la densité de fidèles. Ils ne doivent servir ni à calculer une superficie religieuse ni à déduire une affiliation individuelle. Les zones restent volontairement locales : aucun pays entier n’est rempli sur la seule base d’un sanctuaire.

Les contours sont fermés, sans trous et sans franchissement de l’antiméridien. Les 54 marqueurs associés à une zone se trouvent à l’intérieur de leur contour. Les limites du foyer d’Old Oyo utilisent les indications géographiques NCMM/UNESCO, tout en restant un repère local ; le point n’est pas placé dans la ville moderne d’Oyo. Les points de Philae et d’Abou Simbel désignent les localités historiques et non des emprises prétendument exactes avant les déplacements modernes des monuments.

Un `fromId` relie deux étapes de la même tradition, avec une année de départ strictement antérieure. Il exprime une relation documentée de transmission, de diaspora, de mission, de patronage ou de modèle culturel. Le trait n’est **jamais une route de voyage reconstituée**. Il peut résumer plusieurs relais non représentés.

Les relations sont limitées aux cas documentés, notamment :

- déportations judéennes vers la Babylonie et diaspora séfarade vers Amsterdam ;
- échanges bouddhiques Inde–Sri Lanka, Gandhara–Chine, Chine–Baekje–Japon, Inde–Tibet et Sri Lanka–Sukhothai ;
- réseaux de l’Église de l’Orient entre Mésopotamie et Chine, missions portugaises vers le Kongo et réseaux augustiniens Mexique–Philippines ;
- hégire, déplacement du centre du califat de l’Arabie vers Damas et héritage omeyyade transmis à Cordoue via l’Afrique du Nord ;
- migrations parsies du Gujarat vers Bombay et sikhes du Pendjab vers la Californie ;
- diasporas yoruba liées à la traite esclavagiste vers Cuba et Bahia ;
- patronage d’Amon depuis la région thébaine vers Abou Simbel, référence au modèle de Zeus d’Olympie à Rome et expansion inca vers le sanctuaire préexistant de Pachacamac.

Les points de départ des diasporas yoruba représentent des relations culturelles régionales, pas des ports d’embarquement. Le lien Mexique–Philippines ne suppose pas que les missionnaires aient quitté un monastère particulier du Popocatépetl. De même, le lien Mésopotamie–Chang’an ne reconstruit pas le voyage individuel d’Alopen. Les autres étapes restent indépendantes lorsqu’une liaison précise n’est pas étayée.

### Sources et réutilisation

Chaque étape possède des `sourceIds` résolus vers une notice bibliographique avec URL HTTPS dans le même JSON. Le corpus s’appuie sur des musées, des universités, des publications savantes, des institutions patrimoniales et, pour certaines histoires de sanctuaires ou de missions, les institutions concernées. Les textes français et anglais sont des synthèses originales brèves ; le corpus ne reproduit pas les pages consultées ni leurs illustrations.

Les principales familles documentaires sont le Metropolitan Museum of Art, le British Museum, les musées universitaires de Penn et Yale, les notices et évaluations de l’UNESCO, Harvard Pluralism Project, Encyclopaedia Iranica, SOAS, Heidelberg, ANU, Max Planck, les institutions patrimoniales nationales, le Saint-Siège (déclaration commune de 1965), les universités Columbia et Fordham, Cambridge University Press et Brill, Archnet, les musées nationaux du Danemark et de Nagasaki, la préfecture de Kagoshima, le chapitre et le diocèse de Cordoue, l’archicathédrale de Vilnius. Les notices UNESCO décrivent des sites patrimoniaux : leur inscription contemporaine n’est jamais utilisée comme date d’origine du culte. Une histoire institutionnelle ou un récit traditionnel ne devient pas automatiquement une datation archéologique certaine.

Le JSON conserve les références, mais ne revendique pas une licence uniforme sur les sources liées. Les droits des textes et images des sites cités restent ceux de leurs détenteurs. Les polygones sont une géométrie éditoriale de ce projet, pas une reprise de cartes protégées ni des périmètres officiels d’inscription UNESCO.

Les clés des symboles sont `cuneiform`, `ankh`, `laurel`, `menorah`, `faravahar`, `om`, `ahimsa`, `dharma-wheel`, `cross`, `crescent`, `khanda`, `yin-yang`, `confucian`, `torii`, `orisha` et `andean-sun`. Ce sont des identifiants visuels conventionnels de la légende ; leur affichage ne prétend pas que le symbole était utilisé à la date du premier jalon. Le genre de l’étape choisit ensuite une variante d’emblème : `plain` par défaut, `origin` (double anneau), `divided` (anneau pointillé) pour un schisme, `closing` (barre oblique) pour un recul.

### Validation et enrichissement

Le fichier est une curation explicite, sans API ou service tiers au moment de l’affichage. `ReligionDatasetSchema` dans `lib/religions/types.ts` contrôle les types, les bornes des coordonnées, les IDs uniques, la résolution des sources et traditions, les liens chronologiquement valides et la fermeture des polygones. Les liens `closesId` sont validés eux aussi : seule une étape de genre `contraction` peut en porter un, vers une étape antérieure de la même tradition qui n’est pas elle-même une clôture.

Validation locale ciblée :

```sh
pnpm exec tsx -e "import fs from 'node:fs'; import { ReligionDatasetSchema } from './lib/religions/types.ts'; const d = ReligionDatasetSchema.parse(JSON.parse(fs.readFileSync('public/data/religions/history.json', 'utf8'))); console.log(d.traditions.length, d.milestones.length, d.sources.length);"
```

Résultat après l’enrichissement du 29 septembre 2026 : `16 145 169`. Un contrôle indépendant des 54 contours a vérifié leur fermeture, l’absence d’auto-intersection et l’inclusion de leur point de référence. Les liens ont été relus sur le fond ; aucun lien entre cultures andines distinctes n’a été ajouté pour combler la chronologie.

Pour enrichir le corpus, ajouter une source spécifique pour chaque nouvelle assertion de date, de lieu ou de relation. Expliquer les fourchettes dans les deux langues, maintenir la convention astronomique, préférer une étape indépendante à une filiation supposée et documenter toute modification de l’année représentative. Le mode **Majorités et présences** utilise son propre modèle et ses propres données ; l’ajout d’un jalon historique ne modifie pas ses estimations démographiques.
