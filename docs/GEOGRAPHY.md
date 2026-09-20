# Geography: reproducible territory history

Atlas Belli draws dated territorial geometries, not only event markers. The main layer uses **Cliopatria**, a Seshat Global History Databank dataset. The requested **Historical Basemaps** remains available as an independent reference. **Natural Earth** supplies the contemporary physical basemap. None requires an API key.

## Rebuild

Python 3.11+ and tippecanoe 2.17+ (tested with 2.79.0) are required. Install tippecanoe with `brew install tippecanoe` on macOS or compile its pinned upstream release for a Linux data-builder image. The web-serving image needs neither Python nor tippecanoe.

```sh
python3 pipeline/geography/build.py
python3 -m unittest discover -s pipeline/geography -p 'test_*.py'
```

The parent `pnpm data:build` command invokes the first command. `--fetch-only` downloads and verifies Historical Basemaps and Natural Earth source files without requiring tippecanoe. Full builds also fetch Cliopatria. `--jobs 2` bounds parallel geometry conversion. Downloads are cached under `data/raw/geography`; SHA-256 locks under `data/geography` detect changed bytes behind immutable source URLs. No geometry is fetched from a mutable `main` or `master` URL.

Keep `sources.lock.json`, `cliopatria.lock.json`, reports, pipeline code, and deployable `public/geo` artifacts in version control. The intermediate `data/geography/*.geojson`, `*.log`, `__pycache__`, and PMTiles build signature files are disposable. A clean rebuild uses the locked source revisions and verifies source checksums.

## Sources, exact revisions, and licences

