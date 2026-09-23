# Resources known since discovery

`sites.json` contains **22,325 sites across 164 source country/area labels**, acquired on
2026-09-23, with **16,646 periods**. The atlas shows resources known by the selected year, from discovery or the earliest retained attestation.
Sites remain visible after closure, including deposits without documented production.
When discovery is unknown, a dated catalogue or production record provides a
clearly labelled attestation. Missing evidence is a coverage gap. Resource quantities, reserves and
historical political control are not reconstructed.

| Source | Snapshot | Sites retained |
| --- | --- | ---: |
| GEM Global Oil and Gas Extraction Tracker | March 2026 | 6,917 |
| GEM Global Coal Mine Tracker | August 2026 | 6,910 |
| Norwegian Offshore Directorate | September 2026 | 419 |
| BOEM Gulf offshore fields — additional identities | 2025 reserves release through 2023; 2026 directory | 1,191 |
| USGS and ICMM mineral occurrences — additional identities | Qualified attestations: 2009 and 2026 | 4,217 |
| MinCan Canadian mines | March 2024; production through 2022 | 643 |
| FINEPRINT global mines | Version 1.0.3; mineral evidence through 2020 | 426 |
| GEM Global Iron Ore Mines Tracker | September 2026 | 687 |
| Individually reviewed historical, West African, uranium, rare-earth and recent operator evidence | Reviewed September 2026 | 119 |
| Canadian, Australian and US producing/status registers — additional identities | Latest available 2025–2026 registers, qualified where approximate | 176 |
| Stimson rare-earth leaching observations | Individual observed years 2016–2026, not all active today | 620 |

The catalogue contains **6,499 oil** and **7,196 gas** sites/assets, including mixed fields counted in both categories. Existing operator assets within a shared field are not asserted to be distinct geological accumulations. The historical sample extends to approximately 1700 BCE. All 45 resource categories
are represented in the data and have representative pictograms. All known sites remain visible in 2026. Their presence does not imply current
extraction or remaining recoverable reserves. Mineral evidence includes gold, copper, uranium,
lithium, iron, bauxite, nickel, zinc, lead, silver, tin, salt, phosphate, potash,
cobalt, manganese, molybdenum, graphite, diamonds, platinum, palladium, tungsten,
antimony, niobium, tantalum, mercury and rare earths, alongside oil, gas and coal.
Country names are source labels, not reconstructed historical boundaries.
Coordinates are field, deposit or district markers, not exploited extents.

## Global Energy Monitor

Attribution: **Global Oil and Gas Extraction Tracker, Global Energy Monitor,
March 2026 release**; **Global Coal Mine Tracker, Global Energy Monitor,
August 2026 release**. Data is adapted by extracting columns, filtering records,
merging geometry duplicates and deriving documented periods. These modifications
do not imply endorsement by GEM.

