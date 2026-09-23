# Follow-up location review — 21 September 2026

Three source-reviewed metadata patches were integrated into `data/curated/battle-metadata.json` by the coordinator after independent source and image inspection. Six new candidates received targeted source checks. These are a bounded selection, not a review of every unmapped event. The catalogue rebuild confirms three newly mapped records. The staged proposal remains at `/tmp/historyofatlas-location-followup-proposal.json`.

## Inventory and scope

The public event snapshot contained **2,255 records with a start year and no coordinates**: 2,068 land, 179 naval and eight air events. Nine also carry `end-before-start`, leaving 2,246 without that chronology failure: 2,059 land, 179 naval and eight air; 1,451 have day precision, 194 month precision and 601 year precision. “Usable” here means the stored date passes this screen, not that every date was historically revalidated.

The 25 exclusions in `data/reports/battle-unresolved-location-review-2026-09-21.json` and the named investigations in the two earlier location audits were excluded. None of the six candidates below overlaps those cases. Already reviewed Point Judith, Michelsberg, Cape St. George and Sideling Hill were not reopened. No administrative or town centroid fallback was used.

The complete dated/no-coordinate snapshot is `/tmp/historyofatlas-location-followup-inventory.json`. The six exact public records are retained as `Q…-before.json` under `/tmp/historyofatlas-location-followup-sources/`.

## Proposed anchors

Coordinates below are `[longitude, latitude]`. Decimal rounding is display resolution, not a statement of historical positional accuracy. No invented error radius, combat footprint or troop position is added.

| Record                   | Proposed point         | What the point represents                                      |
| ------------------------ | ---------------------- | -------------------------------------------------------------- |
| Bloody Angle, Q111947056 | `[-71.298, 42.4553]`   | NPS Elm Brook Hill place marker on the historic road sector    |
| Rangiriri, Q4872162      | `[175.129, -37.428]`   | DOC archaeological reference for Rangiriri site S13/50         |
| Pukekohe East, Q5251295  | `[174.9461, -37.1886]` | Heritage New Zealand marker for the surviving fortified church |

