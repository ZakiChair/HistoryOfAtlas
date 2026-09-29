# Seshat qualitative historical coverage

`python3 pipeline/religions/seshat.py` rebuilds the Seshat fragment and its audit report offline. `--check` compares both generated files without writing. No framework or GIS dependency is needed for these commands. The fragment is merged by the main religion coverage builder.

The committed source extract is `data/curated/religion-coverage-seshat-source.json`. The generated fragment is `data/curated/religion-coverage-seshat.json`; the report is `data/reports/religion-coverage-seshat.json`. The extract retains reviewed codes, dates, political identities, source record IDs, bibliography links, hashes of the source narratives, original geometry hashes and acquisition checksums. Long third-party quotations from the source narratives are not republished.

## What the map can assert

The source is Seshat's **Widespread Religion** variable, which concerns the population's religious prevalence. It is distinct from official religion and elite religion. Only the explicit codes `v_m` (Vast majority), `o_h_p` (Over half of the population), and `sz_m` (Sizeable minority) are admitted. The first two become `majority`; the third becomes `substantial`. Rank alone never establishes either category. No percentage is inferred from a qualitative category, including the word “substantial”.

Every published record has its own `year_from` and `year_to`. No observation inherits the enclosing polity's lifetime. A mapping is visible only in the intersection of the demographic interval and the dated geometry interval. Negative source years would be converted from historical BCE numbering to astronomical years; this reviewed release contains only CE intervals.

The fragment groups religious branches into the shared family used by the atlas without adding them. For example, Sunni and Shia observations remain traceable within Islam; a majority branch establishes a family majority, while two minority branches are never added to manufacture a majority. Different simultaneous majority families cause the affected interval to be withheld and reported.

All population statements describe the polity as an aggregate. The polygon is its approximate **political** outline; it does not establish where adherents lived inside that polity. Both the distinction and source uncertainty remain in each observation's localized scope and notes.

## Reviewed release, 28 September 2026

The API acquisition contained 1,206 unique records: 358 coded vast majority, 45 over half, and 216 sizeable minority. Only 90 records had explicit date intervals; 1,116 had no observation dates. The release selects 17 individually reviewed source records, resulting in 42 dated map observations and 38 historical geometries across six regions:

| Population scope          | Published years | Observations |
| ------------------------- | --------------- | -----------: |
| Roman Empire, Dominate    | 287–394         |           21 |
| Aksum                     | 353–599         |            3 |
| Icelandic Commonwealth    | 936–999         |            1 |
| Adal Sultanate            | 1415–1543       |            5 |
| Haudenosaunee Confederacy | 1671–1680       |            3 |
| Qasimid Yemen             | 1640–1802       |            9 |

These intervals can be narrower than the demographic dates because the matching geometry starts later or ends earlier. No outline is extrapolated to close those gaps.

The small selection is deliberate. Post-1000 Iceland codes are omitted because the source narrative includes conflicting interpretations of Christian affiliation and continuing pagan practice. The Byzantine Syriac Orthodox record describes northern Syrian settlement rather than an empire-wide population estimate. The Abbasid Shia record infers demographic importance from political support and repression. Neither is painted across the whole empire. Undated codes and records without an exact historical geometry join remain outside this fragment. This is partial historical coverage, not a global reconstruction.

Rome's transition around 350 is a model-dependent demographic reconstruction, not a census. Axum's dates are approximate and distinguish court conversion from gradual rural diffusion. Adal's changed majority during the 1530s reflects territorial conquest, not a claim of collective conversion. Those qualifications are preserved in the map data.

## Geometry and provenance

Historical outlines come from [Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria/tree/ad28a691b7c07c1fca89d0e0636d324667d2a258), pinned commit `ad28a691b7c07c1fca89d0e0636d324667d2a258`. Only `POLITY` features with an exact matching `SeshatID` and overlapping source dates are used. Geometries are simplified with Shapely 2.1.2, tolerance 0.03 degrees, preserving topology. They are never replaced with modern country boundaries or editorial religion sketches. Closed rings, coordinate ranges and unsplit antimeridian edges are checked; invalid source polygons stop acquisition.

Seshat data are attributed under CC-BY-SA-4.0; Cliopatria geometry under CC-BY-4.0. The source extract and generated qualitative derivative preserve these source-specific attributions. The individual API records and their Zotero bibliography links appear in each published source citation. Seshat terms and license provenance were also verified for the existing `polity-facts-seshat-source.json` acquisition.

Primary entry points:

- [Widespread Religion variable](https://seshat-db.com/rt/widespread_religions_all/)
- [Public API](https://seshat-db.com/api/rt/widespread-religions/)
- [Canonical variable hierarchy](https://seshat-db.com/variable-hierarchy/)
- [Seshat coding conventions](https://seshatdatabank.info/sitefiles/code-book-4.20.2021.pdf)
- [Cliopatria data paper](https://doi.org/10.1038/s41597-025-04516-9)

## Reacquisition

Normal builds use only the committed extract. Reacquisition is a separate editorial operation because upstream codes and narratives may change.

1. Cache every page of the public API beginning with `https://seshat-db.com/api/rt/widespread-religions/?format=json&page_size=2000`; follow `next` until it is null. The server caps pages at 100 records. Store the complete JSON responses as `data/raw/religions/seshat-widespread-page1.json` through `page13.json`. Use a descriptive user agent and a delay between requests. Incomplete or duplicate acquisitions are rejected.
2. Reuse the pinned `data/raw/geography/cliopatria.geojson.zip` downloaded by the existing geography pipeline. Its checksum is preserved in the source extract.
3. In a separate Python environment with `shapely==2.1.2`, run `python pipeline/religions/seshat.py --acquire`. The reviewed record list is explicit in the script; changing that list requires a source narrative and population scope review. The current acquisition requires the reviewed 1,206-record snapshot, so a changed upstream record count stops the operation rather than silently broadening coverage.
4. Run the Python tests and the shared `ReligionCoverageDatasetSchema` validation before merging a changed fragment. `python3 -m unittest discover -s pipeline/religions -p test_seshat.py` covers temporal intersection, missing dates and prevalence, qualitative minority handling, contradictory majorities, family grouping, missing geometry, editorial admission and geometry rejection.

The RCS mapping file prepared alongside this audit has a separate scope policy. Its reviewed `present-day borders` rows intentionally describe source-defined modern territories, including historical population estimates for Canada. They must display that territorial scope; they are not evidence for a historical state's boundaries.
