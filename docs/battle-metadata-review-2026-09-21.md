# Reviewed battle metadata — 21 September 2026

Three previously unmappable records have reviewed metadata in `data/curated/battle-metadata.json`. Each patch includes its exact previous start, end and coordinate values; the published record preserves this snapshot, the review note and source links. These three QIDs are absent from the original `public/data/events` corpus.

| Battle                | Published before                                                                                       | Reviewed change                      | Evidence precision                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Q109065540, Ovčí vrch | Start 1680-05-06; no accepted coordinates; `land-event-in-open-ocean`                                  | Coordinates `[12.931085, 49.887941]` | Official chapel/monument GPS on the documented battlefield; not a surveyed battle perimeter |
| Q118593994, Ghent     | No start; end year 1678; existing coordinates `[3.725277777777778, 51.05361111111111]`; `missing-date` | Start `{year:1678, month:3}`         | Month only; no exact opening day asserted                                                   |
| Q123739799, Mscislaŭ  | No start; end April 1659; existing coordinates `[31.7247, 54.0196]`; `missing-date`                    | Start `{year:1658}`                  | Year only; no opening month/day asserted                                                    |

Verified catalogue result after schema, land-mask and chronology validation: three additional mappable records, from 16,841 to 16,844, and three fewer unmapped records, from 6,756 to 6,753. The full catalogue remains 23,597 records. Quantities, identities, camps, equipment, the original event corpus and existing end dates are unaffected.

## Ovčí vrch: official battlefield landmark

