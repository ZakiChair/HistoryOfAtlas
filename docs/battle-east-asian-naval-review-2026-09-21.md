# Three East Asian naval inclusion candidates

Reviewed 21 September 2026 against the 23,602-record battle catalogue. This review proposes two individually sourced inclusions and holds one overlapping record. It does not promote Wikidata's broad `naval warfare` class Q876274. No curated data, published events, models or build output were edited by the research agent.

| Item                               | Decision                                                         | Published date proposed | Location                                                                |
| ---------------------------------- | ---------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| Q11457942, Battle of Teradomari    | Include with companion metadata withdrawal                       | 13 July 1868, unchanged | Withdraw the inherited municipality point; offshore position unresolved |
| Q137822090, 가덕도 해전 / Gadeokdo | Include with companion date correction and coordinate withdrawal | 1597, year precision    | Withdraw the inherited island point; offshore position unresolved       |
| Q42402335, Battle of Bōno-Misaki   | Hold to avoid duplicating existing Q379433                       | No new record           | No new position                                                         |

## Teradomari: distinct encounter, no verified offshore point

The [Nagaoka City Science Museum's FAQ 1857](https://qa.city.nagaoka.niigata.jp/faq/show/1857?category_id=483&site_domain=default), read directly, identifies a naval action outside Teradomari harbour on Keio 4, fifth month, day 24. The anchored shogunate transport Jundō-maru was attacked and grounded. The city's [400-year history](https://www.city.nagaoka.niigata.jp/dpage/nagaoka400/pdf/ayumi-full.pdf), PDF page 14, printed page 25, corroborates the date and the ship's destruction in the shallows. The page was rendered and visually inspected. Its illustration and recovered shaft are evidence about the event, not georeferenced ship positions.

The inherited Gregorian date, 13 July 1868, is consistent with an independently published date equivalence in Take Arakida's 2007 paper, [濫觴期における地方統治と行政区画制](https://niigata-u.repo.nii.ac.jp/record/29822/files/18_0007.pdf), Niigata University repository, PDF page 8 / printed page 210. That page was visually inspected. The paper is used only for the calendar equivalence; it is not a source about this naval encounter.

Q705629, already published as the land battle of Hokuetsu, covers the broader regional fighting. The municipal account establishes this distinct ship action within that context. An index search found no existing entry naming this action.

The candidate has no event P625. Its P276 link is [Q7701513, the former municipality of Teradomari](https://www.wikidata.org/wiki/Q7701513#P625), whose point `[138.77022222222223,37.64497222222222]` is accepted by the existing place fallback after acquisition. That fallback cannot establish a battle position outside the harbour. No replacement coordinate is proposed. The present harbour, a museum displaying recovered material and a town centre are not substituted for the ships' position.

An obsolete municipal brochure, `kankou/pamphlet/file/ot48.pdf`, surfaced in indexed search with a more detailed two-versus-one narrative, but direct retrieval returned HTTP 404. It was not visually inspected and is not used for production quantities. The readable municipal evidence supports inclusion; it does not yield an independently checked, complete opposing order of battle for this review. The profile proposal therefore remains empty.

## Gadeokdo: correct the century without inventing a converted day

The candidate's P9475 explicitly links to [Academy of Korean Studies article E0000076](https://encykorea.aks.ac.kr/Article/E0000076). The directly read article identifies Won Gyun's Joseon force fighting Japanese naval forces near Gadeokdo in 1597, traditionally dated the sixth month's nineteenth day, after the Angolpo action. Its source item instead gives `1957-07-14`, which is incompatible with this identified event. The proposal uses **1597 only**. A Gregorian month/day conversion has not been verified from an institutional calendar source; neither June 19 nor July 14 is silently relabelled as Gregorian.

The [National Institute of Korean History's Won Gyun account, section 5](https://contents.history.go.kr/mobile/kc/view.do?levelId=kc_n307400), also read directly, separates the sixth-month encounters from the subsequent seventh-month sorties, the Gadeokdo rest-stop attack and the final Chilcheollyang defeat. This prevents conflation with the existing Q483088 record or with the later attack near the same island. The inclusion refers specifically to the event identified by E0000076.

The approximately one hundred ships mentioned by AKS are a departure/sortie count. This review has not reconciled the ships actually engaged at Gadeokdo against a complete Japanese force. Named human deaths or wounds and losses from later operations do not become fleet-loss counts. No quantitative profile is proposed.

The inherited point `[128.83,35.03]` belongs to [Q12612282, Gadeokdo island](https://www.wikidata.org/wiki/Q12612282#P625). The institutional narratives establish the vicinity, not a georeferenced battlefield. It is withdrawn, with no island centre, fortress or memorial substituted. Geographic precision remains unknown.

## Bōno-Misaki: hold because the catalogue already projects this action

The [Japan Coast Guard, Uwajima, lighthouse-history issue 33](https://www.kaiho.mlit.go.jp/06kanku/uwajima/pdf/daihachi33.pdf), PDF page 7, explicitly names Bōno-Misaki as the attack on Yamato's force on **7 April 1945**, en route to Okinawa. The downloaded page was rendered and visually inspected. It establishes a real naval/air engagement, not a fictional event or merely a place name.

The current public record Q379433, _Operation Ten-Go_, already uses that date, naval type, Japanese and US participants, and the inherited event point `[128.06666667,30.36666667]`. Thus Q42402335 would presently duplicate the same public encounter. Its parent-operation relation alone is not enough to justify a second projection: a nonoverlapping operation/action scope and cross-link must first be established. Neither record nor coordinates are changed here. No comparison mixes attacking aircraft with defending ships, and no quantitative patch is proposed.

## Coordinate withdrawal implementation

The research exposed a concrete integration problem: acquiring the linked municipality and island would create apparently precise map positions even though the engagement locations remain unknown. The coordinator authorized a bounded extension to reviewed metadata.

`pipeline/battles/metadata.ts` now accepts explicit `coords: null` as **withdrawal**, distinct from an omitted field. It requires the same nonempty evidence, coordinate rationale and cited URL as a replacement point; exact before-values still fail closed. Application removes `coords`, `coordinateSource` and the coordinate-derived `region`, adds `missing-coordinates`, and preserves the published review, sources, dates and quantities except for any separately declared date correction. A withdrawal-only no-op is rejected. Changes commit only after preconditions and the final public schema succeed. The public schema needed no widening: removed fields remain absent.

`pipeline/battles/check.ts` distinguishes explicit null from an omitted patch field, verifies the missing point against the reviewed result, and rejects a surviving coordinate source or region or an absent `missing-coordinates` reason. No inclusion, classification, quantity or chronology guard is relaxed.

Three new regression tests were observed failing before implementation because `null` was rejected. All **eight** metadata tests then passed, covering withdrawal with force/loss evidence preserved, the combined 1957-to-1597 correction, stale snapshots, missing evidence and no-op rejection. Targeted ESLint passed. No global tests or build were run by this agent.

## Staged files and verification

- `/tmp/historyofatlas-east-asian-naval-inclusions-proposal.json`: strict inclusion file, two records.
- `/tmp/historyofatlas-east-asian-naval-metadata-proposal.json`: strict companion patches, two withdrawals and one year correction.
- `/tmp/historyofatlas-east-asian-naval-profiles-proposal.json`: valid empty profile file; no force data added.
- `/tmp/historyofatlas-east-asian-naval-audit.json`: per-case decisions, sources, retrieval limits and evidence hashes.
- `/tmp/historyofatlas-east-asian-naval-validation.json`: successful in-memory production-pipeline validation.
- `/tmp/historyofatlas-east-asian-naval-review/`: source downloads, inspected-page renders and normalized before/after records.

Validation used the actual taxonomy-aware inclusion guard, coordinate resolver, battle normalizer, strict file/public schemas, metadata applicator and inclusion-provenance verifier. Each candidate was normalized using its cached source item plus the freshly retrieved linked place/participant entities. Both resulting records retain their original participants and quantitative arrays, lose their unsupported coordinates and carry `missing-coordinates`. Teradomari retains 13 July 1868; Gadeokdo becomes year-only 1597.

The exact expected snapshots assume acquisition supplies the same linked place points inspected here. Integrate each inclusion **with its companion metadata patch**, after acquiring linked entities. A changed date or coordinate must fail the precondition and trigger a fresh review. The original candidate revisions inspected were Q11457942 **1379240030**, Q137822090 **2456449100**, and Q42402335 **2543450743**; all had the exact direct P31 set `[Q876274]`. The original discovery file remains untouched.

## Integration, 22 September 2026

Both inclusions and their companion metadata patches are now integrated. Acquisition supplied the reviewed linked-place snapshots; all strict before-value checks passed. The published Teradomari and Gadeokdo records have no coordinates, coordinate provenance or derived region, and carry `missing-coordinates`; Gadeokdo has year-only 1597. Bōno-Misaki remains excluded as the duplicate of Q379433. The catalogue integrity check passes. A separate checker regression also covers explicit coordinate withdrawal on an original-corpus record, where null must be distinguished from an absent patch. Final integrated validation is recorded in the running implementation checkpoint.
