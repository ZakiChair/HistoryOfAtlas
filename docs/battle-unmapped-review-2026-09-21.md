# Unmapped battle recovery audit — 21 September 2026

## Result

No proven systemic recovery was identified in the current 6,756 unmappable records. No application, normalizer, acquisition, curated or published data was modified. The 16,828 original published battles remain untouched. Expected change in mapped coverage from this audit: **0**.

The audit uses the current `public/data/battles/candidates.json`, `coverage.json`, individual published records and the same `loadEntities` cache merge used by the battle build. It does not rely on the earlier archival coverage report.

## Distribution

| Current missing data | Records |
| --- | ---: |
| Both start date and usable coordinates absent | 3,405 |
| Start date present, usable coordinates absent | 2,259 |
| Coordinates present, start date absent | 1,092 |
| Total | 6,756 |

Reported reasons overlap: missing coordinates 5,645; missing date 4,495; broad place coordinate 14; land event in open ocean 12; end before start 9; invalid date 2. Some coordinate removals occur because chronology is contradictory rather than because the original source lacks a point.

## Location checks

- 263 dated records have explicit P276 places but remain without usable coordinates. Their linked places include 213 distinct entities lacking any usable P625; all 213 were re-requested from the live Wikidata `wbgetentities` API in five batches. **None has gained a nondeprecated coordinate value.** Responses are `/tmp/historyofatlas-place-refresh-{0,50,100,150,200}.json`; metadata sidecars preserve request URL, IDs, SHA-256 and fetch time.
- Five linked places have no claims at all. Other failures are genuine missing place coordinates, broad water expanses, or unresolved/deprecated coordinates. In particular, Galashki Q2068504 has only a deprecated coordinate and Atuatuca Eburonum Q323911 has no concrete P625 value. Restoring either automatically would defeat source uncertainty.
- P131/P706 references were inventoried separately. They identify administrative or geographic containment, including broad Musashi Province for two battles, multiple Italian municipalities for Cesano, Lake Ladoga, and Kherson for a park engagement. Those container points cannot establish the actual battlefield. No new administrative centroid fallback was added.
- No omitted P625 qualifier supplies a battlefield point in this corpus. P276 qualifiers found on Battle of Bangkusay Q4870416 belong to P1343 reference/work statements; they locate documentation, not the engagement.
- The 12 existing offshore cases retain conservative handling. Examples of apparent source errors: Ecbatana Q3555607 has latitude4.7961/longitude48.5158, while its explicitly linked ancient city is34.8065/48.516247; Ovčí vrch Q109065540 has latitude12.9311101/longitude49.8879021. These suggest dropped digits or swapped axes but do not justify a global coordinate repair rule. A reviewed source correction is necessary.
- Operation Pedestal Q1927362 has several P625 statements qualified with P518 roles. A coordinate-selection rule must not silently promote an origin/destination to battlefield; its naval classification and role-specific geography require separate review.

## Date checks

- No currently undated record contains an ordinary valid nondeprecated P580 or P585 value hidden behind a bad first value. This rules out a meaningful first-statement parsing recovery for the current corpus.
- Only six undated records have any nondeprecated P580/P585/P582 value: two millennium-precision dates and four end-only dates. An end date is not evidence of the start date. End-only records: Q2984977 (Cape St Vincent), Q118593994 (Ghent1678), Q123739799 (Mscislaŭ), Q131753579 (Chaul).
- The two invalid dates are Banquan Q755758 and Zhuolu Q1064923, both P585 precision6, representing a millennium. Promoting them to an exact year would invent precision and interact with their legendary historicity.
- All nine reversed chronologies reflect contradictory values in the source, not a date parser failure: Q856650, Q2704829, Q3297424, Q13053399, Q16531818, Q19121521, Q25464443, Q125565315, Q126727785. For example, the [live invasion of Kuwait item](https://www.wikidata.org/wiki/Q856650) itself states a2009 start and1990 end. A known historical event is not permission to rewrite a source fact without separate reviewed evidence.
- 117 undated records have P2348 time-period references. These overwhelmingly identify broad eras:84 refer to [Pre-Islamic Arabia](https://www.wikidata.org/wiki/Q47855),29 to the Sengoku period. The era's start or end is not the battle's date.
- Ransbeek Q127038517 has unknown P585 with earliest/latest qualifiers1142–1147. This could inform a future uncertainty representation, but treating the bounds as a continuous five-year battle or choosing a midpoint is unsound.
- Itararé Q138199745 has a P585 qualifier on its P31 battle statement, October1930. It is the sole plausible date qualifier recovery, but it needs historical scope review before animation. The [municipal history](https://itarare.sp.gov.br/o-municipio/historia/) and [FGV historical atlas](https://atlas.fgv.br/marcos/revolucao-de-1930/mapas/itarare-batalha-que-nao-aconteceu) describe the anticipated major battle as not having occurred. This does not erase any surrounding skirmishes; it prevents an automatic claim that the proposed battle itself took place.

## Evidence artifacts and verification

- `/tmp/historyofatlas-unmapped-audit.json`: full6756record inventory, claim values, source statement IDs, qualifiers and linked places.
- `/tmp/historyofatlas-place-audit.json`:213linked-place source details and affected battles.
- `/tmp/historyofatlas-period-audit.json`:117undated records with period links.
- `/tmp/historyofatlas-additional-locations.jsonl`: offshore and alternate-property records.
- `/tmp/historyofatlas-place-refresh-*.json`: five live source responses and matching metadata sidecars.
- Reproducible read-only scripts: `/tmp/historyofatlas-audit-unmapped.mts`, `/tmp/historyofatlas-audit-places.mts`, `/tmp/historyofatlas-audit-periods.mts`, `/tmp/historyofatlas-audit-additional-locations.mts`.

`pnpm exec vitest run tests/unit/battle-location.test.ts` — **25 passed**. These existing tests preserve the Diu multiple-coordinate recovery, rank/deprecation handling, Earth-only validation, broad-water rejection, refusal to infer participant/country locations, and refusal to move ambiguous offshore battles to nearby cities. No implementation changed, so no new tests were introduced solely to mirror unchanged code.
