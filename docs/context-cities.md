# Capital places and population observations

The cities context is a selective, source-backed corpus. It distinguishes two subjects:

- A **place** named by a published capital statement, with its own Wikidata P625 coordinate and its own P1082 population observations.
- A **political subject**, with population observations from its existing published polity-facts profile. Its population never enters a city marker or a city population series.

## Inputs and reproducible build

`data/curated/context-cities-source.json` freezes source statements for 201 candidate places. The initial 197 entities retain P625 and P1082; four editorial additions retain P625 only. Statement identifiers, ranks, qualifiers, references, available revision metadata, seven-language labels where acquired, and per-entity acquisition provenance with the raw response URL, timestamp and SHA-256 are preserved. Wikidata data is CC0-1.0. Existing cached responses supplied 119 entities; the official `wbgetentities` API supplied the remaining 82. Existing cache labels may provide only French and English; the reader labels English fallback content with `lang="en"`.

`data/curated/context-capitals.json` contains seven original editorial notices under CC-BY-4.0, reviewed on 2026-10-01. It adds four places and supplies institutional evidence for three existing places. The public dataset's `editorial` metadata identifies these facts and their licence separately from Wikidata statements. External sources are cited, not relicensed or copied wholesale.

The offline builder also reads the published `public/data/polity-facts/index.json`, the `Q*.json` profiles and the polity metadata in `public/geo/polities.json` and `public/geo/entities.json`. Rebuild and verify from the repository root:

```sh
pnpm exec tsx scripts/build-context-cities.ts
pnpm exec tsx scripts/build-context-cities.ts --check
```

`--check` rebuilds in memory and compares the complete serialized output; it does not fetch or modify files. `CitiesDatasetSchema` validates the public result.

## Selection and dates

The candidate list contains places named in a capital assertion with an explicit point date or both endpoints. The current corpus contains 195 geolocated places, 236 capital assertions, 1,599 observations for those places, and 3,349 population observations for 199 political subjects. Six places lack a valid Earth coordinate and remain counted in `coverage.excludedCities`. Another 811 undated or open-ended capital assertions are excluded from the Wikidata candidate selection; they remain available in the original polity profiles. Editorial dates can supplement those profiles without modifying them. These counts describe evidence coverage, not the historical distribution of cities or people.

### Institutional capital chronology supplement

| Place                      | Editorial role | Mapped period in Cliopatria | Evidence and interpretation                                                                                                                                                                                                                                                                 |
| -------------------------- | -------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Samarra                    | 836–892        | 836–892                     | [UNESCO](https://whc.unesco.org/en/list/276/) documents the Abbasid capital after Baghdad. A court's relocation is distinct from an empire's foundation.                                                                                                                                    |
| Fatehpur Sikri             | 1572–1585      | 1572–1585                   | [ASI Agra Circle](https://asiagracircle.in/fateh-pur.html) dates Akbar's residence and court; [UNESCO](https://whc.unesco.org/en/list/255/) dates construction separately. The earlier Wikidata start, 1571, remains in its original polity profile.                                        |
| Historic City of Ayutthaya | 1350–1767      | 1352–1767                   | [UNESCO](https://whc.unesco.org/en/list/576/) and [Tourism Authority of Thailand](https://www.tourismthailand.org/Articles/slow-lane-in-ayutthaya) provide a heritage reference period, not an annual register of royal residence. The reviewed territorial identity begins in 1352.        |
| Thonburi                   | 1767–1782      | 1769–1782                   | [UNESCO Bangkok](https://www.unesco.org/en/articles/thailands-forgotten-palace) dates the capital period. The existing P36 identity, Q6580711, refers to the **former province**: its sourced coordinate is used only as an explicit reference point. No provincial population is imported. |

The later additions are:

| Place  | Editorial evidence | Mapped evidence | Source and interpretation                                                                                                                                                                                      |
| ------ | ------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meknes | 1672–1727          | 1672–1727       | [UNESCO](https://whc.unesco.org/en/list/793/) associates its capital role with Moulay Ismail’s reign; these are not the city’s foundation and disappearance dates.                                             |
| Gondar | Point date: 1636   | 1636 only       | [UNESCO](https://whc.unesco.org/en/list/19/) dates Fasilides’ establishment of a permanent capital. This record dates that choice, not the end of the city’s capital role; no continuous interval is inferred. |
| Hue    | 1802–1945          | 1802–1884       | [UNESCO](https://whc.unesco.org/en/list/678/) documents the Nguyen court period. The reviewed territorial identity ends in 1884; a dynastic seat does not establish unchanged sovereignty until 1945.          |

The builder rejects unknown political subjects or mappings, indefinite dates, duplicate editorial fact IDs and replacements that do not match an existing role's subject, place and complete mapping set. Each curated `polityId` is resolved through the reviewed registry rather than authoring new political relations. A `replacesFactId` replaces only that role in the generated context, preventing duplicate rows; source profiles remain unchanged. None of these seven roles has a reviewed Historical Basemaps identity, so switching border sources does not silently reassign them.

Kyoto is not added: institutional endpoints differ, and the available Japanese mappings do not represent the imperial seat throughout the proposed period. Baghdad is not made continuously capital from 762 to 1258; its existing separated roles preserve the Samarra interval.

Annual or period visibility requires an exact day, month or year, without an approximate flag. A capital assertion must overlap both the selected period and a reviewed political identity for the selected border source. Population observations appear only at their encoded dates or bounded intervals. There is no interpolation, carry-forward or invented series point. Open-ended and coarse population observations remain readable in the complete history, with their source precision and dates intact.

When no population is documented in the selected period, the detail view may display the latest earlier dated reference in a separate section. A bounded interval that ends later than the selected year is not an earlier reference merely because it started earlier. Conflicting observations at the same nearest earlier date are retained together.

## Coordinates and scope

The builder accepts only finite Earth coordinates with valid latitude and longitude from non-deprecated P625 statements. It selects preferred rank first and then stable statement identifier; it does not average conflicting coordinates. Source links retain all accepted coordinate variants. A marker locates the **named source place**: this may be a city, archaeological site or administrative place. It does not reconstruct a historical urban footprint, palace, metropolitan area or population distribution. See the source definitions for [Wikidata coordinates (P625)](https://www.wikidata.org/wiki/Property:P625) and [population (P1082)](https://www.wikidata.org/wiki/Property:P1082).

Political population navigation uses the corresponding mapped territory's reference centre. A date remains readable but has no navigation button if no matching source identity and reference centre exist for that year. The city and territory tabs keep their populations separate throughout navigation. Quantities preserve bounds, approximations, dates and sources. Geographic/statistical scope may differ between observations; these are not silently treated as comparable censuses.

## Reader and verification

The interface supports seven locales, source-language fallback, period filtering, full-catalogue search and explicit pagination. Selecting a documented date delegates to the shared context navigation, which clears a conflicting period and stops playback. `citiesGeoJSON` emits only place identity, reference coordinates and evidence counts, never territorial population values.

`tests/unit/context-cities.test.ts` exercises exact temporal intersections, absent/open dates, border-source identity, non-interpolation, reference selection, schema provenance and distinct source subjects in the builder. `tests/e2e/context-cities.spec.ts` exercises real published Rome/Italy observations, chronology navigation, the full catalogue, persisted city selection, Arabic mobile layout and accessibility.
