# Saint-Paul raid evidence review — 21 September 2026

**Decision: propose individual inclusion of Q2869902 as a naval engagement with separate land components.** The source class `Q876274` (naval warfare) currently excludes this event from discovery, but the sources below establish a specific amphibious attack in September 1809. This does not justify admitting that broad class globally. The proposals remain staged for integration; this review changes no curated, public or runtime file.

## Engagement and chronology

The [Royal Collection Trust record RCIN 735153](https://militarymaps.rct.uk/napoleonic-wars-1803-15/reunion-1809-reunion-indian-ocean-french-overseas-department-21deg0600s-55deg3600e) transcribes a contemporary print after naval officer Charles Leonard Irby. Its inscription dates the attack to **21 September 1809**, identifies Rowley’s squadron and Keating’s land force, and describes Sirius attacking the French frigate Caroline while troops take a battery. These are concrete combat actions, not simply a campaign title or an unopposed port visit.

Independent archaeological corroboration comes from the [Ministère de la Culture’s Embouchure battery account](https://archeologie.culture.gouv.fr/ocean-indien/fr/batterie-de-lembouchure). It identifies that battery as the first attacked on the morning of 21 September and describes excavated traces of its destruction. The [ONF interpretation panel](https://www.onf.fr/outils/activites/89c2ad90-39fe-4006-82d2-96bc496bbc0e/%2B%2Bversions%2B%2B/1/%2B%2Bparas%2B%2B/3/%2B%2Bass%2B%2B/2/%2B%2Bi18n%2B%2Bdata%3Afr?_=1719566169.189292&download=1) distinguishes the 1809 raid from the invasion of the island in 1810.

The cached entity, revision `2392936364`, gives Gregorian day-precision `P580` **20 September** and `P582` **28 September**. The strict metadata proposal aligns the start to the documented assault on **21 September**; it does not claim that expedition preparations began then. [Royal Museums Greenwich, BHC0593](https://www.rmg.co.uk/collections/objects/rmgc-object-12085), dates the arrangement to surrender public property to 23 September and British withdrawal to 28 September. The retained end therefore includes occupation, removal of shipping and demolition after the main assault, not eight days of continuous battle. The separate cached `P585` of 28 September must not replace the start.

## Location and its precision

The original event coordinate **[55.266666666667, −21]** is retained unchanged, with `coordinateSource.kind = event`. Its raw precision is **one minute of arc**. The sources locate fighting in Saint-Paul Bay, its waterfront batteries and the town; the northern landing at the Rivière-des-Galets mouth is a separate location in the operation.

RCT gives Saint-Paul itself as 21°00′34″ S, 55°16′14″ E, roughly 1.1 km from the raw anchor. This is a place identifier, not a surveyed ship position. Neither it nor the different Réunion-wide coordinate in the record’s title is substituted. The retained point is an approximate event anchor in the documented bay sector; this review does **not** independently certify its exact position, digitize a battery, or claim the landing occurred there. The metadata proposal changes the start only and checks the entire original start/end/coordinate tuple.

## Participants and quantities

Four local military-unit identities preserve two opposing camps and distinct media:

| Component                            | Medium | Reviewed strength                    |
| ------------------------------------ | ------ | ------------------------------------ |
| Rowley’s British squadron            | Naval  | Six ships                            |
| Keating’s British landing force      | Land   | Approximately 600 military personnel |
| French naval defenders at Saint-Paul | Naval  | Unknown                              |
| French shore defenders at Saint-Paul | Land   | Unknown                              |

The six vessels enumerated by the print are Raisonnable, Boadicea, Sirius, Nereide, Otter and the East India Company schooner Wasp. The ONF panel independently gives six. The quantity records the squadron, including support, without claiming that all ships fired simultaneously. Original inscription variants are preserved in qualifiers.

Caroline is positively identified, but it is not promoted to an exhaustive count of French naval defenders. The two recaptured British Indiamen are not added as French combatants. The ONF panel’s rounded 600 is retained with `approximate: true` for the 21 September landing and advance. Its scope is Keating’s military landing force; `counts: soldiers` denotes military personnel ashore, including sailors and marines, not Army infantry alone. It does not count all personnel aboard the squadron, and it is never added to ships. [Rowley’s and Keating’s official-letter excerpts in Royal Naval Biography](https://en.wikisource.org/wiki/Royal_Naval_Biography/Willoughby,_Nisbet_Josiah) establish the mixed soldiers, marines and seamen and describe fighting ashore. This accessible transcription identifies the original publication as the London Gazette, 13 February 1810; the Gazette original was not independently inspected here. The personnel estimate comes from ONF, not an arithmetic reconstruction of the letter excerpts. The source refers to the same landing and day; no contradictory force scope was established.

All deaths and casualties remain empty: no false zero, no conversion of merchant prizes into military losses, and no inference of sinking from capture or grounding. There are no copied raw observations, totals or `unassigned` entries; the cached entity has no such participant quantities. No explicit equipment profile is assigned.

## Staged files and bounded validation

- `/tmp/historyofatlas-saint-paul-inclusion-proposal.json`: strict `BattleInclusionsFileSchema`, with expected `P31 = [Q876274]`.
- `/tmp/historyofatlas-saint-paul-metadata-proposal.json`: strict metadata preconditions and combat-start adjustment.
- `/tmp/historyofatlas-saint-paul-manual-profile-proposal.json`: manual profile with four components, six British ships and approximately 600 British landing personnel.
- `/tmp/historyofatlas-saint-paul-validation.json`: results, source manifest and protected-file hashes.
- `/tmp/historyofatlas-saint-paul-validate.mts`: reproducible, isolated validation; `/tmp/historyofatlas-saint-paul-inmemory-record.json` is diagnostic output only.

Validation passed the production inclusion, metadata, profile and record schemas, the cached classification/exclusion gate, metadata application and inclusion provenance checks. At both focused budgets **80 and 36**, the simulation has 27 representatives: six British ships, one representative for the approximately 600 landing personnel, and two illustrative groups of ten for the unknown French components. Naval and land media remain separate. Both camps are identified, but `comparableOpposingForces`, `allArmiesQuantified` and `fullEvidenceCombination` remain **false**. Runtime equipment is partial: generic sailing ships and unclassified land forces, without a claim of reviewed equipment attribution.

The protected live inclusion/profile/metadata files and published index were byte-identical across this isolated validation. No global build, global test or browser check was run. Integration would add one battle and, with the retained coordinate, one mappable event; it would not increase the quantitative documented count.

Downloaded source bytes are cached under `/tmp/historyofatlas-saint-paul/`; their public URLs and byte lengths are in `sources.json`. SHA-256 digests below identify the reviewed snapshots, not guaranteed future server responses:

| Snapshot                                       | SHA-256                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `culture-embouchure.html`                      | `76f588f8bee415144e66ea7d97f292390cebc1f8f12f7cea545f4f2c75fce577` |
| `rct-735153.html`                              | `5cdd978a6b9a0749eae62be5bf4c7aa5370804c9a319f500b054c64e69e713d9` |
| `rmg-bhc0593.html`                             | `ed414eb2bf6df599be93a4bd31229b800400de294e31f9a31e9ca3a28dcacfa0` |
| `onf-saint-paul.pdf`                           | `5585a0b2ed6ef735a4cc1ad668e630dcb65d68d8e994be49595092a89c659f9d` |
| `wikidata-Q2869902.json`                       | `95c92e60a1bf5015c5feb276fe741588039249a2d8ac24d9822d53d06dc7938a` |
| `royal-naval-biography-official-excerpts.html` | `2d0e7ace426688ef5e92e9fd7a39f4465335b656075e9ec286b3bf74dd733bca` |

## Integration, 22 September 2026

The coordinator integrated the inclusion, strict start-date correction and partial force profile together, acquired the linked entities and rebuilt the catalogue. The published record retains the broad bay point and 28 September end, starts on 21 September and preserves the separate six-ship/approximately 600-person cohorts. The global catalogue integrity check passes. The isolated figures and untouched-file statements above describe the research stage; integrated browser checks and final measurements are recorded in the running implementation checkpoint.
