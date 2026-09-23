# Spicheren location review — 23 September 2026

**Decision: correct the catalogue locator for Q699238 to the published reference point of the historic Hauteurs de Spicheren sector.** This is a location correction, with no review of troop quantities or equipment. The original event corpus remains unchanged; the accepted correction is integrated through curated battle metadata.

## Before and reviewed after

| Field                           | Existing public record      | Reviewed metadata override                          |
| ------------------------------- | --------------------------- | --------------------------------------------------- |
| Coordinates, longitude/latitude | `[6.0166666666667,49.15]`   | `[6.9666,49.2043]`                                  |
| Start                           | `1870-08-06`                | Retained                                            |
| End                             | Absent                      | Retained absent                                     |
| Coordinate provenance           | Wikidata Q699238, P625      | Forbach Tourisme / SITLOR, published through Cirkwi |
| Metadata review date            | No previous metadata review | `2026-09-23`                                        |

The exact imported longitude is preserved in `expected.coords` and the before snapshot. The correction is guarded by the exact original coordinates, start and absent end. The metadata proposal contains no start or end override and no participant profile.

## Geographic evidence and historical identity

The [Forbach Tourisme / SITLOR record published by Cirkwi](https://www.cirkwi.com/fr/point-interet/1627601-site-historique-des-hauteurs-de-spicheren) identifies the historic Hauteurs de Spicheren site. Its technical information explicitly labels the pair as latitude/longitude and publishes **49.2042714, 6.9665873**. Reordering to the atlas's longitude/latitude convention and rounding to four decimal places produces **`[6.9666,49.2043]`**. The source attributes authorship to Forbach Tourisme and describes its synchronization from SITLOR through the tourism partnership; this is a published tourism-office point, not an independently inferred geocode. The same record associates the site with the battle of 6 August 1870.

The [official Office de Tourisme du Pays de Forbach page](https://paysdeforbach.com/decouvrir/les-incontournables/hauteurs-de-spicheren/) independently identifies the Hauteurs site with the 6 August 1870 battlefield. Its description also covers memorials and later conflicts. The coordinate is therefore used for the historical sector, rather than attributed to any particular monument.

The [municipality's account of the battle](https://www.spicheren.com/le-site-du-kreutheck) describes the fighting on the heights on 6 August 1870. That municipal page credits an external historical blog for its narrative; it is corroborative geographic context, not the coordinate supplier or a newly accepted source for numbers.

## Scope and limits

The published metadata basis explicitly describes a **“Hauteurs sector reference point”**. The locator represents a tourist site within an identified combat sector. It does not establish the centre or boundary of the entire battlefield, a surveyed military position, or the exact position of the 40th Fusilier Regiment or its monument. Four displayed decimal places express rounding, not proven historical positional accuracy. No historical error radius is supplied by the source.

The two existing CDB participants, every strength/death/casualty observation, equipment source and profile, totals, unassigned observations and original source provenance must be preserved. The broader equipment work remains documented in `docs/battle-prussian-1870-equipment-review-2026-09-22.md`; it is not reopened by this correction. No numbers from the tourism or municipal narratives are imported.

## Evidence retained and integration boundary

The proposed metadata-only patch is `/tmp/historyofatlas-spicheren-proposal.json`. Downloaded HTML for the three cited sources and SHA-256 hashes are listed in `/tmp/historyofatlas-spicheren-sources/manifest.json`. That directory also contains `Q699238-before.json`, an exact pre-correction public record snapshot. The source manifest records the original and proposed values and hashes the proposal.

The source review initially produced the document and private staging/provenance files. The coordinating agent then integrated the reviewed correction. A comparison of the published record with the before snapshot confirms: only coordinates, coordinate provenance, appended source/note material and metadata-review fields differ. Dates, region, participants, equipment and quantitative observations remain identical; the original event corpus and model assets are unchanged. Final browser results are recorded in the continuation checkpoint.
