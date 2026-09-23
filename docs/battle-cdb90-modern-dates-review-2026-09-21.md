# CDB90 modern date review — 2026-09-21

The root integration applied four reviewed metadata corrections, imported Third Isonzo (row 298), and retained nine new holds. The live crosswalk contained 197 reviewed rows at screening, including all 33 compatible candidates from the preceding round. This pass inspected only unreviewed source rows dated 1900 or later with an exact DBpedia/enwiki article match to one published BattleRecord.

## Reproducible screening

- 131 unreviewed source rows match 61 distinct published events.
- None lacks year/month/day precision, either in the relevant catalogue bounds or in the CDB period bounds. Missing catalogue `end` is treated as the existing one-day event, not as unknown month/year precision.
- Actual parser outcomes: 125 full-date mismatches; 6 parent-linked subengagement rejections.
- Interval geometry: 89 CDB periods contained in catalogue events; 15 catalogue events contained in CDB periods; 15 disjoint intervals; 12 overlapping conflicts. Geometry does not prove historical scope.
- A hypothetical substitution of source dates leaves 119 mechanically compatible rows, 6 parent rejections, 5 incompatible initial/total-engaged scopes, and 1 contradictory initial-strength count. **Those 119 are not historical approvals.** Replacing catalogue dates with source dates would silently relabel phases as whole battles.
- Structural triage: 73 source phases/sectors, 7 article/event conflicts, 30 shorter source extents unresolved, 12 missing catalogue extents or unverified source extensions, and 9 other unresolved boundary conflicts. These are screening labels, not 131 completed source reviews. Ten promising whole-event candidates received the institutional review below.

Examples of source phases include the separate Okinawa sectors, Iwo Jima phases, First Marne sectors, Moscow defence/counteroffensive, and the two Cambrai phases. Exact article equality is inadequate when multiple source rows explicitly cover different sectors or days. Clear article conflicts include CDB Quang Tri 1972 attached to the catalogue 1968 battle, and Vaux/La Roche Wood July actions attached to Belleau Wood ending in June. No fuzzy actor or modern polity assignment was performed.

Screen and scripts:

- `/tmp/historyofatlas-cdb90-modern-dates-screen.json`
- `/tmp/historyofatlas-cdb90-modern-dates-screen.py`
- `/tmp/historyofatlas-cdb90-modern-dates-classify.py`

The screen is a pre-correction snapshot. Re-running after integration will deliberately produce fewer unreviewed rows.

## Ten reviewed candidates

| Source | Event                      | Finding                                                                                                                                                                                                          | Quantitative decision                 |
| ------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 244    | Liaoyang                   | JACAR battle period 26 Aug–4 Sep 1904; original casualty reporting period 24 Aug–5 Sep. CDB 25 Aug–3 Sep not established as full battle.                                                                         | Hold                                  |
| 245    | Sha-Ho                     | JACAR 8–18 Oct 1904 disagrees with CDB 5–18 and catalogue 5–17. The matching indexed Russian encyclopedia page now redirects elsewhere; not accepted as inspected evidence.                                      | Hold                                  |
| 247    | Mukden                     | Published 6–25 Feb 1905 preserves Julian numerals; source claims explicitly declare Julian calendar. Presidential Library pairs those dates with Gregorian 19 Feb–10 Mar. CDB starts 21 Feb and remains shorter. | Hold; independent calendar correction |
| 283    | Komarów                    | Army identities match, but 30 Aug CDB ending not established. Deutsche Biographie has a compressed 26/28 Aug victory chronology; Rauchensteiner describes 26–31 Aug.                                             | Hold                                  |
| 292    | Festubert                  | Official full battle 15–25 May 1915 corrects catalogue 27 May. CDB 16–26 May still conflicts. Canadian participation 17–25 is not used as full battle.                                                           | Hold; independent date correction     |
| 298    | Third Isonzo               | Official Defence chronology 18 Oct–4 Nov 1915 confirms complete bounds. Catalogue ends 3 Nov. Combined Italian Second/Third Armies against Austro-Hungarian Fifth Army retained as two local forces.             | Approve after end-date correction     |
| 302    | Es Sinn / CDB Kut-el-Amara | NAM identifies 28 Sep 1915. CDB begins 27 Sep; no inspected institutional source makes this a full combat day rather than preparation.                                                                           | Hold                                  |
| 312    | Fifth Isonzo               | Official chronology 11–16 Mar 1916; CDB 11–15 omits last day. Catalogue 9–15 also disagrees.                                                                                                                     | Hold                                  |
| 313    | Asiago                     | Official Austrian Trentino offensive 15 May–18 Jun 1916; Italian counteroffensive 16 Jun–24 Jul. CDB ends 10 Jun, before offensive end. Catalogue 27 Jul also needs event-scope reconciliation.                  | Hold                                  |
| 326    | First Gaza                 | AWM establishes 26–27 Mar 1917. CDB Ottoman NAM `TK 8TH ARMY`, 26,000 initial personnel, not reconciled with documented Gaza garrison/reinforcing forces.                                                        | Hold; independent end-date correction |

The Gaza hold is **not** based on automatically equating rifles/effectives with all personnel. Gullett’s official history, printed p. 265, describes about 15,000 Ottoman rifles across Gaza and its reinforcement ring and about 22,000 British effectives; those measures do not certify or numerically disprove CDB 26,000/25,000. The original force designation and command scope remain unresolved. Later Gullett material still calls Kressenstein’s September command Fourth Army. No replacement of an army total with a garrison total was attempted.

