# Yellow Sea: evidence review, 21 September 2026

The manual profile for **Q702377, 10 August 1904**, is integrated in `data/curated/battle-profiles.json` and the generated catalogue. The previously deferred whole-fleet comparison is resolved only for two named main-force cohorts: **Japan’s six-ship First Squadron and Russia’s six battleships**. Other formations remain unquantified. The profile adds four local naval participants, retaining the raw date and coordinates. Existing ship models are reused; no human casualty count is inferred.

## Comparable forces

[JACAR’s Yellow Sea source guide](https://www.jacar.go.jp/exhibition/nichiro2/sensoushi/kaijou_06_outline.html), reference C05110042300, identifies the fleet list in image 8 of Togo’s detailed report. The Japanese First Squadron comprises Mikasa, Asahi, Shikishima, Fuji, Kasuga and Nisshin. The Russian battleships are Tsesarevich, Retvizan, Pobeda, Peresvet, Sevastopol and Poltava. The [Sea Power Centre – Australia history](https://seapower.navy.gov.au/sites/default/files/2023-02/Japanese%20Sea%20Power.pdf), Appendix 10, printed p.127 / PDF p.142, confirms six Russian battleships opposing four Japanese battleships and two armoured cruisers on 10 August.

The Japanese cohort is the named First Squadron, not a claim that only six Japanese ships fought throughout the action. Yakumo and other formations remain outside it. Each camp has an additional local participant with empty strengths for accompanying cruisers, flotillas and other ships. No full-fleet total is constructed from JACAR’s wider lists: its Russian list names three cruisers, while the American account below describes four. Hospital ships, reserves, other squadrons and later arrivals are not silently added to a comparable count.

Ship numbers measure vessels, not equivalent tonnage, armament or combat effectiveness. Four stable local military-unit IDs and two explicit sides avoid substituting modern state or navy identities.

## Loss category and time boundary

The [official US CinCPOA Bulletin 93-45, 1945, pp.21–22](https://www.ibiblio.org/hyperwar/USN/ref/KYE/CINCPAC-93-45/index.html), read in HyperWar’s transcription, explicitly says no Russian ship sank and that Japanese ships remained intact despite sometimes heavy damage. It separately describes the Russian flagship’s flight to a neutral port, subsequent internment, and later destruction at Port Arthur. This supports **zero ships sunk during the combat of 10 August 1904** in each named cohort. It does not support zero damage, zero temporary incapacity, zero retreat or zero subsequent operational loss.

The only renderable loss observation per main force is therefore `casualties: 0 ships`, explicitly qualified as sinkings during that day. Capture, internment after the engagement, the destruction of Port Arthur’s fleet months later and other battles are outside the count. No personnel figures are imported. The contemporary [Cotten analysis, USNI, March 1910](https://www.usni.org/magazines/proceedings/1910/march/naval-strategy-russo-japanese-war) also distinguishes the 10 August sortie from subsequent sinkings at the ships’ moorings; it is contextual corroboration, not a numerical damage ledger.

Damage is preserved as named evidence without artificial withdrawals:

- **Mikasa:** one documented damaged survivor, a non-renderable subset. JACAR publishes and identifies a [National Institute for Defense Studies photograph of the rear turret damaged at the Yellow Sea](https://www.jacar.go.jp/exhibition/modernjapan/p10.html), image 2. The photograph was visually inspected. The same page also describes Mikasa’s September 1905 explosion, which is excluded.
- **Tsesarevich:** one documented damaged survivor, likewise a non-renderable subset. The Australian account identifies the flagship’s damaging hit; the US account distinguishes survival and later internment. This observation is not a claim that only one Russian vessel was damaged.

Neither subset is an exhaustive damage total or added to zero sinkings. The scene consequently preserves every ship model; it does not simulate historically attested damage or temporary manoeuvring departures as losses. `deaths` remains empty everywhere.

These institutional accounts are not asserted to be error-free or statistically independent. The 1945 bulletin’s evaluative wartime language, repairability claims and broad campaign figures are not adopted. The Australian appendix’s adjacent Tsushima date typo (26–27 May on p.128, versus 27–28 in the reproduced report) is not used for any chronology. The Yellow Sea date is independently checked below.

## Calendar, location and equipment

The selected cached Q702377 entity has P585 **+1904-08-10**, precision 11 (day), calendar **Q1985727, Gregorian**; P580/P582 are absent. This agrees with JACAR and the Australian account. The published single-day start is retained, with no invented end or Old Style conversion. The existing **[121.7, 38.4]** event coordinate retains its Wikidata provenance. It is not independently recertified here as a precise opening position, fleet track or complete engagement extent.

The existing pre-dreadnought model represents the battleship components of the two main forces; it is not an exact reconstruction of every ship, including Japan’s two armoured cruisers. Protected-cruiser models for the unquantified complements illustrate cruiser components, not every torpedo craft or auxiliary. Each force repeats its representative silhouette. All assignments fit the existing 1904 date windows and introduce no new geometry.

## Integration and validation

The candidate intentionally omits both `totals` and `unassigned`. The actual raw normalization currently has no participants or quantitative observations. Production build remains responsible for preserving any original evidence; this patch does not duplicate imported statements. The existing equipment-only event assignment can remain, but its appended note should be read as the scope of that equipment assignment, not as a claim that the new manual record still lacks identified camps.

`npx tsx /tmp/historyofatlas-yellow-sea-profile.validate.mts` validates the production profile and complete-record schemas, the selected raw calendar claim, the actual additive build merge and existing equipment patch, source hashes, scoped losses and readiness. The initial `.ts` runner encountered a module-format error importing readiness’s top-level await; the `.mts` runner uses ESM and tests the same code without modifying repository modules.

At the current **80/36** desktop/mobile budgets, both scenes contain **6 + 6 proportional models at one ship per model**, plus **10 + 10 symbolic models** for unknown complements, 32 total. The two damage subsets create no withdrawn or dead models. Readiness must report comparable opposing cohorts, complete dated equipment, but `allArmiesQuantified: false` and `fullEvidenceCombination: false`. The validation checks public bytes remain unchanged.

Artifacts are `/tmp/historyofatlas-yellow-sea-profile.json`, `.baseline.json`, `.validate.mts`, `.validation.json`, and `/tmp/historyofatlas-yellow-sea-raw-review.json`. Raw JACAR pages, the damage image and the US bulletin transcription are cached with SHA-256 hashes in `/tmp/historyofatlas-yellow-sea-profile.sources/manifest.json`. The Australian PDF’s text was read through the web tool; direct raw download and screenshot retrieval timed out, so no local PDF cache or screenshot is claimed. The cached image is for inspection, not product redistribution. Direct source links above remain the durable trail.

Integrated verification: the catalogue rebuild and integrity check pass. Native and software browser scenarios pass on desktop/mobile in `test-results/naval-russian-native-report` and `test-results/naval-russian-software-report`. Both budgets show six ships per documented main force and ten illustrative figures per unquantified complement (32 total). No model is removed for the narrowly sourced zero-sunk observations; damage subsets remain non-additive and do not establish zero damage.