The [Municipality of Kokašice history](https://www.kokasice.cz/obec/historie/ovci-vrch/ovci-vrch-14cs.html) places the fighting on 6 May 1680 and explicitly locates the chapel on the battlefield, using “na bojišti.” It distinguishes the chapel's plateau from the main summit.

The [Municipality of Otročín page](https://www.otrocin.eu/volny-cas/turisticke-cile/kopce-priroda/ovci-vrch-kaple-a-pomnik-0_58.html) supplies GPS 49°53′16.587″ N, 12°55′51.905″ E for the chapel and monument. It is explicitly identified by `coordinateSourceUrl` in the patch. Conversion is arithmetic: degrees + minutes/60 + seconds/3600, reordered as longitude/latitude and rounded to six decimal places. This does not infer a point by swapping the invalid battle coordinates. The point identifies the documented landmark, not every position occupied in the battle. No source surveying accuracy is claimed.

## Ghent: March 1678, with the royal-arrival date excluded

The [French Service historique de la Défense map inventory](https://www.servicehistorique.sga.defense.gouv.fr/sites/default/files/2019-10/SHD%20bataille%20inventaire%2089-194.pdf), item 346, printed p. 112 / PDF page 23, describes a contemporary view of the town and citadel under siege in March 1678. It identifies the related official siege journal as A¹ 596, piece 198. This supports month-level recovery for the missing start.

The [BnF Louvois authority record](https://catalogue.bnf.fr/ark:/12148/cb119619611) cites a published letter whose title associates Louis XIV personally with the siege on 4 March. A follow-up scope check found that this was the royal arrival, after the investment of the town. The published correction therefore uses month precision. A [transcription of the royal medal narratives](https://www.quinault.info/accueil/loeuvre/m%C3%A9dailles-et-jetons/prise-de-gand) distinguishes investment on 1 March, royal arrival on 4 March, and trench opening the following day. No exact day or new surrender date is imported. The retained coordinates already identify the named besieged town, with their original linked-place provenance; they are not newly substituted battlefield coordinates.

## Mscislaŭ: archival research establishes 1658

[A. V. Malov, Ural State University journal, 2004, no. 33](https://elar.urfu.ru/bitstream/10995/23374/1/iurg-2004-33-19.pdf), printed p. 162 / PDF page 3, reconstructs the operation from Russian State Archive of Ancient Acts records and published state documents. Kozlovsky departs Moscow on 24 September 1658, moves through Smolensk toward Mscislaŭ, and has already besieged it when Lobanov-Rostovsky arrives after receiving November pay. This establishes an autumn 1658 beginning, but not an exact opening date.

The proposal records only the year 1658. It does not turn a departure day into the siege's opening day, does not import Wikipedia's inferred October precision, and does not assert 1 January. The existing April 1659 end and city-place coordinates remain unchanged. No day-level calendar conversion is introduced.

## Cases held outside the patch

- **Q3555607, Ecbatana:** [Encyclopaedia Iranica's Ecbatana entry](https://www.iranicaonline.org/articles/ecbatana/) locates the ancient city but states that Antiochus VII's attempt probably stopped short of it. This is insufficient to turn the ancient-city point or modern Hamadan centroid into the final battlefield. Offshore coordinates are not repaired by swapping digits.
- **Q2984977, Cape St Vincent, 1606:** the catalogue has only an end date, 19 June 1606. The [Spanish Navy's Fernández Duro edition](https://armada.defensa.gob.es/html/historiaarmada/tomo3/tomo_03_14.pdf) dates Fajardo's departure to 16 June and describes subsequent combat, without establishing the opening day in the inspected passage. Other accounts link this action to an October encounter. The departure day and existing end date are not promoted to a start; source identity and chronology need further review.
- **Q131753579, Chaul:** the [Maharashtra gazetteer's Korlai history](https://gazetteers.maharashtra.gov.in/cultural.maharashtra.gov.in/english/gazetteer/Kolaba%20District/appendix_k.html) dates the counterattack on the fort to 4 September 1594 while preserving a 1592/1594 source disagreement. The [Gulbenkian HPIP fort entry](https://hpip.org/en/heritage/details/929) dates the decisive battle to September 1594. These do not establish the start of the preceding siege. No phase date is substituted for the whole siege.

## Source cache and review checks

`/tmp/historyofatlas-metadata-source-cache/manifest.json` records source URLs, snapshot timestamps, successful byte counts and SHA-256 digests, and failed fetches. The successful snapshots were saved between 18:57:33 and 18:58:19 UTC on 21 September 2026. Cached material includes both municipal pages, BnF, the SHD inventory and the Malov article. Failed direct downloads of Chaul pages are recorded; their indexed evidence is used only to explain the hold, not to support a published correction. A Wikipedia page was used to locate Malov's university-hosted article and is not a source for the patch. The source links above are the enduring citations; temporary cache paths are retrieval evidence only.

The three recovered records passed source preconditions, schema, land-mask, chronology and published-data checks. Their original event-file absence and coordinate conversion were checked during review. Historical uncertainty remains explicit in every note.

## Eckmühl: reviewed correction of an inherited place

Integrated catalogue correction: Q700860, Battle of Eckmühl, moves from Munich `[11.575, 48.1375]` to the official Schloss Eggmühl site point `[12.183163, 48.843924]`. Keep 22 April 1809 and the absent end date unchanged. This repairs a location already classified as mappable; it adds zero mapped battles.

The battle is present in both `public/data/events/Q700860.json` and the independent battle catalogue. Both inherited Munich through `coordinateSource.entityId = Q1726`. The cached battle entity has no P625 claim. Its P276 statement `Q700860$B4192F77-C711-48AF-80B4-1B1D338F847C` names Munich and cites an import from French Wikipedia. [Wikidata revision 2500957102](https://www.wikidata.org/w/index.php?title=Q700860&oldid=2500957102) still showed this location at review time. The error is an incorrect linked place, not coordinate order or numerical parsing.

The [municipal account of the 215th anniversary](https://www.schierling.de/kultur-freizeit/kultur-termine/2111-gedenkveranstaltung-zu-215-jahre-schlacht-bei-eggmuehl) explicitly relates the event to the battle of 22 April 1809 and describes the historic assault on Schloss Eggmühl's still-surviving wall. This establishes actual fighting at the castle; selecting it does not depend merely on the commemoration taking place there. The account was available through the web search index, which reported a crawl three months earlier. A direct fetch now returns a generic municipal page without the event body, apparently after a site migration. The audit records this access limitation; the generic HTML response is not evidence of the assault passage.

The [Landratsamt Regensburg castle listing](https://pages.destination.one/de/landkreis-regensburg/streaming/detail/POI/p_100003509/schloss-eggmuehl) remains directly accessible. Its JSON-LD names the district administration as author, identifies Schloss Eggmühl at Kirchplatz 1, and publishes latitude `48.843923667897869`, longitude `12.183163404442897`. The proposed tuple stores longitude first and rounds to six decimals. It represents the official castle POI within a documented fighting sector, not the whole battlefield or an exact historical wall position. No city centroid, arbitrary memorial point, or guessed coordinate correction is used.

The raw county page was saved at 2026-09-21T19:06:11.334881+00:00; SHA-256 `d8335bcf4bbac987c55ef41f72fa2335b28648774102c729ee028d8f12f94261`. Supporting snapshot metadata and the indexed-content observation are under `/tmp/historyofatlas-eckmuhl-source-cache/`. The proposal is `/tmp/historyofatlas-eckmuhl-metadata-review.json`; `/tmp/historyofatlas-eckmuhl-metadata-before.json` stores both full before records, their hashes, and the raw location claim.

Validation passed: the proposal's expected start, nullable end, and coordinate tuple match both current records; the new point equals the rounded official GeoCoordinates; the source battle lacks P625 and links P276 to Munich. The correction is integrated into the independent catalogue with a specific reviewed exception in its preservation check. Original event-file bytes remain untouched, and all unreviewed values must still match them.

## Integration contract

`pipeline/battles/metadata.ts` validates the exact before-values before any change and commits only after the complete corrected record passes validation. It preserves day/month/year precision, quantities and participants, updates the browsing era/region, and removes only reasons resolved by the patch. The panel exposes the coordinate basis and named source. `check.ts` verifies metadata coverage, output values and provenance. Original atlas records are retained; an original date or coordinate may differ in the independent battle catalogue only when an explicit reviewed patch matches both its original value and its corrected output. Eckmühl is the sole such exception in this review. The main `public/data/events` corpus is not rewritten.

## Herbsthausen / Mergentheim date review — 21 September 2026

Correct Q913821 from **2 May 1645** to **5 May 1645**, retaining day precision. The City of Bad Mergentheim identifies the battle by name and date. The State Office for Heritage independently uses the same date in its archaeological opinion for the Furtwiesen site, reproduced on page 15 of the municipal consultation document dated 22 July 2025.

- [City of Bad Mergentheim: Herbsthausen](https://www.bad-mergentheim.de/de/verwaltung/stadtteile/bad-mergentheimer-stadtteil-herbsthausen-id_436/): the introductory historical paragraph explicitly dates the battle to 5 May 1645.
- [Landesamt für Denkmalpflege opinion, municipal planning file, page 15](https://ratsinfosystem.bad-mergentheim.de/buergerinfo/getfile.php?id=80705&type=do): locates the archaeological area in the battlefield of 5 May 1645; its discussion of Merian is used here only to corroborate event identity, not to derive new coordinates.
- [ADB Mercy, Heinrich Reusch, 1885](https://www.deutsche-biographie.de/sfz61891.html): independently describes the battle at Herbsthausen on 5 May. This is supplementary evidence; the patch cites the two institutional local sources.

This is a correction of the historical civil day, not an inferred calendar conversion. No hour is supplied. The former 2 May day cannot be reconciled with 5 May by a Julian/Gregorian offset. No evidence supports a battle lasting from 2 to 5 May.

Exact expected published values are start `{year:1645,month:5,day:2}`, end `null`, coordinates `[9.829,49.402]`. Only start changes. Coordinates and missing end remain as supplied by the catalogue. The patch does not assert that the retained point is the newly researched battlefield position.

The CDB90 source row 17 remains dated 2 May 1645 and rejected. Correcting the public historical date does not alter CDB, its loss/strength estimates, or make it eligible for import. The approved metadata patch changes the independent battle catalogue only; original atlas event files and raw source data remain untouched.

## Modern chronology follow-up

Four additional strict reviews correct original atlas dates only inside the independent battle catalogue. All coordinates and the original `public/data/events` records are preserved.

| Battle                | Previous catalogue dates                                     | Reviewed dates                                                       | Numerical import                                   |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------- |
| Mukden, Q384091       | 6–25 February 1905, Julian numerals without calendar context | 19 February–10 March 1905, Gregorian expression of the same interval | CDB 247 remains held; it starts 21 February        |
| Festubert, Q1989637   | 27 May 1915 only                                             | 15–25 May 1915                                                       | CDB 292 remains held; it spans 16–26 May           |
| Third Isonzo, Q637320 | 18 October–3 November 1915                                   | 18 October–4 November 1915                                           | CDB 298 approved after this independent correction |
| First Gaza, Q2791318  | 26 March 1917 only                                           | 26–27 March 1917                                                     | CDB 326 remains held for force identity and scope  |

The [modern chronology audit](battle-cdb90-modern-dates-review-2026-09-21.md) lists institutional sources, access limits, raw calendar statements and the separate quantitative decisions. Each review records exact prior date and coordinate objects, so a changed source blocks stale application. The browser checks independently specify all four expected periods and navigate from the catalogue to their retained locations.