## Review artifacts and integration

- `/tmp/historyofatlas-cdb90-modern-dates-metadata.json`: one strict metadata patch, Third Isonzo.
- `/tmp/historyofatlas-cdb90-modern-dates-crosswalk.json`: one approved match, 298, with source-backed local identityReview names. Original NAM and numerical estimates unchanged.
- `/tmp/historyofatlas-cdb90-modern-dates-independent-metadata.json`: three strict standalone patches, Festubert/Gaza/Mukden. These **do not** approve the associated CDB rows.
- `/tmp/historyofatlas-cdb90-modern-dates-holds.json`: nine rejected candidates with sources and audit categories. Rejected means excluded from this whole-battle intake; it does not claim that every original estimate is false.
- `/tmp/historyofatlas-cdb90-modern-dates-russo-japanese.json` and `.md`: independent three-case evidence review, including original Mukden Wikidata date claims.
- `/tmp/historyofatlas-mukden-metadata-review.json`: original standalone Mukden patch, already included in the combined independent file; do not apply twice.

Integration order matters: metadata correction, battle rebuild, CDB crosswalk/import, final rebuild. The importer reads the published BattleRecord and intentionally rejects 298 against the old ending.

## Evidence and access limitations

Third/Fifth Isonzo and Asiago chronology: [Italian Ministry of Defence, Milite Ignoto, PDF p.5](https://www.difesa.it/assets/allegati/26653/milite_ignoto.pdf), visually checked. Force identities: [Visintin, regional FVG historical institute](https://www.regionestoriafvg.eu/tematiche/tema/434/Il-fronte-dellIsonzo). Same-session raw files and page image were preserved with hashes.

Festubert: [Canadian Department of National Defence full battle dates](https://www.canada.ca/en/department-national-defence/services/military-history/history-heritage/battle-honours-honorary-distinctions/festubert-1915.html), read via indexed publisher content. Direct raw HTML download timed out and is explicitly marked failed in the cache manifest. The same dates appear in the official Canadian Army history, printed p.97; neither source uses Canadian-only participation as the entire event.

Gaza dates: [Australian War Memorial exhibition](https://www.awm.gov.au/visit/exhibitions/anzac-voices/sinai-palestine). Force scope: [Gullett, First Gaza Engagement](https://www.awm.gov.au/collection/C1416698), printed p. 265, PDF downloaded and page visually checked; [The Eve of Beersheba](https://www.awm.gov.au/collection/C1416702), printed p.371, command designation in September.

Es Sinn: [National Army Museum timeline](https://ww1.nam.ac.uk/timeline/). Komarów: [Deutsche Biographie](https://www.deutsche-biographie.de/gnd118848615.html) and [Rauchensteiner, Austrian Future Fund edition, printed p.194](https://www.zukunftsfonds-austria.at/download/book_rauchensteiner_TheFirstWorldWar.pdf). The latter inspected in publisher-indexed search content; no exact 30 Aug endpoint inferred.

Russo-Japanese evidence: [JACAR Liaoyang](https://www.jacar.go.jp/exhibition/nichiro2/sensoushi/rikujou05_outline.html), [JACAR Shaho](https://www.jacar.go.jp/exhibition/nichiro2/sensoushi/rikujou06_outline.html), [Presidential Library Mukden](https://www.prlib.ru/section/683596), [JACAR Mukden ending](https://www.jacar.go.jp/exhibition/nichiro2/sensoushi/rikujou09_detail.html). The three-case companion audit distinguishes archival catalogue/exhibition descriptions from underlying record images that were not transcribed.

Raw source cache: `/tmp/historyofatlas-cdb90-modern-dates-sources/manifest.json`. All successful downloads include byte lengths and SHA-256; failures are not represented as cached evidence.

## Review verification

- All nine pinned CDB resources pass offline size/SHA-256 verification.
- All four metadata records pass the real BattleMetadataFileSchema and applyBattleMetadata in memory against current public records.
- Simulated prior-date drift correctly fails each strict expected precondition.
- Participant arrays, quantities, and coordinates are unchanged by all metadata patches.
- Third Isonzo passes the current pure build_profile only after the date correction; the old published record still fails dates.
- Its second import from its own generated participant identities is byte-equivalent at the JSON object level.
- Root subsequently rebuilt the catalogue, imported row 298 and regenerated the intake report. The resulting crosswalk contains 207 reviews: 159 approved, 38 rejected and 10 preserved existing profiles. Final application checks are recorded in the implementation checkpoint.

Validation script: `/tmp/historyofatlas-cdb90-modern-dates-validate.ts`; corrected in-memory examples: `/tmp/historyofatlas-cdb90-modern-dates-corrected-examples.json`.

Mukden source-calendar audit: `data/raw/wikidata/entities-c6e8e28ce47a8130fa8e.json`, `entities.Q384091.claims.P580/P582`. Normal-rank statements `Q384091$37b52815-4ed3-c1d6-d1a4-43cb719b8594` and `Q384091$476cc90c-49e8-0f79-8724-06fb67c08cc0` declare calendar `Q1985786` (Julian). The alternative 26 February end is deprecated. This narrowly reviewed correction does not establish that all source calendars have been audited or normalized.
