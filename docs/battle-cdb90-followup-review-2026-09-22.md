# CDB90 follow-up review — 22 September 2026

This historical review was integrated into the curated registry and rebuilt public catalogue by the coordinating agent. Eight previously unreviewed, uniquely matched English articles were examined against the pinned CDB90 files and current public records. Six imports and seven separate date corrections are integrated; Lundy’s Lane and Chickamauga remain excluded from the CDB import. The original dry review changed no live files. Production checks and browser validation are recorded in the continuation checkpoint.

The baseline is 207 reviewed source rows: 159 imported, 38 held/rejected, and 10 covered by manual reviews. The proposed merged registry contains **215 reviewed: 165 imported, 40 held/rejected, and 10 manual**. All 159 existing imported profiles remain byte-equivalent as parsed records in the dry import.

## Source and method

The source remains [jrnold/CDB90 at revision e0b35ec4d798cec3bb4e6970c0f6bb7aa69e2f4c](https://github.com/jrnold/CDB90/tree/e0b35ec4d798cec3bb4e6970c0f6bb7aa69e2f4c), under the existing ODC-BY-1.0 manifest and attribution. The actual acquisition verifier checked all nine pinned resources before the dry import. Exact DBpedia article identity, existing English Wikipedia source identity, full active-period dates, parent-row exclusion, military-force interpretation, and strength-code guards were exercised by the existing importer. No fuzzy match or altered source date was accepted.

Institutional evidence checks dates and the identity and extent of the engagement. Agreement in order of magnitude is **not** independent certification of CDB90’s numbers. All quantities remain approximate source estimates; `cas` means personnel battle casualties, not deaths. Source margins are retained without interpreting zero as certainty or nonzero percentages as statistical confidence intervals. No model assignment is added.

## Decisions

Counts below are the unchanged CDB90 central estimates, attacker / defender. Both strength and casualty units are military personnel.

| Row / event                       | Decision and proposed Gregorian extent              |        Strength |      Casualties |
| --------------------------------- | --------------------------------------------------- | --------------: | --------------: |
| 12 / Q1754785, second Breitenfeld | Approve, 2 November 1642                            | 25,000 / 30,000 |  5,000 / 15,000 |
| 38 / Q695057, Fehrbellin          | Approve, 28 June 1675                               |   6,000 / 6,400 |     500 / 2,500 |
| 43 / Q644960, Boyne               | Approve, 11 July 1690                               | 35,000 / 23,000 |   2,000 / 1,500 |
| 100 / Q1059732, Wattignies        | Approve, 15–16 October 1793                         | 44,000 / 23,000 |   4,500 / 3,000 |
| 139 / Q543994, Hanau              | Approve, 30–31 October 1813                         | 60,000 / 40,000 |  5,000 / 15,000 |
| 148 / Q364322, Lundy’s Lane       | Hold; keep 25 July 1814                             |   2,000 / 3,000 |       860 / 878 |
| 160 / Q2888281, Cerro Gordo       | Approve, 17–18 April 1847                           |  8,500 / 12,000 |     431 / 4,000 |
| 200 / Q1327790, Chickamauga       | Hold; independently correct to 18–20 September 1863 | 66,326 / 58,222 | 18,454 / 16,170 |

### Breitenfeld

The [HAB / University of Freiburg introduction to the 1642 diary edition](https://diglib.hab.de/edoc/ed000228/introduction/introduction_1642.xml) pairs 23 October with 2 November and identifies Torstensson against Leopold Wilhelm and Piccolomini’s imperial-Saxon command. The raw cached P585 incorrectly labels the October date Gregorian; this is a sourced correction, not an automatic conversion of that tag. `IMP ARMY` remains one aggregate, with no additional Saxon total. The XML edition is cited instead of its PDF export, whose editorial notice says the export is not citable.

### Fehrbellin

[GHI’s contemporary engraving catalogue](https://germanhistorydocs.org/en/the-holy-roman-empire-1648-1815/the-battle-of-fehrbellin-on-june-28-1675-c-1675) supplies 28 June. [Bundeswehr ZMSBw’s historical study](https://zms.bundeswehr.de/de/publikationen-ueberblick/zmg-2025-2-schlacht-von-fehrbellin-5937220) describes a short engagement and predominantly cavalry on the Brandenburg side. Its Swedish strength differs from CDB90; CDB90’s upper qualifier already reaches 11,008. ZMSBw’s loss estimate includes deserters and is not substituted for the source casualty category. The public 19 July endpoint is inconsistent with this battle; raw claims also contain mutually inconsistent June and July dates. No infantry model is inferred from the personnel unit.

### Boyne

[OPW](https://heritageireland.ie/visit/places-to-visit/battle-of-the-boyne-visitor-centre-oldbridge-estate/) labels 1 July Old Style; [the Irish public libraries’ visitor-centre account](https://www.askaboutireland.ie/reading-room/culturenet/landscape-heritage/louth/the-battle-of-the-boyne-v/) explicitly supplies 11 July in the modern calendar. Raw P585 contains both dates with the corresponding calendars. OPW’s 36,000 / 25,000 army estimates differ from CDB90 and remain disclosed, without averaging. The local labels are Williamite and Jacobite armies; neither total is restricted to English nationality or divided among contingents.

### Wattignies

The [Hauts-de-France Inventaire record on POP](https://pop.culture.gouv.fr/notice/merimee/IA59001922) gives both 15 and 16 October. The [Ministry of Culture’s painting record](https://pop.culture.gouv.fr/notice/memoire/AP45F00857) identifies Jourdan and Clerfayt. CDB90’s French Army of the North and Austrian army are bounded to this engagement, not expanded to the whole coalition or the separate siege force at Maubeuge. The monument’s location is not used as a battlefield coordinate.

### Hanau

The [City of Hanau chronology](https://www.hanau.de/stadtentwicklung/geschichte/geschichtsdaten/index.html) and [HDBG’s Bayerisches Armeemuseum object commentary](https://portale.hdbg.de/koenigreich-bayern/objekte/objekt/295) establish both days and Wrede’s Bavarian-Austrian force opposing the French main army, followed by rear-guard fighting. HDBG estimates approximately 30,000 allies and a French main force twice that size; this does not certify CDB90’s 40,000 / 60,000. The original `BAV ARMY` is kept in provenance and clarified as an aggregate command, without adding Austrian troops.

CDB90’s code 3 French total is 30,000 initial plus 30,000 reinforcements. The defender’s code 1 initial 40,000 has zero source reinforcements. The importer accepts this documented equivalence over the whole engagement. The proposed note explicitly rejects interpreting the French total as opening strength or simultaneous presence in the firing line.

### Lundy’s Lane — hold

[Parks Canada’s designation](https://www.pc.gc.ca/apps/dfhd/page_nhs_eng.aspx?id=428) dates combat to 25 July and describes retirement by midnight, distinguishing the next-day withdrawal. CDB90 spans 25–26 July. No independent evidence read here establishes combat on the 26th; changing the public date merely to accommodate the source would merge different scopes. The hold is temporal, not a rejection based on the differing approximate strength estimate.

### Cerro Gordo

The [Library of Congress catalogue of the contemporary McClellan / Turnbull map](https://www.loc.gov/item/2018593098/) explicitly identifies 17–18 April. [CMH’s campaign summary](https://history.army.mil/Research/Reference-Topics/Army-Campaigns/Brief-Summaries/Mexican-War-Campaigns/) labels 17 April; [AMEDD’s official history](https://achh.army.mil/history/book-civil-gillett2-amedd-1818-1865-chpt6/) dates the victory to the 18th. Their U.S. 64 killed plus 353 wounded differs from CDB90’s 431 casualties. CMH separately describes Mexican casualties and prisoners; neither category is relabelled as deaths or used to overwrite CDB90.

### Chickamauga — hold and independent date correction

[NPS’s ranger programme](https://www.nps.gov/chch/chickamauga163rangertours.htm) explicitly calls 18 September the opening day and the 19th the second, and identifies participation across all three days. The full engagement therefore runs 18–20 September. CDB90 begins on the 19th. Its two-day phase is not imported as a whole-battle profile, even though the public final-day-only date also needs correction.

## Identity and provenance preservation

The seven old participant IDs in Breitenfeld, Boyne, and Cerro Gordo are explicitly replaced by local event forces. No claim is made that the old IDs survive. All fourteen old participant citation URLs survive the proposed merge: twelve in frozen `identityReview.sources`, two at the battle level through the Boyne metadata patch. Every old participant quantity array is empty; existing totals and unassigned observations remain unchanged.

Boyne’s Williamite and Dutch Republic observations accompany the Williamite aggregate; Jacobitism and French kingdom observations accompany the Jacobite aggregate. The Kingdom of Scotland observation does not establish a unique camp and is retained only as battle-level provenance, explicitly distinguished from date evidence. No five extra national silhouettes are added on top of the two coalition totals.

Coordinates are unchanged. Being mapped in the current catalogue is not a fresh certification of the supplied point. In particular, the inherited Breitenfeld and Hanau locations may be broad city positions; their separate geographical review is outside this quantitative batch.

## Artifacts and validation

All integration proposals are staged in `/tmp`:

- `historyofatlas-next-cdb-proposal.json`: eight additive registry decisions, including six approvals.
- `historyofatlas-next-cdb-metadata-proposal.json`: seven strict `expected` patches from frozen public records.
- `historyofatlas-next-cdb-profiles.json`: six actual importer outputs.
- `historyofatlas-next-cdb-{metadata,import,runtime,provenance}-validation.json`: detailed checks.
- `historyofatlas-next-cdb-merged-intake-dry.json`: simulated full intake accounting.
- `historyofatlas-next-cdb-public-before-hashes.json` and `historyofatlas-next-cdb-raw-dates.json`: public snapshot hashes and cached calendar claims.
- `historyofatlas-next-cdb-sources/manifest.json`: raw downloaded institutional examples with URLs, byte counts, SHA-256, and explicit acquisition failures. LoC and Ask About Ireland returned indexed publisher content through the web tool but rejected direct downloads; they are not represented as downloaded bytes.

Validation commands, all writing only temporary files:

```sh
npx tsx /tmp/historyofatlas-next-cdb-metadata-validate.mts
python3 /tmp/historyofatlas-next-cdb-import-validate.py
npx tsx /tmp/historyofatlas-next-cdb-runtime-validate.mts
```

The metadata schema and all seven atomic applications pass. The actual pinned-source importer yields six profiles with no quarantine. The full dry merge keeps all 159 old profiles unchanged. Both profile and public-record schemas pass, and all six profiles have comparable opposing personnel counts. At budgets 80 / 36, allocated totals are respectively: Breitenfeld 55 / 36; Fehrbellin 13 / 13; Boyne 58 / 36; Wattignies 67 / 36; Hanau 80 / 36; Cerro Gordo 21 / 21. Each battle’s two forces share a scale and remain visible. These are allocation checks, not a claim of equipment completeness or browser validation.

Integration must apply the approved metadata first, rebuild the events, then merge the registry decisions and run the importer. No global build or test was run for this staging task.

## Subsequent geographic review

The [Breitenfeld/Hanau location review](battle-breitenfeld-hanau-location-review-2026-09-22.md) withdrew Breitenfeld II’s inherited Leipzig-centre point after inspection of an official regional battlefield map. Its new quantities remain available, but it is unmapped and cannot animate in situ. Hanau retains an explicitly uncertain town-area proxy: the main field and the urban action are distinguished. The earlier dry-run coordinate output above predates this separate correction.