**Bloody Angle.** The [NPS Elm Brook Hill record](https://www.nps.gov/places/elm-brook-hill.htm) identifies the ambush landscape and directly publishes `42.45528906097832, -71.29802568901256`. Four-decimal rounding supplies the proposed marker. The [NPS account of 19 April 1775](https://www.nps.gov/mima/learn/historyculture/april-19-1775.htm) connects the bend and hill to that day's fighting. This point represents the road sector, not the full Lexington–Concord action or every firing position. The existing date is unchanged.

**Rangiriri.** [DOC, Prickett 2016](https://www.doc.govt.nz/documents/science-and-technical/sap261entire.pdf), printed pp. 42–43, identifies S13/50 and the 20–21 November 1863 attack, with grid reference `2698700E 6417200N`. Its methodology on p. 15 states that NZMS260 references are rounded to 50/100 metres and generally refer to southwest site corners. That convention limits the point's meaning. The [LINZ coordinate definition](https://github.com/linz/linz-coordsys/blob/master/files/coordsys.def) identifies NZMG with NZGD1949. EPSG:27200 → EPSG:4326 produces `[175.1291245061598, -37.427638341033614]`, then rounded to three decimals. This is not a centroid of the defensive line. The [Heritage NZ entry](https://www.heritage.org.nz/list-details/7720/Rangiriri) independently supplies a nearby map point and a much larger protected extent; neither was substituted for the archaeological reference.

**Pukekohe East.** The [Heritage NZ List 483 page](https://www.heritage.org.nz/list-details/483/483) embeds the church's map coordinates, `-37.18860488232277, 174.94613028083916`. Its `location` and `listEntryLocationBlock_0` objects agree. The point is rounded to four decimals. [DOC p. 31](https://www.doc.govt.nz/documents/science-and-technical/sap261entire.pdf) identifies the stockade and surviving remains; [NZHistory](https://nzhistory.govt.nz/memorial/pukekohe-nz-wars-memorial) and the [Presbyterian archives](https://www.presbyterian.org.nz/archives/SouthAucklandPresbytery.htm) corroborate the church attack. All three date it to **14 September 1863**. The patch therefore corrects `start.day` from 13 to 14 and retains the existing end on the 14th. It locates the church, not a conjectured grave or township center. No force or loss values are taken from these pages.

## Exact before-values

All six records have `coords: null` in metadata-before representation; their public JSON omits the field. Omitted end values likewise become `null`.

| QID        | `expected.start`                    | `expected.end`                      | Proposed date change                             |
| ---------- | ----------------------------------- | ----------------------------------- | ------------------------------------------------ |
| Q111947056 | `{"year":1775,"month":4,"day":19}`  | `null`                              | None                                             |
| Q4872162   | `{"year":1863,"month":11,"day":20}` | `{"year":1863,"month":11,"day":21}` | None                                             |
| Q5251295   | `{"year":1863,"month":9,"day":13}`  | `{"year":1863,"month":9,"day":14}`  | Start becomes `{"year":1863,"month":9,"day":14}` |
| Q2237342   | `{"year":1777,"month":10,"day":7}`  | `null`                              | Hold; no patch                                   |
| Q1497950   | `{"year":1847,"month":11,"day":12}` | `null`                              | Hold; no patch                                   |
| Q116179414 | `{"year":1854,"month":12,"day":3}`  | `null`                              | Hold; no patch                                   |

## Investigated but not promoted

- **Bemis Heights, Q2237342.** [NPS archaeology](https://www.nps.gov/articles/000/the-archaeology-of-the-barber-wheatfield.htm) ties Barber Wheatfield to the start of the second battle on 7 October 1777 and reports archaeological confirmation. Inspected NPS tour pages describe Barber Wheatfield and Breymann Redoubt, but did not supply a geographic point for either. A parking-area coordinate, park headquarters or entire-park marker is insufficient. Hold pending a georeferenced institutional battlefield feature; the historical identification itself is promising.
- **Geltwil, Q1497950.** The [Aargau heritage inventory, INV-GEL905](https://www.ag.ch/denkmalpflege/suche/detail.aspx?ID=35280) supplies Swiss coordinates `2666871, 1233537`. It also explains that the monument began as a grave memorial in Muri and moved to Geltwil in 1936. Its commemoration includes Gisikon casualties. The current monument point does not establish the actual 1847 fighting position; no battlefield coordinate is proposed.
- **Eureka Stockade, Q116179414.** The [Australian national heritage authority](https://www.dcceew.gov.au/parks-heritage/heritage/places/national/eureka-stockade) confirms the assault on 3 December 1854 and associates the gardens with it, while explicitly stating that the exact stockade location is not agreed upon. A memorial-site marker could be reviewed separately, but this pass does not turn the gardens' outline into a battle point.

## Evidence retention and checks

Approved sources were read directly. The DOC PDF was downloaded from its official URL and visually checked at PDF pages 19, 35, 46 and 47 (printed 15, 31, 42 and 43). The official PDF and its DOC delivery-host copy are byte-identical. Heritage NZ coordinates were read from each public page's map data, not inferred from its address. NPS publishes the point visibly in its location field.

Snapshots, rendered pages and `/tmp/historyofatlas-location-followup-sources/manifest.json` preserve URLs, retrieval/write timestamps, status and SHA-256. Key hashes:

| Snapshot                    | SHA-256                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| DOC complete report         | `baaa264a4e8596c53ed24057902ce71575c3660832bd1ec7d8b696c993192331` |
| NPS Elm Brook Hill HTML     | `1750b236d50b254b01c8d183b028331c2466e2468d3ce922ddb32c4c20a4fd34` |
| LINZ coordinate definitions | `849819ceafa1b6f6deb0bd3681d784d6e6285660acaa92482c9f7ed2c844273b` |

The Heritage NZ Pukekohe page snapshot has SHA-256 `a3227102aaf7a71edfdb641ecab962cb42fe022b59770b2709127b00852e6534`; the Rangiriri page has `1dd779f92aa77e3224e13bfb24469a2ebf7acfc4e72fabe215c4dc09c884c7e9`.

The Rangiriri conversion record is `rangiriri-conversion.json` in that directory (pyproj 3.8.0 / PROJ 9.8.1). Its stated transformation accuracy is not the archaeological site's accuracy. The blocked LINZ PDF and the challenge-only National Library response were not used as geographic evidence. NZHistory was readable through the web reader; direct snapshot retrieval returned 403, recorded in the manifest. The Eureka page was read through the web reader; a separate snapshot request timed out. These failures do not masquerade as successful source captures. Firecrawl was unavailable without authentication, so the available web reader and direct HTTP retrieval were used.

`BattleMetadataFileSchema` accepts all three patches. `applyBattleMetadata` applied each to a fresh public-record copy in memory with the project's `ne_10m_land.geojson`: exact before-values, chronology, land validation and final public schema all passed; each resulting `missing` array is empty. The research agent wrote no production files. The coordinator subsequently integrated all three patches, independently inspected the DOC pages and published coordinate data, and rebuilt the catalogue successfully. Final integrated verification is recorded in the continuing implementation checkpoint.

## Subsequent Bemis Heights resolution

The initial hold above was resolved through a separate [NPS GIS and named-map review](battle-bemis-heights-location-review-2026-09-21.md). The integrated point `[-73.640, 43.009]` represents the Breymann Redoubt assault sector. It is a schematic locator with unmeasured positional accuracy; the earlier visitor-marker candidates remain rejected. Geltwil and Eureka remain held.
