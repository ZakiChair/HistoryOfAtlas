# Bemis Heights fortification-sector location review — 21 September 2026

The metadata correction for **Q2237342**, the Battle of Bemis Heights on **7 October 1777**, is integrated in `data/curated/battle-metadata.json` and the generated catalogue. Coordinates are **[-73.640, 43.009]** (`[longitude, latitude]`). They represent the **Breymann Redoubt assault sector**, one part of this engagement. The coordinator independently inspected the named map, the GIS plot and the accuracy notice, and accepted this as a schematic sector locator with the explicit limitations retained. The underlying NPS GIS lacks measured positional accuracy; the point is never presented as an exact battlefield center or troop position.

No curated JSON, application code, build output or public data was edited by this review. The earlier hold in `docs/battle-location-followup-review-2026-09-21.md` was reopened because a public institutional georeferenced fortification dataset was recovered.

## Historical and cartographic identification

The [NPS archaeology account](https://www.nps.gov/articles/000/the-archaeology-of-the-barber-wheatfield.htm) identifies the second Saratoga battle, also called Bemis Heights, as beginning at Barber Wheatfield on 7 October 1777. The [NPS Breymann Redoubt account](https://www.nps.gov/places/the-decisive-moment-7-breymann-redoubt-continued.htm) describes the later assault on the fortification that day. The proposed anchor refers to this later fortified sector; it does not relocate the opening encounter to Breymann.

The [NPS General Management Plan 2004, Part 2](https://irma.nps.gov/DataStore/DownloadFile/517712), **PDF page 11 / printed page 17**, labels Breymann Redoubt in the second-battle map. This page was rendered and visually inspected. Its northern western British fortification, zigzag shape, relationship to Balcarres Redoubt, eastern camp line and Great Redoubt match the four British polylines in the GIS. Feature 3 (zero-based index 2) is Breymann. The DBF does not itself name individual forts: its `SOURCETHM` field only distinguishes British and American lines. The named map comparison is therefore an explicit identification step, not a hidden assumption based on row order. The map covers 7–8 October including withdrawal; this proposal keeps the source event's existing 7 October date and does not add an end date.

The [current official park brochure](https://www.nps.gov/sara/planyourvisit/upload/2024_Current-Unigrid-2.pdf), PDF page 2, was also visually inspected for broad layout. It was not used to estimate coordinates from pixels.

## Geographic basis and precision

[NPS DataStore reference 1023142](https://irma.nps.gov/DataStore/Reference/Profile/1023142), _1777 Redoubts of Battlefield Unit for Saratoga National Historical Park, 2001_, publishes the [redoubts.zip shapefile](https://irma.nps.gov/DataStore/DownloadFile/359139). Its [original FGDC metadata](https://irma.nps.gov/DataStore/DownloadFile/538991) and `.prj` specify **NAD83 / UTM zone 18N**, metres (EPSG:26918). The source was scanned and rubber-sheeted from a cultural landscape map at **1:9,600** for schematic historical narrative maps.

A reproducible point is selected **halfway along the published Breymann polyline**, measured in its native projected coordinate system. This is a locator derived from the fortification geometry, not a city, park, administrative or unanchored battle centroid. The 840.967 m line length includes cartographic zigzags; it is not a measured historical wall length.

- Native point: **E 610812.4330484857, N 4762728.527316941**.
- EPSG:26918 → EPSG:4326: **[-73.64028474284979, 43.00915590703188]**.
- Proposed display rounding: **[-73.640, 43.009]**.
- Conversion record: `/tmp/historyofatlas-bemis-heights-review/conversion.json`, including feature index, original attributes, selected segment, interpolation fraction and pyproj/PROJ versions.

The metadata explicitly calls these lines schematic and says accuracy was not measured. Although legacy quantitative metadata fields contain `200`, their surrounding text does not establish a measured positional error or confidence interval; this review does **not** turn that number into a 200 m accuracy claim. Three decimal places likewise express output rounding, not historical certainty. The proposal reconstructs neither precise combat formations nor the full battle footprint.

## Rejected points and alternative paths

The public NPS map data were read directly from the map's own Carto endpoint and saved as `carto-point.json` and `carto-vt_structured_data.json`. They publish **Breymann Redoubt Overlook** at approximately `[-73.638475, 43.009336]` and a restroom at `[-73.638292, 43.009416]`; neither is the fortification. The structured-data entry titled **The Decisive Moment - 7 - Breymann Redoubt (Continued...)** instead carries approximately `[-73.638482, 43.005463]`, near the Balcarres sector and inconsistent with the named map. These markers were not used. Barber Wheatfield Overlook is also a visitor point rather than an archaeological combat point. No moved monument, parking area, visitor center or inferred park midpoint supplies the proposal.

## Exact preconditions and validation

The public before-record is preserved at `/tmp/historyofatlas-bemis-heights-review/Q2237342-before.json`:

```json
{ "start": { "year": 1777, "month": 10, "day": 7 }, "end": null, "coords": null }
```

Only `coords` changes. `BattleMetadataFileSchema` accepts the strict proposal. `applyBattleMetadata` was run on a fresh in-memory copy with the project's `ne_10m_land.geojson`; exact before-values, chronology, land check and final public-record schema all passed. Resulting `missing` is empty. No force or casualty data are changed or derived from this research.

## Evidence retention

Files and SHA-256 are recorded in `/tmp/historyofatlas-bemis-heights-review/manifest.json`. Primary evidence:

| File                  | SHA-256                                                            |
| --------------------- | ------------------------------------------------------------------ |
| redoubts.zip          | `c060a340bacd191477842629c61fe126d388392e988b25dd33f7b1d2f2b5b8aa` |
| redoubts-metadata.xml | `27821df8215d4605665e1f1a5d4f7027354a6dc78946fddef17149a872498ade` |
| gmp-2004-park.pdf     | `b5c3ffccf64f44ebecb3eb9d18866d3c3ff5b415f6984d389ab03b51947a4384` |
| breymann-place.html   | `41a9effb9a22d8f48db3e500c353bc8f40a6670b27923eb87da71e3a7565b5d9` |

Rendered official pages and a plot of the original GIS lines were visually inspected. Their local names are `gmp-battle-map.png`, `brochure-map.png` and `redoubts-gis-review.png`. No drawn annotation was used as geographic source data. Firecrawl remained unavailable without authentication from the preceding review, so source gathering used the available web reader and direct public HTTP endpoints.

The rebuilt catalogue passes its data checks with this correction: Bemis Heights is now mapped, while its date and every participant or quantitative field remain unchanged. The browser metadata regression checks the sector basis and retained source link.
