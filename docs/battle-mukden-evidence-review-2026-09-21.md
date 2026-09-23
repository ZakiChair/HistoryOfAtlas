# Mukden: manual evidence review, 21 September 2026

Approved a manual whole-battle profile for **Q384091**, independently reviewed by the integrating agent. CDB90 row 247 remains excluded: its 21 February start does not cover the published 19 February–10 March 1905 interval. None of its figures or uncertainty percentages enter this profile. The [Presidential Library collection](https://www.prlib.ru/section/683596) explicitly pairs the Julian and Gregorian dates; no further metadata change is required.

## Selected evidence

The [Japan Center for Asian Historical Records exposition](https://www.jacar.go.jp/exhibition/nichiro2/sensoushi/rikujou09_detail.html), explanatory section 解説, supplies one coherent set of rounded estimates:

| Aggregate participant               | Army strength | Casualties | Included loss categories      |
| ----------------------------------- | ------------: | ---------: | ----------------------------- |
| Japanese Manchurian Army at Mukden  |      ≈250,000 |    ≈70,000 | Killed and wounded            |
| Russian Manchurian armies at Mukden |      ≈310,000 |    ≈80,000 | Killed, wounded and prisoners |

These are opposing army-strength estimates, without a dated muster or an assertion that every counted soldier personally entered combat. The narrative attaches the losses to Mukden. It mentions civilian victims without quantifying them. Its linked record C06040752900 instead reports 77,576 military and military-employee deaths from the war’s beginning through 31 October 1905; that whole-war figure is excluded. Burial files, individual correspondence and ammunition records provide no imported personnel total. Original archival images were not independently transcribed.

## Comparison and scope

The [State Historical Museum account](https://rm.shm.ru/core/event/124) identifies three Russian armies and five Japanese armies. It estimates Russia at about 300,000 personnel with 89,000 losses, and Japan at over 270,000 with 71,000 losses; its loss categories are not separated. This corroborates the aggregate multi-army scope, while demonstrating numerical disagreement. It does not independently certify the selected JACAR figures. The public profile note discloses these alternatives without averaging them or inventing uncertainty bounds. The publications’ underlying numerical independence is unknown.

Two stable local military-unit IDs represent the opposing commands, with distinct sides and land medium. Component armies are not separately added. Strengths and casualties are approximate, participant-scoped military personnel. `deaths`, totals and unassigned quantities remain empty; missing deaths are not zero. The Russian casualty category is explicitly broader than the Japanese category. No equipment model or equipment polity is assigned.

## Validation and provenance

Before integration, the staged file passed the production `mergeBattleProfiles` parser and `BattleRecordSchema`, with strict checks against the existing dates and empty participant/totals/unassigned arrays. Simulation checks preserved both strengths, casualty values, unknown deaths and equipment. The current desktop/mobile budgets are 80/36: these allocate 36/44 and 16/20 representatives respectively, with a common personnel scale within each budget. A separate arbitrary budget of 40 also passed, allocating 18/22; it is not the mobile setting. The 36-model follow-up is recorded in `/tmp/historyofatlas-mukden-mobile-36-validation.json`. CDB247 remained rejected, and the published file was unchanged by the review.

Review artifacts are `/tmp/historyofatlas-mukden-manual-review.json`, `.audit.json`, `.validate.ts` and `.validation.json`. The validation script’s empty-participant precondition intentionally describes the pre-integration baseline. Three raw institutional pages and their SHA-256 manifest are cached under `/tmp/historyofatlas-mukden-manual-review.sources/`; all three hashes passed verification. This cache is research evidence, not a proposed public redistribution or an assertion of an open license. Direct source URLs above provide the durable citation trail.