License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
Preserve attribution, license and modification notice when redistributing.
[GEM's license and disclaimer](https://globalenergymonitor.org/creative-commons-license).

- [Oil/gas methodology](https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker)
- [March 2026 oil/gas source GeoJSON](https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/interim_maps/goget_map_2026-03.geojson)
- [Coal methodology](https://globalenergymonitor.org/projects/global-coal-mine-tracker)
- [August 2026 coal source GeoJSON](https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/Current_maps/gcmt-smp/gcmt-smp_map_2026-08.geojson)
- GEM's own [oil/gas map configuration](https://globalenergymonitor.github.io/interim-maps/trackers/goget/config.js)
  and [coal map configuration](https://globalenergymonitor.github.io/interim-maps/trackers/gcmt/config.js)
  identify those downloads.

The original oil/gas extract has 7,673 records. Positive `prod-oil`/`prod-gas`
observations identify attested fuels. Published production starts bound single-fuel
fields; mixed fields use each fuel’s first positive observation so a later
co-product is not backdated. Documented closure or the dated 2026 operating
status bounds the end. Inactive assets without a cessation year stop at their
last positive observation. These spans are marked approximate because
intermediate interruptions may be undocumented; explicit zero years remain gaps.
Published discovery years and explicit oil/gas unit designations independently
establish known resources, including fields without production. For mixed fields,
the field discovery date is marked approximate for individual fuels. Where no
discovery is published, opening/output evidence or the 2026 catalogue provides an
explicitly labelled attestation. Discovery and asset names never establish
production. Country-level coordinates and unidentified fuels are excluded.
Exact/approximate location labels are preserved.

The coal extract has 7,436 geometry features representing 6,914 project IDs.
Coordinates come from the published latitude/longitude columns. IDs deduplicate
point/polygon records. Published opening or first-output dates are bounded by
closure or the dated operating-status snapshot. An operating mine without any
historical start appears only at the 2026 attestation. Operating-life spans are
explicitly approximate: endpoints do not document intermediate shutdowns or prove
continuous annual extraction. Explicit zero-production years remain excluded.
Future/planned dates cannot establish exploitation; projects and closed mines
remain eligible for dated knowledge attestations. Invalid or country-only
positions are excluded.
Missing wiki links fall back to the tracker page. Location precision is unknown
where the map does not state it. Jellinbah’s erroneous imported northern-hemisphere
position is replaced by the [Geoscience Australia MI333308 point](https://linkeddata.pid.geoscience.gov.au/collections/mi/items/333308?f=json),
with its published 100 m precision; the cited correction is recorded in the audit.

The trackers have size thresholds and depend on available public evidence. They
are not a complete history of fossil-fuel extraction.

## Norwegian Offshore Directorate (SODIR)

Attribution: **Norwegian Offshore Directorate, FactPages annual field production
and FactMaps field geometries**, retrieved 2026-09-23. Adapted under the
[Norwegian Licence for Open Government Data (NLOD) 2.0](https://data.norge.no/nlod/en/2.0).
See the Directorate's [open-data policy](https://www.sodir.no/en/about-us/open-data/).

- [Annual saleable field production](https://factpages.sodir.no/en/field/TableView/Production/Saleable/Yearly)
- [CSV download](https://factpages.sodir.no/public?/Factpages/external/tableview/field_production_yearly&rs:Command=Render&rc:Toolbar=false&rc:Parameters=f&IpAddress=not_used&CultureCode=en&rs:Format=CSV&Top100=false)
- [Official field layer](https://factmaps.sodir.no/api/rest/services/DataService/Data/FeatureServer/7100)

The extract preserves 2,414 annual rows, spanning 1971–2026, and 142 field
centroids. Join keys are official field IDs. Records without matching field
geometry or positive oil/gas observations are excluded. Oil and gas categories
refer to their corresponding net saleable-production columns; separately reported
NGL and condensate are excluded. The current 2026 value covers only part of the
year. Only consecutive positive years with exactly the same categories merge.
For example, YME remains 1996–2001 and 2021–2026, with no inferred production in
between. Geographic points are official field centroids transformed to WGS84,
marked approximate, not individual wells.

A total of 139 Norwegian GEM identities are replaced by official SODIR
fields/discoveries: 120 geographically consistent name matches and 19 individually
reviewed field/well identities. Exact mappings and evidence are in
`source-audit.json` and `pipeline/resources/norwegian-discovery-matches.json`.
The independent discovery import adds 291 field/deposit locations and discovery
dates for the 128 identities with production observations. Known resources
persist after discovery even when no exploitation is attested.

## Historical minerals and mines

Individually researched sites use government geological/heritage records,
UNESCO, operators, museum histories, archaeological research or regulatory
technical filings. Every period has its own evidence URL, and coordinate evidence
is separately linked. Full notes and the USGS coordinate-record mapping are in
`pipeline/resources/historical.json`, `historical-expanded.json`, `west-africa.json`
and `current-major-mines.json`; original source prose/images are not
redistributed. Factual metadata is transcribed; each original source retains its
own copyright. `sourceYear: 2026` means this evidence-review snapshot, not the
publication date of every historical document.

Known interruptions are preserved, including Kennecott, Quincy and Ranger.
Ranger excludes later stockpile processing. An end year that represents the
latest operator report is not asserted to be a closure. Archaeological bounds
for Great Orme and Las Médulas, and the century-level start at Falun, are marked
approximate. Dates use astronomical years; for example, -1699 means 1700 BCE.

## Global mineral datasets and recent observations

- **MinCan**, Clara Dallaire-Fortier, *Past and Present Productive Mines of Canada,
  1950–2022*, March 2024: [dataset](https://figshare.com/articles/dataset/Principal_Productive_Mines_of_Canada/23740071),
  [research article](https://doi.org/10.1038/s41597-024-03116-3),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **FINEPRINT**, Simon Jasansky, Mirko Lieber, Stefan Giljum and Victor Maus,
  *Open database on global coal and metal mine production*, version 1.0.3:
  [versioned dataset](https://zenodo.org/records/7369478),
  [research article](https://doi.org/10.1038/s41597-023-01965-y),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Global Iron Ore Mines Tracker**, Global Energy Monitor, September 2026:
  [methodology](https://globalenergymonitor.org/projects/global-iron-ore-mines-tracker),
  [source GeoJSON](https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/Current_maps/giomt/giomt_map_2026-09.geojson),
  [CC BY 4.0](https://globalenergymonitor.org/creative-commons-license).
  Factsheet dates and revision URLs are preserved as factual metadata. GEM wiki
  prose has a separate CC BY-NC-SA licence and is not redistributed here.

These datasets are adapted by selecting actual extraction facilities, joining
published dates or annual output, preserving suspensions, restricting categories
to dated commodity evidence and reconciling explicitly identified duplicates.
The full rules, source hashes and modification notice are in
`pipeline/resources/modern-minerals-README.md`. These adaptations imply no
endorsement by the original authors.

Academic mineral observation coverage usually ends in 2020/2022. Later missing years are
not closures. New operator reports add only observed production years, without
filling the intervening gaps. The September 2026 iron tracker attests a current
operating status; its lifetime intervals remain approximate because intermediate
interruptions may be undocumented. Known shutdowns take precedence.

The West African contribution adds 30 mines/districts, including ten modern
Malian gold mines and the approximate historical gold districts of Bambuk and
Buré. Regional historical markers do not backdate modern industrial mines.
Actual 2026 quarterly extraction reports attest Loulo/Gounkoto, Fekola, Syama,
Sadiola and Nampala; forecasts are excluded. Loulo/Gounkoto evidence is reported
for the joint complex, not an allocation of output to each constituent mine.
Sadiola, Yatela, Morila and Kalana preserve documented suspensions and distinguish
ore extraction from later stockpile processing. Ancient/medieval evidence remains
sparse and does not constitute a worldwide inventory of historical extraction.

Recent completed-quarter observations also come from primary operator reports
located through the [World Mining Monitor index](https://github.com/kadoa-org/world-mining-monitor/tree/4ab9b84e59193d235feafc974d97696987f8ea53).
The pinned September 2026 snapshot is filtered to actual mine-level production,
reviewed identities and explicit calendar quarters. Sales, forecasts, company-wide
totals, known stockpile-only operations and equivalent-metal indicators are excluded.
No new coordinates or continuous periods are inferred. Original reports retain
their copyright; only factual metadata and source locators are preserved.
See `pipeline/resources/reported-production-README.md` for hashes and reproduction.

The table counts canonical site origins; supplementary recent reports update
those same sites without creating additional points. The legend can isolate each
resource category; unfiltered multi-resource sites display a combined pictogram.

Reviewed identities in `source-audit.json` prevent duplicate counting across the
modern and curated contributions. Merged periods retain individual source URLs
and category assignments; for example, recent iron observations at Kiruna do not
extend its short historical phosphate-production phase.

## Expanded contemporary coverage

The national contributions preserve source qualifications and explicitly avoid
inventing historical opening dates:

- [Natural Resources Canada principal producing mines](https://open.canada.ca/data/en/dataset/000183ed-8864-42f0-ae43-c4313a860720), February 2026, under the Open Government Licence — Canada.
- [Geoscience Australia operating mines](https://services.ga.gov.au/gis/rest/services/AustralianOperatingMines/MapServer/0), December 2025, under CC BY 4.0. The latest known operating status is carried into the 2026 view for one year and marked approximate; known closures, projects and tailings-only facilities are removed.
- [USGS US Mines and Facilities 2026](https://doi.org/10.5066/P1BUPUAM), public domain, with **Assumed active** status explicitly qualified. Rows came from an attributed public mirror because the official workbook was unavailable; byte-for-byte equivalence was not verified. Existing or independently reviewed mine coordinates are used.

[National import rules](../../../pipeline/resources/national-mining-README.md) and
[US acquisition limitations](../../../pipeline/resources/current-us-mines-README.md)
describe exact inclusions, exclusions and source matching.

The uranium contribution combines Kazatomprom's January 2026 competent-person
report and H1 production with separately cited operator or regulator reports in
Namibia, Australia, Canada, Russia and the US. Seventeen Kazakh mine positions are
retained, mostly digitized from the primary georeferenced map and explicitly
approximate. Missing reliable coordinates remain omissions, including reviewed
Uzbek and Chinese operations; district centers are not substituted for mine sites.

[Rare-earth evidence](../../../pipeline/resources/current-rare-earths-README.md)
combines ten industrial operations with 620 dated Stimson satellite observations
in Myanmar/Laos. Only 33 of those satellite records attest activity in 2026. All 620 remain
known after their first observation, without implying continuing activity;
a recent database update alone does not imply current extraction. The original
satellite images are not redistributed. Per-record evidence and licensing notes
remain available in the contribution and application source list.

This expansion remains a documented inventory rather than an exhaustive global
census. Status snapshots, observed activity and approximate coordinates are
identified in each site's details. Production amounts and reserves are not inferred.

## Archived USGS occurrences

The **USGS Major mineral deposits of the world**, Open-File Report 2005-1294,
contains 3,168 occurrences. Its metadata declares publication 2005 and content
through source publications in 2009. It has no exploitation chronology, so its
occurrences contribute dated **knowledge attestations**, separately from
production. The source-compilation upper bound of 2009 is marked approximate;
it is not asserted to be the discovery year. Exact reviewed identities merge
into existing sites; other accepted occurrences have no exploitation periods.
Coordinates may be one or a few kilometres from the deposit.

- [USGS dataset](https://mrdata.usgs.gov/major-deposits/)
- [USGS report](https://pubs.usgs.gov/of/2005/1294/)
- [Unmodified preservation ZIP, Pennsylvania State University](https://www.datacommons.psu.edu/download/canary/canary-downloads/other-minerals/mineral-resource-online-spatial-data-usgs/mineral-resource-occurrences/major-mineral-deposits-of-the-world/ofr20051294-csv.zip)
- Public domain: supplied metadata states no access/use constraints;
  [USGS copyright policy](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits).

## Discovery visibility and additional catalogues

[Discovery and attestation rules](../../../pipeline/resources/discovery-README.md)
explain the separate knowledge and exploitation timelines. GEM's published field
discovery years now survive acquisition, including discovered/non-producing
fields. Mine openings or source timestamps are never relabelled as discoveries.

[SODIR's official discoveries](https://factpages.sodir.no/en/discovery/TableView/Overview)
add explicit discovery years, hydrocarbon types and unproduced deposits. Official
field/discovery identifiers reconcile constituent discoveries. Positions use
published field/discovery centroids, or the explicitly linked discovery well where
no footprint exists. All are representative points; condensate is not crude oil.

[BOEM Gulf offshore fields](../../../pipeline/resources/boem-README.md)
add official field discovery years from the published reserve-history records,
joined to the field directory and named blocks. Block centroids are explicitly
approximate representative positions, not reservoir boundaries or exact wells.
Reviewed names prevent conflating separate discoveries sharing a block. Crude-oil
evidence is separate from condensate; no production lifetime is inferred from a
discovery or reserve estimate. Original federal factual data is public domain;
source extracts, query URLs, hashes and omissions are preserved offline.

[USGS and ICMM mineral occurrences](../../../pipeline/resources/mineral-occurrences-README.md)
expand all 45 resource categories. ICMM's July 2026 catalogue includes closed mines
and projects: it supplies a knowledge attestation, never proof of current output.
Only mine records with adequate identity confidence and geographically coherent
positions are retained. Smelters/refineries/processing plants are excluded. The
adaptation is under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and
implies no ICMM endorsement. Source rows, identity reviews and exclusions are
preserved in the offline inputs.

## Reproducibility

The browser requests the local static dataset only. Run `pnpm data:resources` to
rebuild and `pnpm data:resources:check` to validate offline. See
`pipeline/resources/README.md`, the compact source extracts and hash manifest.
SODIR URLs are live; preserved extracts reproduce this dated snapshot.
