# Non-fossil mining expansion

`modern-minerals.json` is a standalone contribution with `{ sources, sites, audit }`.
It does not modify the public atlas dataset by itself. Its 1,780 mine records in
83 countries contain 2,580 periods and 26 supported commodities; 661 iron mines
have operating status attested in the September 2026 snapshot. This is a larger
source-backed catalogue, not an exhaustive inventory of every mine in history.

## Build and validate offline

```sh
python3 pipeline/resources/modern-minerals-build.py
python3 pipeline/resources/modern-minerals-build.py --check
```

The script uses only Python's standard library. `--check` verifies source hashes,
deterministic output, coordinate/category/source/period invariants, minimum
coverage and known shutdown/coordinate corrections. Integration should additionally
validate the contribution with `ResourceDatasetSchema`, then reconcile its sites
with historical and current operator curation using explicit identities.

To reacquire source downloads and factual GEM date records:

```sh
python3 pipeline/resources/modern-minerals-acquire.py --wiki
```

Or supply original downloads named `global.zip`, `mincan.xlsx`, `giomt.geojson`
using `--source-dir /path/to/downloads`. The app never invokes this script or any
external API. `sources/modern-minerals-manifest.json` preserves URLs and SHA-256
hashes. The two academic source downloads are versioned; GEM's map is a named
September 2026 release, while wiki lookups are live. The checked-in compact wiki
facts preserve page/revision IDs, timestamps and citation URLs. Rebuilding from
the local snapshots is reproducible; reacquisition may deliberately change them.

## Sources and adaptations

| Source                                            | Original scope                       |                       Contribution |
| ------------------------------------------------- | ------------------------------------ | ---------------------------------: |
| MinCan, March 2024                                | 947 principal Canadian mines         |                                647 |
| FINEPRINT/Jasansky et al., v1.0.3                 | Non-fossil observations through 2020 |                                445 |
| GEM Global Iron Ore Mines Tracker, September 2026 | 980 map records                      | 688 plus one merged into FINEPRINT |

