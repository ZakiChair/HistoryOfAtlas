# Dated rare-earth mining observations

This contribution adds 630 sites: 620 satellite-observed leaching sites and ten
individually reviewed industrial operations. It contains 43 observations covering
2026 (33 satellite sites and ten industrial operations). It is not an exhaustive
inventory of operating rare-earth mines.

## Rebuild and check

```sh
python3 pipeline/resources/current-rare-earths-build.py
python3 pipeline/resources/current-rare-earths-build.py --check
python3 -m unittest discover -s tests/unit -p 'test_current_rare_earths.py'
```

The builder is offline and deterministic. It consumes
`sources/current-rare-earths-stimson.json.gz` and
`current-rare-earths-curated.json`, and writes `current-rare-earths.json`.
The output audit records the frozen gzip SHA-256, each inclusion or exclusion,
the original image and metadata dates, and the reason for each dated observation.

## Satellite evidence

The [Stimson dashboard](https://www.stimson.org/2025/mining-in-mainland-southeast-asia-river-basins-dashboard/)
and its [methods](https://www.stimson.org/2025/unregulated-mining-along-rivers-in-mainland-southeast-asia/)
identify mining footprints from satellite imagery. The public
[ArcGIS feature service](https://gis.stimson.org/server/rest/services/Hosted/Mines/FeatureServer/0)
was retrieved on 23 September 2026. The frozen input retains its 631 rows identified
as rare-earth in-situ leaching, with original coordinates, identifiers and credits.
The source credits Stimson Center, Planet Labs and, for particular observations,
Myanmar Witness, Shan Human Rights Foundation or USGS. No imagery is redistributed.

The source includes inactive mines. Its initial mining `year` provides the single
approximate observation year used here; a newer `imgyear` or `last_updated` never
extends a site's operating period. Eleven rows dated `2015 or Older` are excluded
because they do not establish a finite observation year. The remaining 620 records
cover 2016–2026 in Myanmar (586) and Laos (34). Nearby rows remain separate unless
their source identity is identical. These observations establish mining footprints,
not production volumes or uninterrupted extraction between two images.

For future updates, download all feature-service pages, retain their raw fields,
review methodology and date semantics, and replace the frozen input explicitly.
Do not change this rule merely because the dashboard publication date advances.

## Industrial operations

Each operation has a dated 2026 statement by its operator or a public authority.
The individual links and coordinate provenance are in the curated file and audit.

| Operation | 2026 evidence | Coordinate provenance |
| --- | --- | --- |
| Mount Weld, Australia | Lynas FY 2026 report, continued mining | Geoscience Australia operating-mine point (reviewed correction of USGS record 54) |
| Bayan Obo, China | Government identifies producing rare-earth mines | USGS OFR 2026-1018, table 5 |
| Maoniuping, China | Government identifies producing rare-earth mine | USGS OFR 2026-1018, table 5 |
| Weishanhu, China | Government underground mine inspection | USGS OFR 2026-1018, table 5 |
| Dalucao, China | State-owned operator production-site inspection | Mindat named locality; operator EIA corroborates district |
| Pela Ema / Serra Verde, Brazil | Operator confirms production since early 2024 and ongoing in April 2026 | Mindat named mine; operator RIMA maps deposit |
| Lovozero / Karnasurt, Russia | Ministry reports underground equipment in operation | USGS major-deposits record 1673, coarse district location |
| OSCOM / Chatrapur, India | Parliamentary answer confirms integrated mining operations | USGS major-deposits record 272 |
| Chavara, India | Parliamentary answer confirms integrated mining operations | USGS major-deposits record 273 |
| Manavalakurichi, India | Parliamentary answer confirms integrated mining operations | USGS major-deposits record 274 |

All positions and annual observations are marked approximate. Old USGS positions
are used only for location, never to establish current operation. Likewise,
the Chinese USGS report's facility inventory describes 2023; separate 2026 evidence
is required. Lovozero is a coarse mineral-district position, not a surveyed portal.
The three Indian entries represent integrated mineral-sands mining and monazite
recovery operations; no per-mine rare-earth tonnage is asserted. Processing-only
plants are not added as mines.

`current-rare-earths-matches.json` merges the Bayan Obo observation into the existing
GEM Main Mine record. Rare-earths apply only to the new 2026 period, preserving its
older iron-only observations and the separate East and West pit records. Mountain
Pass is already covered by `current-major:mountain-pass` and is not duplicated.

Jianghua has reviewed evidence of 2026 operation but remains deferred because a
reliable representative mine coordinate has not been resolved. Proposed projects,
national reserve estimates, and operations without a reviewed current statement
are not treated as operating mines. The audit records these limits explicitly.
