# Cape St. George: evidence review, 21 September 2026

The approved manual profile for **Q700530, 25 November 1943**, is integrated in `data/curated/battle-profiles.json`. The numerical evidence review was conducted independently of the geographic review; the coordinate patch is integrated in `data/curated/battle-metadata.json`. This document records both decisions without deriving any force or loss count from the map.

The [Official Chronology of the U.S. Navy in World War II, 25 November](https://www.ibiblio.org/hyperwar/USN/USN-Chron/USN-Chron-1943.html) explicitly describes **five American destroyers against five Japanese destroyers**, three Japanese sinkings, damage to Uzuki, and no damage to DESRON 23. The American detachment comprises Charles Ausburne, Claxton, Dyson, Spence and Converse. It is not presented as DESRON 23’s entire administrative complement.

The [NHHC account by Samuel J. Cox, December 2018](https://www.history.navy.mil/about-us/leadership/director/directors-corner/h-grams/h-gram-024/h-024-1.html), section “Battle of Cape St. George,” identifies the three sinkings as Onami, Makinami and Yugiri. Uzuki and Amagiri escaped. It records a dud shell hitting Uzuki, confirms no American hits or personnel lost, and reports 647 Japanese sailors and naval aviation personnel lost. The last figure remains in the profile note: no killed/wounded/missing breakdown is imported. Later rescue submarines and air cover are outside the five-versus-five surface-vessel count.

These modern accounts provide the quantitative basis. The contemporary ONI claims flagged in the coordinating review—six enemy vessels and four sunk plus one probable—are not imported. The sources used here are not claimed to be statistically independent.

| Quantity                 |           American detachment | Japanese force | Animation treatment                                     |
| ------------------------ | ----------------------------: | -------------: | ------------------------------------------------------- |
| Engaged destroyers       |                             5 |              5 | Whole-participant `ships`; renderable                   |
| Ships sunk               |                             0 |              3 | Whole-participant `casualties`; renderable withdrawals  |
| Damaged surviving vessel | No damage explicitly reported |       1, Uzuki | Separate non-renderable `subset`, with explanatory note |

The damage observation is a different category, not a fourth sunk or withdrawn vessel. The renderer selects only the renderable participant-scoped ship loss, so no automatic 3+1 sum occurs. Both `deaths` arrays remain empty: ships sunk are never encoded as human deaths. Human quantities remain unclassified rather than inferred from ships.

Stable local military-unit IDs and explicit opposing sides represent the two complete surface forces. No explicit equipment `profileId` is assigned. At 1943 the existing naval resolver selects `steam-warship` as **representative**, avoiding an unsupported “documented-profile” claim for a generic industrial silhouette. It is not a Fletcher-, Mutsuki- or Fubuki-class reconstruction.

## Separate geographic review

The integrated coordinates are **[153.741667, -5.272222]**, longitude first. The [ONI combat narrative, official NHHC 2019 edition](https://www.govinfo.gov/content/pkg/GOVPUB-D221-PURL-gpo172671/pdf/GOVPUB-D221-PURL-gpo172671.pdf), chart on printed page 51 (PDF page 65), gives 5°16′20″ S, 153°44′30″ E. The coordinating agent visually reviewed the chart and its narrative; this numerical reviewer checked the resulting metadata and arithmetic conversion.

The point is the American DESDIV 45 approach position at **0143**, while turning toward the enemy after radar contact. It is not the first radar contact at 0141, an enemy position, a wreck, or the center of the complete pursuit. The chart’s datum and navigation error are unspecified; six decimal places express conversion, not modern survey accuracy. Its superseded enemy-strength and sinking claims supply none of the profile’s quantities. The battle date remains unchanged.

## Validation and provenance

Before integration, validation used production `mergeBattleProfiles`, `BattleRecordSchema`, `buildBattleSimulation`, `unitLossState` and `resolveUnitProfile`. It checked the empty-force baseline and preserved dates/coordinates. At the current desktop/mobile budgets of **80/36**, both scenes allocate five models per side at one ship per model. At completion the American side has five active models; the Japanese side has three withdrawn and two active, with zero models classified as dead. The single damaged survivor remains present as source evidence without becoming an animated loss.

Review artifacts are `/tmp/historyofatlas-cape-st-george-profile.json`, `.md`, `.validate.ts` and `.validation.json`. The raw chronology is cached under `/tmp/historyofatlas-cape-st-george-profile.sources/` with a verified SHA-256 manifest. NHHC publisher content was inspected through web search retrieval; direct opening and raw download failed, so no raw NHHC cache is claimed. The validation script retains the pre-integration empty-participant check. Direct source links provide the durable citation trail; these cache paths do not assert an open license.
