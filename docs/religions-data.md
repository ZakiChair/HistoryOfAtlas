# Corpus historique des traditions religieuses

`public/data/religions/history.json` est un corpus éditorial bilingue, consulté et vérifié le **23 septembre 2026**. Il contient **16 traditions, 92 étapes, 54 zones schématiques, 23 relations de transmission et 103 sources**. Ses premiers et derniers jalons sont respectivement 3200 av. J.-C. et 1958.

La couche affiche les **repères historiques cumulés jusqu’à l’année sélectionnée**. Un marqueur, un trait ou une zone conservé à une date ultérieure signifie que cette attestation a déjà eu lieu. Il ne démontre ni une pratique toujours vivante, ni une présence continue, ni une majorité religieuse, ni une frontière. Les traditions peuvent se superposer géographiquement et chronologiquement.

## Périmètre

| ID               | Tradition ou famille de traditions    | Étapes | Zones | Relations |
| ---------------- | ------------------------------------- | -----: | ----: | --------: |
| `mesopotamian`   | Traditions mésopotamiennes            |      4 |     2 |         0 |
| `egyptian`       | Traditions de l’Égypte ancienne       |      4 |     2 |         1 |
| `hinduism`       | Traditions védiques et hindoues       |      8 |     4 |         1 |
| `andean`         | Traditions andines et incas           |      4 |     3 |         1 |
| `zoroastrianism` | Zoroastrisme                          |      4 |     2 |         1 |
| `greco-roman`    | Traditions grecques et romaines       |      4 |     3 |         1 |
| `judaism`        | Judaïsme                              |      6 |     1 |         2 |
| `jainism`        | Jaïnisme                              |      4 |     2 |         0 |
| `daoism`         | Traditions taoïstes                   |      4 |     2 |         0 |
| `confucianism`   | Traditions confucéennes               |      4 |     2 |         0 |
| `buddhism`       | Bouddhismes                           |     11 |     9 |         6 |
| `christianity`   | Christianismes                        |     13 |     7 |         4 |
| `islam`          | Islam                                 |     10 |     9 |         3 |
| `shinto`         | Cultes des kami et shinto             |      3 |     2 |         0 |
| `yoruba-orisha`  | Traditions yoruba, òrìṣà et diasporas |      5 |     3 |         2 |
| `sikhism`        | Sikhisme                              |      4 |     1 |         1 |

Les catégories sont des outils de lecture. « Traditions andines » rassemble des cultures distinctes : aucune filiation Chavín → Tiwanaku → Inca n’est tracée. Les traditions gréco-romaines, mésopotamiennes et égyptiennes sont également plurielles. Le classement des traditions confucéennes comme religion, éthique ou philosophie dépend du contexte. Les communautés diasporiques ne sont pas considérées comme des copies inchangées d’une tradition d’origine.

Ce premier corpus ne recense pas toutes les traditions ni toutes leurs implantations. Il laisse notamment de vastes lacunes pour les traditions autochtones d’Amérique du Nord et d’Océanie, de nombreuses traditions africaines, le bön et plusieurs mouvements religieux récents. Une absence sur la carte n’est pas une absence historique. Le nombre de jalons ne mesure ni l’importance ni le nombre de fidèles d’une tradition.

## Temps : repères choisis et fourchettes

`kind: "origin"` signifie **premier repère sélectionné dans ce corpus pour cette tradition**. Il ne signifie pas automatiquement date de fondation, première attestation connue dans la recherche, lieu de naissance d’un fondateur ou origine unique. C’est particulièrement important pour :

- `judaism-jerusalem` : 600 av. J.-C. est un repère judéen antérieur aux prises babyloniennes, pas la fondation du judaïsme ;
- `confucianism-qufu` : 478 av. J.-C. date le sanctuaire commémoratif de Qufu, pas les premiers enseignements de Confucius ;
- `shinto-ise` : 690 date le renouvellement rituel du sanctuaire intérieur d’Ise, pas l’apparition des cultes des kami ;
- `yoruba-ife` : 1100 ouvre une période documentée de rayonnement d’Ife, pas la création de la religion yoruba ;
- les traditions védiques, taoïstes, mésopotamiennes, égyptiennes et andines : les jalons sont des repères dans des développements de longue durée.

