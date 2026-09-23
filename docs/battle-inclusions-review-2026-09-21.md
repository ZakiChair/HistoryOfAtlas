# Source-reviewed battle inclusions — 21 September 2026

The automatic class closure omitted Tsushima (1905). Its Wikidata item is directly classified as `naval warfare` (Q876274), which is broader than a naval battle and also contains campaigns and wars. An individually sourced inclusion now repairs this omission without making that whole class eligible. The same review adds the capture of HMS Penguin (1815), with its still-unknown offshore location retained as unknown.

## Evidence and scope

**Tsushima, Q208127.** [JACAR's archival introduction](https://www.jacar.go.jp/wp/ennews/contents/2282/) independently dates the naval battle to 27–28 May 1905. Its [battle chronology](https://www.jacar.go.jp/exhibition/nichiro2/sensoushi/kaijou_08_outline.html) identifies Japanese and Russian fleets in the Tsushima Strait. The acquired Wikidata revision is 2540174146, with selected P31 Q876274. The inherited event point `[130.15, 34.45]` retains its exact Wikidata coordinate provenance; it is not a newly surveyed position, a boundary of the two-day action or a reconstructed fleet track. Inclusion itself supplies no forces, losses or equipment.

**Capture of HMS Penguin, Q5037019.** The [Naval Historical Center account preserved by ibiblio](https://www.ibiblio.org/hyperwar/OnlineLibrary/photos/events/war1812/atsea/hnt-peng.htm) identifies the encounter between USS Hornet and HMS Penguin off Tristan da Cunha on 23 March 1815. [Royal Museums Greenwich, PAD5858](https://www.rmg.co.uk/collections/objects/rmgc-object-110009) independently identifies the ships and dated action. The Wikidata revision is 1876991192, also P31 Q876274. Its event has no P625 or linked P276 point. Neither source establishes a sufficiently specific offshore position: the island centre is not substituted.

The Penguin manual profile contains one vessel per side. The NHC account places Peacock and Tom Bowline after the fighting, so neither enters the combat denominator. Hornet survives; Penguin surrenders and is too damaged to save. Consequently, the loss counts are zero and one **ships lost to their original side**, with capture included. Zero vessels lost does not imply zero human casualties. No crew deaths, human casualty totals or inferred map point are added. The available numerical evidence remains readable while map animation is unavailable. This is the first quantified manual profile without a usable map position; the browser regression suite explicitly checks this state.

## Implementation and integrity

`data/curated/battle-inclusions.json` holds versioned reviews, engagement type, the exact selected P31 set expected from the source, explanatory notes and citations. The file accepts no dates, coordinates or quantities; those remain under their existing independent review mechanisms. Acquisition unions these IDs with the discovered IDs without rewriting `candidate-ids.json` or widening the source taxonomy. All explicitly linked places and participants remain subject to acquisition checks.

The builder fails on changed P31 values, unavailable included entities, original-atlas collisions, fictional/legendary/hypothetical exclusions, and source classes or taxonomy roots identifying a person, war, campaign, conquest or treaty. Missing dates and positions retain the ordinary normalization limits. Published records carry `inclusionReview`, and their citations and note remain visible through the existing detail panel. Offline checks require exact review provenance, the reviewed engagement type, source URLs, catalogue presence and a candidate-audit entry. The readiness report hashes both the review file and its implementation.

An independent review found that the first implementation did not reject persons and campaigns. A regression was observed failing before the correction; the final gate checks both direct classes and taxonomy roots. Six focused inclusion tests cover the reviewed union, stale source classes, exclusions, incompatible roots, strict evidence schema and altered offline provenance. A Python acquisition regression verifies that a reviewed omission joins the acquisition set without changing discovery.

The first rebuild adding Tsushima preserved every prior start/end/coordinate/type/medium and all numerical evidence. Two existing records, Aclea Q367988 and Corbera Q12156092, gained explicit revision IDs in participant source URLs during supplemental-language acquisition; their participant identities and quantities did not change. Later metadata and equipment additions have their own audits.

## Wider omission diagnostic

A separate read-only WDQS query enumerated **28 directly typed, dated Q876274 items**. Three already existed in the battle catalogue; two receive the inclusions above. The remaining **23** are not automatically promoted. They include campaigns, wars, incidents and potentially valid engagements needing individual evidence. [The diagnostic inventory](../data/reports/battle-inclusion-review-2026-09-21.json) preserves IDs, labels, revisions and dispositions. Labels are triage clues, not historical validation; this bounded query is not an exhaustive search for all omitted battles.

The full historical objective remains incomplete. A complete download of the current discovery set does not prove complete historical coverage, and inclusion of a sourced record does not establish animation readiness.

## Subsequent reviewed omissions

The following integration adds Cornwall–Pinguin and the two 1813 Galápagos actions, bringing the registry to five individually reviewed inclusions. The bounded inventory now has three earlier catalogue entries, five inclusions and twenty pending candidates. [The follow-up audit](battle-omitted-naval-actions-review-2026-09-21.md) records the ship cohorts, unresolved offshore positions and conflicting July date. The two-inclusion counts above describe the first checkpoint.
