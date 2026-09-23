# Naval quantities follow-up, 21 September 2026

Two manual profiles were independently reviewed and integrated: **Santiago de Cuba Q1999889** and **Tsushima Q208127**. Both compare explicitly bounded ship cohorts and retain other participating forces as unquantified complements. They do not assert complete fleet coverage, equal fighting power per vessel, or human deaths. The integrated profiles are in `data/curated/battle-profiles.json`; catalogue checks and browser validation are recorded below.

## Santiago de Cuba, 3 July 1898

[Sampson’s report of 15 July, published by NHHC](https://www.history.navy.mil/research/publications/documentary-histories/united-states-navy-s/the-battle-of-santia/rear-admiral-william/_jcr_content.html), identifies **seven blockaders in station** at the Spanish sortie: Indiana, Oregon, Iowa, Texas, Brooklyn, Gloucester and Vixen. New York and Ericsson were away to the east and returned; Massachusetts was coaling elsewhere. The [Iowa DANFS history](https://www.history.navy.mil/research/histories/ship-histories/danfs/i/iowa-ii.html) independently repeats these dispositions and names the **six Spanish sortie ships**: four armoured cruisers and two destroyers. These accounts may share underlying reports, so agreement is not treated as statistically independent verification.

The [1898 presidential message, pp. LX–LXI](https://history.state.gov/historicaldocuments/frus1898/message-of-the-president), records destruction of the complete Spanish sortie and no serious injury to American ships. Accordingly, six Spanish **operational removals** and zero American ship losses apply to the named opening cohorts. “Six removed” includes sinking, beaching/wrecking and surrender followed by scuttling; it does not mean six vessels sunk directly by gunfire. Subsequent salvage is outside the engagement. Zero American losses does not mean no hits, damage or personnel casualties. The message’s human-loss estimates are not imported.

The [Ericsson history](https://www.history.navy.mil/research/histories/ship-histories/danfs/t/ericsson-i.html) confirms later fighting and rescue. Such arrivals receive a separate unquantified American complement; seven is not the total number participating throughout the day. Existing Q29/Q30 identities and three commander records are retained. The four unresolved imported numerical observations are preserved exactly with their original Q29/Q30 participants, including qualifiers and references. Their units remain `unknown` and they remain non-renderable; this ship review does not certify their categories or reinterpret them as losses of the opening ship cohorts.

Existing equipment remains a component analogy: Spanish armoured cruisers, American battleships, and New York among later arrivals. Each force reuses one representative model, so the miniatures do not reconstruct its heterogeneous hulls: the opening American cohort also contained a cruiser and yachts, and the Spanish cohort included destroyers. No exact composition is inferred from those repeated silhouettes.

## Tsushima, 27–28 May 1905

[JACAR’s battle chronology and archival guide](https://www.jacar.go.jp/exhibition/nichiro2/sensoushi/kaijou_09_detail.html) establishes the two-day naval encounter between the Japanese Combined Fleet and Russia’s Second/Third Pacific forces, in the Tsushima Strait and waters farther north. The coordinating agent separately added the individually reviewed catalogue inclusion for Q208127; this numerical review does not broaden automatic classification rules.

[Alger’s July 1905 USNI compilation](https://www.usni.org/magazines/proceedings/1905/july/battle-sea-japan) lists **twelve Japanese main-line ships** in two squadrons and **twelve Russian ships** in three armoured divisions. Its introduction distinguishes the order-of-battle compilation from the translated official telegrams and acknowledges incomplete early reporting. The profile uses the named tactical cohorts, not its claims about every reported manoeuvre. Other squadrons and accompanying craft remain separate, unquantified participants.

[White’s 1906 account](https://www.usni.org/magazines/proceedings/1906/april/baltic-fleet-tsushima) provides individual fates for the twelve Russian main-line vessels: **eight sank or were scuttled; four surrendered**. It describes twelve Japanese main-line ships still opposing the surviving Russians on the second morning. This is a contemporary account assembled from an unnamed observer, not an infallible modern loss register; its gunnery, personnel and exact-time claims are not adopted. The [Mikasa museum account](https://www.kinenkan-mikasa.or.jp/kids/war/kaisen.html) confines Japanese ship losses to three small torpedo boats, supporting zero losses in the defined main-line cohort. That is not zero damage. Its broad 96/38 fleet totals and combined capture/internment number are not used as comparable strengths.

The Russian aggregate `casualties: 12 ships` represents withdrawals. Separate `8 sunk/scuttled` and `4 captured` observations are non-renderable subsets already included in twelve. Neither capture nor sinking becomes `deaths`. Main-line pre-dreadnought models illustrate battleship components; the other formations’ protected-cruiser models illustrate cruiser components, not all auxiliary and torpedo craft. All assignments fit existing date windows.

The published dates and **[130.15, 34.45]** coordinate are preserved. The latter retains its Wikidata event provenance and is not promoted to an independently verified opening position or whole-battle center. JACAR identifies archival overview chart C05110096100 and tactical chart C05110096300; the accessible [Mikasa journal chart](https://www.jacar.go.jp/exhibition/nichiro2/topic/topic02_03.html) was inspected but does not supply an absolute grid sufficient for a new coordinate correction.

## Deferred candidates

**Yalu Q385180:** [Marble’s 1895 article and attached corrections](https://www.usni.org/magazines/proceedings/1895/july/battle-yalu) distinguish initial and late-arriving Chinese ships. The published 12/11 comparison omits Saikyo Maru and does not exhaustively reconcile Chinese torpedo craft. Its early geographic description is also corrected later in the same page. No whole-fleet ratio or metadata correction is proposed.

**Yellow Sea Q702377:** [JACAR’s source guide](https://www.jacar.go.jp/exhibition/nichiro2/sensoushi/kaijou_06_outline.html) names the six-ship Japanese First Squadron and six Russian battleships, while its wider Russian list includes three cruisers, eight destroyers and a hospital ship. The [1945 US naval account](https://www.ibiblio.org/hyperwar/USN/ref/KYE/CINCPAC-93-45/index.html) describes four Russian light cruisers. The broader battle/escape/internment scope is not reconciled here. A main-line-only follow-up may be viable; this is a hold for this bounded batch, not a finding that all quantities are unknowable.

## Validation and artifacts

`npx tsx /tmp/historyofatlas-naval-followup-validate.ts` passed production profile and complete-record schemas, opposing-force comparison, date/model checks, preservation of metadata and Santiago imported observations, and desktop/mobile budgets **80/36**. This first check applied candidates as record replacements; the separate additive-build review below governs integration. Santiago renders six and seven proportional models plus ten symbolic later ships. Tsushima renders 12/12 proportional plus 10/10 symbolic models at desktop; mobile renders 8/8 proportional at 1.5 ships per model plus 10/10 symbolic. Unknown complements stay unknown. At completion only the six Spanish and twelve Russian main-line losses withdraw; no ship model is classified as a human death. Subset counts never add twice.

**Integration correction:** the original staged Santiago candidate copied the four observations into `patch.unassigned`. That must be omitted when integrating: `build.ts` already appends original quantity observations to reviewed participants whose IDs are retained, then prepends any patch-level unassigned observations. Keeping both would publish eight observations. The final profile note must therefore say the original observations remain with their participants, not that they migrate to unassigned data. No general fusion rule or observation scope is changed.

An independent check, `npx tsx /tmp/historyofatlas-naval-followup-merge-review.ts`, loaded the actual raw entity cache, ran production `normalizeBattle`, and reproduced the current additive profile merge in memory. Raw unassigned arrays were empty. Without `patch.unassigned`, each of the four original statement IDs occurred exactly once on Q29/Q30, and every observation object was deeply equal to its original. Keeping the original staged field yielded eight. At both budgets the corrected merge still selected Spanish strength/losses 6/6 and American 7/0; the unresolved death observations did not become animated deaths. The result is `/tmp/historyofatlas-naval-followup-merge-review.json`. This validates the proposed integration adjustment; the coordinating build additionally verifies the published output.

Staged files:

- `/tmp/historyofatlas-naval-followup-santiago.json` — original candidate; omit `unassigned` and correct its note during integration
- `/tmp/historyofatlas-naval-followup-tsushima.json`
- `/tmp/historyofatlas-naval-followup-holds.json`
- `/tmp/historyofatlas-naval-followup-validation.json`
- `/tmp/historyofatlas-naval-followup-merge-review.json`
- `/tmp/historyofatlas-naval-followup-sources/manifest.json`

The manifest hashes downloaded JACAR page/chart material used for inspection. USNI and NHHC bodies were read through publisher web retrieval; direct raw downloads failed, so no raw cache for those pages is claimed. Cached charts are not product assets and are not proposed for redistribution. Direct URLs above are the durable source trail.

## Integrated verification

The catalogue rebuild and offline integrity check pass with both profiles. Independent comparison confirms all 23,597 pre-existing records remain present, every earlier model SHA is unchanged, and no quantities or identities at Mukden were modified by its equipment assignment. Santiago's four imported observations survive exactly once with Q29/Q30.

Targeted browser suites pass on desktop and mobile: **22 native-GPU scenarios** and **18 software-GPU scenarios**, including both naval scenes, the unmapped Penguin fiche, Mukden equipment and the four new metadata/navigation cases. French Chrome inspection confirms Tsushima's final states: 12 Japanese main-line models active, 12 Russian main-line models withdrawn, and both ten-model unquantified complements unchanged. No naval model is counted as a human death. These checks establish the implemented cohort behavior, not an exhaustive order of battle or exact historical movements.
