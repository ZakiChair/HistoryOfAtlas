# CDB90 middle-period follow-up evidence review — 22 September 2026

Eight previously unreviewed rows yield **one approved import, six holds and one existing manual profile preserved**. Prague adds two comparable forces; Culloden keeps its reviewed museum evidence. Two independently supported metadata corrections restore the full date extents of Maxen and Hondschoote without admitting their narrower CDB90 rows.

The current importer’s merged dry run gives **231 reviewed / 167 imported / 53 held / 11 manual**. All **166 pre-existing imported profiles compare deeply equal**, including the coordinating agent’s separately approved Entzheim row 36. Integration is now present in the curated and public catalogue. The 23 September continuation confirms the 231 reviewed / 167 imported / 53 held / 11 manual registry and passes the pinned importer check. The source decisions below remain unchanged.

The nine local CDB90 resources passed the manifest’s byte-count and SHA-256 checks at [pinned commit e0b35ec4d798cec3bb4e6970c0f6bb7aa69e2f4c](https://github.com/jrnold/CDB90/tree/e0b35ec4d798cec3bb4e6970c0f6bb7aa69e2f4c). The generated profile retains ODC-BY-1.0 attribution, immutable source URLs, statement identities and the original force labels. No original source date or number was changed.

## Decisions and scopes

The following counts are CDB90 estimates in **personnel**, in attacker/defender order. Every strength uses code 1, initial strength, and each row has zero tabulated reinforcements. `cas` means personnel battle casualties, not deaths. Institutional evidence establishes identity, chronology and scope; it does not independently certify these exact estimates.

| Row and public event              | Original initial strengths; casualties                                     | Decision                                                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 29 — Saint-Antoine, Q2890900      | Royal French 12,000 / rebel French 6,000; 4,000 / 2,000                    | Hold: 5 July 1652 in CDB versus 2 July in the public event and municipal narrative; a retrospective map preserves the conflicting 5 July inscription. |
| 61 — Kesselsdorf, Q695325         | Prussian 31,000 / Saxon 31,200; 5,000 / 6,630                              | Hold: source combat on 14 December 1745 versus institutional/public 15 December.                                                                      |
| 63 — Culloden, Q651919            | Jacobite 5,400 / government 9,000; 1,558 / 309                             | Preserve the existing manual profile and its five quantitative observations.                                                                          |
| 65 — Prague / Štěrboholy, Q223622 | Prussian 65,000 / Austrian 62,000; 14,300 / 13,400                         | Approve the complete field battle of 6 May 1757 with a reviewed article alias and two local army identities.                                          |
| 78 — Maxen, Q699758               | Austrian 38,000 / Prussian 13,500; 1,000 / 1,000                           | Hold the 20 November source phase; independently restore the public 20–21 November 1759 extent.                                                       |
| 83 — Quebec, Q1840117             | American 1,100 / British 1,800; 486 / 18                                   | Hold: source 1 January 1776 versus the documented assault on 31 December 1775.                                                                        |
| 99 — Hondschoote, Q1054868        | French Army of the North 42,000 / British–Hanoverian 13,000; 3,000 / 3,000 | Hold the source’s 6 September phase; independently restore 6–8 September 1793.                                                                        |
| 106 — Arcole, Q776609             | French Army of Italy 17,300 / Austrian 12,700; 4,500 / 7,000               | Hold: title and three-day dates agree, but the coverage of the Austrian force remains unresolved.                                                     |

### Prague: approved field battle, with a deliberate alias review

The [National Army Museum object record NAM.1999-04-194-1](https://collection.nam.ac.uk/detail.php?acc=1999-04-194-1) identifies the battle on 6 May and distinguishes it from the subsequent siege and relief operation. The [Royal Collection Trust’s 1758 map, RCIN 732010](https://militarymaps.rct.uk/the-seven-years-war-1756-63/map-of-the-battle-of-prague-1757-prague-hlavni-mesto-praha-czech-republic-50deg0516n-14deg2514e-1), names the Prussian king and Charles of Lorraine’s Austrian army at that engagement.

Opening [Battle of Prague (1757)](<https://en.wikipedia.org/wiki/Battle_of_Prague_(1757)>) displays an explicit redirect to _Battle of Štěrboholy_, with its Wikidata link pointing to Q223622. The downloaded HTML preserves that notice, QID and [target revision 1370603153](https://en.wikipedia.org/w/index.php?title=Battle_of_%C5%A0t%C4%9Brboholy&oldid=1370603153). Wikipedia is used here for article identity, not as the source of the imported figures. The explicit `articleAliasReview` binds the source article, distinct published target, exact QID, date, explanation and evidence; removing that review causes the importer to reject the row.

The public battle previously had no participants or quantitative observations. Two local military-force identities are added, with English and French names for the Prussian army under Frederick II and the Austrian army under Charles of Lorraine. Both retain their original CDB90 `NAM` and commander evidence. Neither a separate relief army nor additional siege troops are inferred. Equipment remains unassigned.

The source’s nonzero strength error qualifiers produce lower bounds of 63,700 and 60,760; the central estimates remain 65,000 and 62,000. Casualty upper bounds are 14,443 and 13,668, with central estimates 14,300 and 13,400. Zero error qualifiers mean that possible deviation is unknown, so those sides receive no numerical bound. These are source uncertainty qualifiers, not confidence intervals. The renderer uses the central estimates, which are also stated in the quantity notes.

### Date conflicts retained without source overrides

For **Saint-Antoine**, the [City of Paris neighbourhood booklet, p. 17](https://cdn.paris.fr/paris/2025/09/12/cq-agdl-livret-compression-Pdv5.pdf), dates the battle to 2 July 1652. Conversely, [Carnavalet G.39170](https://parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/plan-de-la-bataille-de-st-antoine-donnee-le-5-juillet-1652-entre-l-armee) records a retrospective map whose title and inscription say 5 July. The latter is genuine conflicting evidence, not a date the review silently repairs. Nothing read declares a calendar that explains this three-day difference. The existing person identity for Condé is not converted into an army.

For **Kesselsdorf**, the [Wilsdruff official gazette 07/2023, museum report on p. 3](https://www.wilsdruff.de/media/3727), explicitly gives 15 December 1745. CDB’s exact 14:00–17:00 interval instead falls on the 14th. The published 15th is retained. The shorthand Saxon army also does not establish how allied contingents are covered, but no separate force-scope verdict is required to recognize the date conflict.

For **Quebec**, [Parks Canada’s historic-event plaque](https://www.pc.gc.ca/apps/dfhd/page_nhs_fra.aspx?id=1439) identifies the failed American assault on 31 December 1775 and distinguishes the siege that continued until 1776. CDB’s exact interval on 1 January is not admitted by shifting the public date. The Canadian militia, British soldiers and sailors mentioned in the plaque are not turned into additional counts or a homogeneous infantry force.

### Culloden: retain the manual profile and calendar provenance

The [National Army Museum account](https://www.nam.ac.uk/explore/battle-culloden) distinguishes the Jacobites at the battle from those elsewhere and separates government deaths from wounded. The existing profile already records these definitions: strengths 9,000 and approximately 5,000, government deaths 50 and casualties 309, and the Jacobite death estimate with its range. CDB’s 5,400 and casualty figure 1,558 must not replace that manually reviewed scope or be reclassified as deaths.

NAM and CDB give the conventional 16 April date. The cached Wikidata claim selected for the public record explicitly declares **27 April 1746 with the Gregorian calendar model Q1985727**. This review preserves that evidence; it does not silently convert an undeclared source calendar or rewrite the public date. The staged decision is `reviewed-existing`, and Culloden never enters the generated CDB profile file.

### Maxen and Hondschoote: independent extent corrections

For **Maxen**, [RCT RCIN 731066.bb](https://militarymaps.rct.uk/the-seven-years-war-1756-63/map-of-the-battle-of-maxen-1759-maxen-saxony-germany-50deg5530n-13deg4805e) dates the Daun–Finck fighting to the 20th; the historical abbreviation `9bre` denotes November. The scholarly edition [_Carteggio con Daniele Florio_, Genoa University Press, p. 92](https://gup.unige.it/sites/gup.unige.it/files/pagine/Carteggio_con_Daniele_Florio.pdf), explicitly dates the victory to 20–21 November 1759. The proposed extent includes both days without asserting uninterrupted combat.

CDB covers only the 20th and leaves a Prussian final strength of 12,500 after 1,000 casualties. That does not establish a complete accounting of the resulting surrender. No prisoner total from the literary material is adopted, no prisoners are added to CDB, and no narrower casualty category is invented. A separate ULB PDF lead redirected to an error page and is not used as evidence.

For **Hondschoote**, the [Gendarmerie nationale heritage account by Colonel Laurent Vidal](https://www.gendarmerie.interieur.gouv.fr/gendinfo/histoire/un-peu-de-terre-de-france-sur-le-drapeau) explicitly describes fighting from 6 to 8 September and calls the 8th the last day. The public extent therefore changes from the final assault alone to 6–8 September. CDB has only the 6th; its source-title variant does not resolve that difference. Its York command label and relation to the nearby Dunkirk siege also remain unreviewed. The institution’s unit-level gendarmerie strength and losses are not imported as army totals.

### Arcole: an accepted alias does not prove a complete force cohort

The explicit redirect from [Battle of the Bridge of Arcole](https://en.wikipedia.org/wiki/Battle_of_the_Bridge_of_Arcole) reaches _Battle of Arcole_, whose cached page links Q776609 and [revision 1375546322](https://en.wikipedia.org/w/index.php?title=Battle_of_Arcole&oldid=1375546322). Its full 15–17 November dates match CDB and the [municipal museum’s day-by-day account](https://www.comune.arcole.vr.it/home/vivere/storia-del-museo-napoleonico/Epoca-Napoleonica.html).

That museum narrative describes several columns and Austrian reinforcements during the engagement. The [Fondation Napoléon account](https://www.napoleon.org/en/magazine/places/arcole-2/) distinguishes Alvinczy’s force from Davidovitch’s separate force and Wurmser’s troops at Mantua. The evidence read does not establish whether CDB’s 12,700 initial Austrians and 7,000 casualties cover the entire battle or a narrower cohort. It also does not prove that reinforcement movements necessarily came from outside the initial aggregate. Therefore this is an **unresolved scope hold**, not a claim that the numbers are false merely because other estimates differ. The row passes technical alias, date and quantity gates when trial-approved, but remains historically held.

## Preservation, validation and reproducibility

Across the eight frozen public events, **10 existing participant identities, 20 participant-source entries and five quantitative observations** are retained. None of the existing identities is replaced. All five observations belong to the preserved Culloden manual profile. Prague’s two new local armies therefore cause no loss or regrouping of older citations. Totals and unassigned arrays remain unchanged.

The following checks ran against the current production parser and runtime, using temporary outputs only:

```sh
pnpm exec tsx /tmp/historyofatlas-cdb-middle-next-metadata-validate.mts
python3 /tmp/historyofatlas-cdb-middle-next-import-validate.py
pnpm exec tsx /tmp/historyofatlas-cdb-middle-next-runtime-validate.mts
```

- Both metadata patches parse, apply in memory and reject deliberately stale expected dates before mutation. Participants, references, quantities and geographic fields are unchanged.
- The merged import has no quarantined approved rows. All 166 existing imported profile records remain deeply equal, including Entzheim. Culloden’s complete public record remains equal in the temporary result.
- Prague passes the profile and public-record schemas and has comparable opposing strengths. At budget 80 it receives 41/39 figures; at budget 36 it receives 18/18. Both sides share the same scale at each budget and remain within the cap. The latter rounding does not claim equal actual strength.
- No death quantities, explicit equipment models, modern actor assignments, public build or global test run were introduced by this review.

Temporary artefacts use the prefix `/tmp/historyofatlas-cdb-middle-next-`:

| File suffix                                                                     | Contents                                                                                                                                                                               |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proposal.json`                                                                 | Eight additive registry decisions, explicit aliases and the Prague force identity reviews.                                                                                             |
| `metadata-proposal.json`                                                        | Strict original-value guards and independent Maxen/Hondschoote extents.                                                                                                                |
| `profiles.json`                                                                 | The single dry-generated Prague profile.                                                                                                                                               |
| `import-validation.json`, `metadata-validation.json`, `runtime-validation.json` | Actual schema, guard, preservation, import and rendering results.                                                                                                                      |
| `merged-registry-dry.json`, `merged-intake-dry.json`                            | Proposed combined registry and complete status accounting.                                                                                                                             |
| `provenance-audit.json`, `public-before/`, `corrected-events/`                  | Frozen original participants, references and records; temporary metadata results.                                                                                                      |
| `raw-match.json`, `culloden-raw-dates.json`                                     | Pinned CDB inputs and cached Wikidata calendar evidence.                                                                                                                               |
| `sources/manifest.json`                                                         | Thirteen cached source responses, their URLs, byte counts and hashes, plus the failed direct Gendarmerie cache request. Its published text was successfully read through the web tool. |
| `frozen-sha256.json`                                                            | Handoff hashes for the three integration proposals.                                                                                                                                    |

Frozen handoff SHA-256 values:

```text
proposal.json          5850937571515bf624ec694859cee64453591a635cf20e4680f25bd7c91e97c7
metadata-proposal.json aa66d97b478064a3c5475a15dc63337c527f86c3699950ce5948065dff40e2c1
profiles.json          fa3760d45b977d740ec2bf29531d0f31341264027d4431a51c9da8c4fdd4df8f
```