**MinCan:** Clara Dallaire-Fortier, _MinCan: Past and Present Productive Mines of
Canada, 1950–2022_, March 2024 workbook, [dataset](https://figshare.com/articles/dataset/Principal_Productive_Mines_of_Canada/23740071),
[article](https://doi.org/10.1038/s41597-024-03116-3),
[versioned workbook download](https://ndownloader.figshare.com/files/45011833).
Licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The workbook explicitly defines `open1/close1` through `open3/close3` as production
and suspension/reopening years. The value `open` means operating as of 2022.
Separate phases remain separate; no extension beyond 2022 is inferred. Phase
bounds are approximate operating periods, not proof of output on every day/year.
Only the primary commodity is projected through those phases: undated co-products
remain in the audit instead of being falsely assigned to every historical year.
The original coordinates identify mines, but records explicitly pointing at a
museum are excluded. Where the source gives no mine name, the label explicitly
identifies a company/locality-based MinCan mine record. Original row numbers,
notes, co-products and linked evidence are retained in the audit.

**FINEPRINT:** Simon Jasansky, Mirko Lieber, Stefan Giljum and Victor Maus,
_Open database on global coal and metal mine production_, version **1.0.3**,
[Zenodo 7369478](https://zenodo.org/records/7369478), published November 2022 with
[Data Descriptor in Scientific Data, 2023](https://doi.org/10.1038/s41597-023-01965-y).
Licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The versioned ZIP contains a GeoPackage and CSV tables with explicit
`production_start`, `production_end`, `activity_status_year`, annual extraction,
commodity output and document citations.

Only actual mining facilities are retained. Refineries, smelters, company/region
aggregates and undated locations are excluded. Mine-level parent complexes group
their documented sub-sites once. If the parent is only a region/company, its
individual child mines remain distinct; one child's dates never govern its
siblings. A multipoint complex uses its first published valid mine point as a
representative marker; every published point is preserved in the audit. No
synthetic country/city centroid is substituted.

Positive `Ore mined` **or** commodity-production rows at a named mining facility
establish production years. A missing ore-tonnage column is not evidence that
mining stopped: Escondida, Grasberg and Oyu Tolgoi have metal-production series
but no rows in `minerals.csv`. The earlier requirement for both tables excluded
79 geolocated producing mines. The corrected catalogue has 78 more records net,
because Palabora's matching GEM iron record is merged with its FINEPRINT record.

The [primary methodology, Step 4](https://pmc.ncbi.nlm.nih.gov/articles/PMC9873908/)
also explains that extracted material can be filled from processed/produced
material, and production from sales. An `Ore mined` row therefore does not itself
guarantee directly measured fresh extraction. Period descriptions now state this
limitation. `Estimate (value)` source flags produce approximate periods and retain
the estimated field and original source text in the audit. `Estimate (grade)` is
preserved separately and does not incorrectly label the output quantity estimated.
These flags identify explicit source estimates; an unflagged row is not a guarantee
that no processing proxy was used during source compilation.

Explicit zero-extraction years, literal stockpile-processing notes and reviewed
shutdowns take precedence over positive output. The importer excludes residual
recovery at Barneys Canyon after 2001, Ranger after 2012, Kelian after 2003 and
Rawhide in 2003–2009, with primary references in `FINEPRINT_REVIEWS`. Stockpile-only
comments at Cerro de Pasco also remain gaps even when a gap-filled ore-mined row is
positive. Grasberg's metadata date 1967 is a contract date, so it is not used to
backdate extraction. These corrections constrain this snapshot and do not rule
out a subsequently documented reopening. West African gold stays in its separate
reviewed contribution.

Consecutive years merge only for the same category set and evidence description.
Missing years remain gaps. Published production-start/end/status bounds can supply
approximate operating-life intervals; a start can extend back before the first
production observation, without filling later gaps. All per-year original document
URLs, table names, row IDs, values and relevant comments remain in the audit.

The distinction between catalogue coverage and closure is material: although the
combined coal/metal dataset advertises 2000–2021, this release's `minerals.csv` and
`commodities.csv` end in **2020**. No FINEPRINT status observation is newer than 2020. Neither the 2023 article date nor absent end dates support showing these
mines in 2021–2026. Recent years require independently dated operator or inventory
evidence; the correction to historical production filtering cannot supply it.

MinCan is preferred over FINEPRINT for Canadian production phases. GEM is preferred
for global primary iron ore mines: FINEPRINT iron regions can overlap several
individually mapped GEM mines. Each excluded FINEPRINT parent and its reason is
recorded in the audit. Source archives remain intact.

**GEM:** [Global Iron Ore Mines Tracker](https://globalenergymonitor.org/projects/global-iron-ore-mines-tracker),
[September 2026 map](https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/Current_maps/giomt/giomt_map_2026-09.geojson),
linked by the project's [map configuration](https://globalenergymonitor.github.io/interim-maps/trackers/giomt/config.js).
Tracker data is [CC BY 4.0](https://globalenergymonitor.org/creative-commons-license).
GEM wiki's original prose has a **different** [CC BY-NC-SA licence](https://www.gem.wiki/Global_Energy_Monitor:Copyrights).
This contribution transcribes only factual dates/status/numeric production and
citation URLs; it does not redistribute wiki prose. Individual factsheet revisions
are linked. Preserve both source attributions and these modification notices.

The map supplies coordinates/status but omits start/stop columns. Those factual
columns are recovered from versioned factsheets. Operating mines with a published
past start receive an approximate interval ending at the **2026 status attestation**,
not an invented closure. Unknown starts give only the snapshot year. Retired or
mothballed mines require published past start/stop bounds or actual production
observations. Projects and future starts are excluded. Undocumented interruptions
can remain inside approximate lifetime spans; known interruptions take precedence.

## Reviewed corrections and limits

`modern-minerals-corrections.json` records the reasons and primary references for
16 identity/correction decisions. They preserve Scully's 2014–2019 shutdown,
Bloom Lake's 2015–2017 shutdown, Fire Lake's 1984–2006 closure and Silvertip's 2020
suspension. They correct Mary River's faulty MinCan longitude and Mont-Wright's
GEM location incorrectly near Fire Lake, correct Seleine's production start, and
remove named Canadian duplicate records. Changes affect only this adaptation;
original source files remain unchanged.

The final Canadian identity review also consolidates Heath Steele, Birchtree,
Canadian Malartic, Detour Lake and Cochenour. Provincial government inventories,
operator reports and the Red Lake museum correct development dates that the
academic source had treated as production starts. Heath Steele's 1958–1962 and
1983–1989 suspensions, Birchtree's 1977–1989 suspension, Detour Lake's 1999–2013
closure and Canadian Malartic's 1965–2011 hiatus remain separate phases. The
Heath Steele mid-1993 to mid-1994 stoppage is described in adjacent annual phases:
both years contained some production, so an annual map cannot display that
partial-year gap. Cochenour's wartime restart is imprecisely dated; 1945 is left
unassigned rather than inferred from fiscal totals that cross calendar years.

The 2020/2022 mineral coverage endpoints are not closure dates and do not justify
showing those mines in later years. Current operator evidence is integrated
separately. Source labels identify present-day countries and carry no claim about
historical political control. Publication/review years are distinct from the
operation dates in `periods`. Approximate lifetimes and catalogue coverage gaps
must remain visible in the UI; no reserve quantities are inferred.