Les années suivent la convention astronomique de l’atlas : `year = 1 - année_avant_notre_ère`. Ainsi, 3200 av. J.-C. vaut `-3199`, 600 av. J.-C. vaut `-599` et 1 av. J.-C. vaut `0`. Les années de notre ère conservent leur valeur usuelle.

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

Une date de monument atteste un foyer local à ce moment, sans être automatiquement la première arrivée de la tradition dans la région. Une décision royale, un synode, une réforme ou un texte n’est pas transformé en conversion générale de la population. Les croyances rapportées par les traditions sont présentées comme telles.

## Géographie et relations

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

## Sources et réutilisation

Chaque étape possède des `sourceIds` résolus vers une notice bibliographique avec URL HTTPS dans le même JSON. Le corpus s’appuie sur des musées, des universités, des publications savantes, des institutions patrimoniales et, pour certaines histoires de sanctuaires ou de missions, les institutions concernées. Les textes français et anglais sont des synthèses originales brèves ; le corpus ne reproduit pas les pages consultées ni leurs illustrations.

Les principales familles documentaires sont le Metropolitan Museum of Art, le British Museum, les musées universitaires de Penn et Yale, les notices et évaluations de l’UNESCO, Harvard Pluralism Project, Encyclopaedia Iranica, SOAS, Heidelberg, ANU, Max Planck et les institutions patrimoniales nationales. Les notices UNESCO décrivent des sites patrimoniaux : leur inscription contemporaine n’est jamais utilisée comme date d’origine du culte. Une histoire institutionnelle ou un récit traditionnel ne devient pas automatiquement une datation archéologique certaine.

Le JSON conserve les références, mais ne revendique pas une licence uniforme sur les sources liées. Les droits des textes et images des sites cités restent ceux de leurs détenteurs. Les polygones sont une géométrie éditoriale de ce projet, pas une reprise de cartes protégées ni des périmètres officiels d’inscription UNESCO.

Les clés des symboles sont `cuneiform`, `ankh`, `laurel`, `menorah`, `faravahar`, `om`, `ahimsa`, `dharma-wheel`, `cross`, `crescent`, `khanda`, `yin-yang`, `confucian`, `torii`, `orisha` et `andean-sun`. Ce sont des identifiants visuels conventionnels de la légende ; leur affichage ne prétend pas que le symbole était utilisé à la date du premier jalon.

## Validation et enrichissement

Le fichier est une curation explicite, sans API ou service tiers au moment de l’affichage. `ReligionDatasetSchema` dans `lib/religions/types.ts` contrôle les types, les bornes des coordonnées, les IDs uniques, la résolution des sources et traditions, les liens chronologiquement valides et la fermeture des polygones.

Validation locale ciblée :

```sh
pnpm exec tsx -e "import fs from 'node:fs'; import { ReligionDatasetSchema } from './lib/religions/types.ts'; const d = ReligionDatasetSchema.parse(JSON.parse(fs.readFileSync('public/data/religions/history.json', 'utf8'))); console.log(d.traditions.length, d.milestones.length, d.sources.length);"
```

Résultat lors de la livraison : `16 92 103`. Un contrôle indépendant des 54 contours a vérifié leur fermeture, l’absence d’auto-intersection et l’inclusion de leur point de référence. Les liens ont été relus sur le fond ; aucun lien entre cultures andines distinctes n’a été ajouté pour combler la chronologie.

Pour enrichir le corpus, ajouter une source spécifique pour chaque nouvelle assertion de date, de lieu ou de relation. Expliquer les fourchettes dans les deux langues, maintenir la convention astronomique, préférer une étape indépendante à une filiation supposée et documenter toute modification de l’année représentative. Une future couche de présence contemporaine ou de démographie nécessiterait un autre modèle et d’autres données.