| Dataset                                                                    | Revision                                   | Licence                                                                                                                            | Use                                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria) | `ad28a691b7c07c1fca89d0e0636d324667d2a258` | [CC BY 4.0](https://github.com/Seshat-Global-History-Databank/cliopatria/blob/ad28a691b7c07c1fca89d0e0636d324667d2a258/LICENSE.md) | Dated territory intervals, polity identities and areas                           |
| [Historical Basemaps](https://github.com/aourednik/historical-basemaps)    | `da7a4b735ecef70aebdc9c73e409d8a2500d50f3` | **GPL-3.0**, not CC0                                                                                                               | 50 world snapshots, including 4000 BCE predecessor and ending in 2010            |
| [Natural Earth vector](https://github.com/nvkelso/natural-earth-vector)    | `ca96624a56bd078437bca8184e78163e5039ad19` | [Public domain](https://www.naturalearthdata.com/about/terms-of-use/)                                                              | 1:50m land, coastlines, rivers, contemporary countries, physical-region polygons |

Cite Cliopatria's [Scientific Data publication](https://doi.org/10.1038/s41597-025-04516-9), authors James Bennett et al., and Seshat Global History Databank. The attribution manifest states our modifications: BCE conversion, selection of POLITY rows, normalized attributes, computed label anchors, vector tiling, and simplification. Source `Area` values are retained.

The Historical Basemaps adaptation remains under its GPL licence, supplied at `/geo/HISTORICAL-BASEMAPS-LICENSE.txt`. `/geo/historical-source.tar.gz` contains the original geometry, transformed GeoJSON, labels, licence, source locks, and reproducible transformation script. These files must remain available when distributing the historical PMTiles. The web application and separately licensed datasets do not acquire a false CC0 designation.

CShapes was evaluated but not incorporated: its CC BY-NC-SA licence imposes a noncommercial restriction absent from the selected sources.

## Actual coverage

The pinned Cliopatria file has **13,765 rows**. The pipeline accepts **13,380 POLITY geometries** for **1,583 source-named polities**, spanning astronomical years **−3399 through 2024** (3400 BCE–2024 CE). Its **385 RELATION rows** describe alliances, vassalage, and other groups; they are excluded from the territory fill to avoid presenting an alliance as a unitary state.

These records yield **12,285 distinct geometry states**. A new geometry state is a source observation, not necessarily a conquest, battle, or change of sovereignty. The geometry-change density histogram is available separately from event density.

The 50 Historical Basemaps snapshots cover astronomical −3999 through 2010. Spacing is highly irregular: up to a millennium in early history, decades or years in later history. There is no precise 3500 BCE source map. The older 4000 BCE observation is a reference, and the main Cliopatria layer starts at 3400 BCE. Do not label either as exact boundaries for the requested intervening year.

## Dates and uncertainty

Both datasets document BCE as negative years in the conventional historical numbering. We convert negative source years with `astronomical = source + 1`: 323 BCE becomes −322; 1 BCE becomes 0. Positive CE years are unchanged. Six Cliopatria source rows nevertheless end at source year `0`; those endpoints are retained as astronomical 0, recorded by source row in the quality report, and explicitly disclosed in the manifest.

Intervals are **inclusive**. No JavaScript `Date` object is involved. Historical Basemaps snapshots retain both `sourceYear` and normalized `year`.

Cliopatria does not provide numeric positional confidence for every polygon. All its borders therefore carry `approximate: true` and `precision: 1`; a renderer should use a fine dashed/soft outline. Historical Basemaps' `BORDERPRECISION` ordinal 1–3 is preserved, but ancient cultural regions can overlap and do not imply modern sovereignty. Modern rivers and coastlines are contextual aids, not reconstructed ancient coastlines.

The source ends in 2024. For 2025 onward, the UI must disclose that it retains the latest source state. It must not assert that these boundaries were checked against current territorial claims.

## Rendering contract

`/geo/manifest.json` is the only eager geography index. No original or normalized GeoJSON is a browser dependency. PMTiles v3 archives contain vector tiles at zooms 0–5 and support overzooming. Serve `.pmtiles` without HTTP content encoding and with byte-range requests. CORS is needed only if hosting the files on another origin.

`manifest.temporal` contains:

```ts
{
  source: 'cliopatria',
  sourceLayer: 'territories',
  labelLayer: 'labels',
  range: [-3399, 2024],
  shards: [{ start, end, url, features, bytes, sha256 }],
  entitiesUrl: '/geo/polities.json',
  changesUrl: '/geo/territorial-changes.json',
  density: [{ year, count }]
}
```

There are 39 contiguous temporal shards: 250 years in early history, 100 years in medieval history, 50 years after 1500, and 25 years after 1900. A shard includes records intersecting its period plus a one-year margin for adjacent-state transitions. Select a shard by `start <= year && year <= end`, then set a MapLibre layer filter:

```ts
['all', ['<=', ['get', 'fromYear'], year], ['>=', ['get', 'toYear'], year]];
```

Both `territories` and `labels` expose `id`, `entityId`, `name`, `polity`, `wikidataId`, `color`, `areaKm2`, `fromYear`, `toYear`, `precision`, `approximate`, `sourceUrl`, and `sourceRecord`. Feature numeric IDs are original source row indices. Labels are genuine Point features, computed inside the largest polygon when possible; they are layout anchors, never event geocoding. Size labels by area and suppress small polity labels at world scale.

Changing the current year updates GPU filters independently of React geometry rendering. At an interval change, a short opacity transition between the preceding source geometry and current geometry may illustrate the change. It must not invent intermediate boundaries. If the source shard changes, keep the previous layer until the next tile source is ready. For very rapid playback, skip unloaded intermediate shards rather than queueing every year.

The optional reference layer uses `manifest.snapshots` and its `territories`/`labels` layers; props include `year`, `name`, `polity`, `entityId`, `color`, `areaKm2`, `precision`, `approximate`, and `sourceUrl`. Any crossfade between its widely spaced snapshots must be described as illustrative.

Natural Earth uses `manifest.basemap.url` with layers `land`, `coastline`, `rivers`, `current_borders`, and `relief`. The `relief` layer contains named physiographic regions, **not a digital elevation model or hillshade raster**. Hide modern political borders and labels for ancient views.

## Territory panels and event synchronization

`/geo/polities.json` is a lightweight index. Each polity includes `detailsUrl`, where a separately loaded document contains its sourced intervals and area curve. `firstObserved` and `lastObserved` are the bounds of dataset observations, not invented founding or dissolution dates.

Cliopatria area values are measured upstream using equal-area EPSG:6933. The reference Historical Basemaps area curve is an approximate spherical polygon measurement. Cultural overlap and changing source coverage mean area is not a definitive statement of sovereignty.

Stable entity IDs are hashes of source names. **Do not deduplicate polities by QID:** the upstream dataset sometimes assigns one QID to multiple distinct polity names. A `wikidataId` is an attributed source cross-reference, not a claim that all rows sharing it denote the same state.

`/geo/territorial-changes.json` records each distinct source geometry state with `entityId`, `year`, `toYear`, `previousRecordId`, `areaKm2`, `sourceRecord`, `source`, and `eventIds`. The last array is intentionally empty: neither supplied boundary dataset establishes battle-level causal links. Selecting an event still synchronizes the map to its year and displays the independently sourced territories valid then. Populating `eventIds` later requires an explicit citable historical source, not proximity, date coincidence, or a shared belligerent.

## Validation

`data/geography/report.json` and `cliopatria-report.json` contain counts, exclusions, input anomalies, rejects, source revisions, and limits. Unit/artifact checks cover BCE conversion, name-ID normalization, spherical area and hole subtraction, interior label placement, PMTiles headers, contiguous shards, valid entity intervals, and source provenance. This validates the engineering and declared source contracts; it does not certify all historical claims in upstream datasets.

The normalization keeps source terminology, including labels that historians may dispute. Identity continuity across name changes, neighbor-aware palette optimization, formal geometry-topology repair, and historian review are not claimed by these outputs.
