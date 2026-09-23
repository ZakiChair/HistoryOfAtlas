# BOEM discovered offshore oil and gas fields

`boem-discoveries.json` adds **1,191 fields** and discovery evidence for **157 existing GEM sites** representing 137 BOEM field identities. It covers 1,328 of the 1,336 fields in the official reserves history; eight fields have neither a verified representative position nor an existing geolocated GEM identity. New sites include 460 with crude oil and gas and 731 with gas evidence only.

This is a discovery catalogue, not an inventory of currently producing fields. Every new site has `periods: []`. The application can show it from discovery onward, including after closure. No lease qualification date, first-production date, current status, remaining reserve estimate or cumulative production value is converted into a continuous exploitation period.

## Primary sources and reuse

- [BOEM discovered resources](https://www.boem.gov/oil-gas-energy/resource-evaluation/discovered-resources): the 2025 reserves release, with historical data through 31 December 2023. [Official workbook archive](https://www.data.boem.gov/FieldReserves/Files/2023%20Tables%20xlsx%20Public.zip), sheet `HIST-2023`, provides 42,044 field/year rows and the explicitly labelled `Field disc year`. All repeated discovery years agree for each of the 1,336 fields. The readable equivalent is [Reserve History for Fields](https://www.boem.gov/oil-gas-energy/resource-evaluation/reserve-history-fields).
- [2026 OCS Operations Field Directory](https://www.boem.gov/oil-gas-energy/resource-evaluation/ocs-operations-field-directory): a field is a geological accumulation; the named area/block usually identifies the discovery-well block. Appendix A explicitly relates blocks to fields. Appendix C maps operator nicknames to field codes. These include active and expired leases, rather than only current operations.
- [Separate oil, condensate and gas field-production definitions](https://www.data.boem.gov/Main/HtmlPage.aspx?page=fieldNames2) and the [production archive](https://www.data.boem.gov/FieldReserves/Files/mastproddelimit.zip): crude oil requires a strictly positive `FIELD_OIL_PROD` value. Condensate and the combined liquid column are deliberately insufficient. Gas requires positive original gas reserves in the history workbook. Casinghead gas is still gas. The field-wide discovery date is marked approximate because separate fuel/reservoir discoveries are not supplied.
- [BOEM Blocks mapping download](https://www.data.boem.gov/Mapping/Files/blocks.zip), [metadata](https://www.data.boem.gov/Mapping/Files/blocks_meta.html) and [official ArcGIS block layer](https://gis.boem.gov/arcgis/rest/services/BOEM_BSEE/GOA_Layers/MapServer/6): position sources.
- BOEM-created government data are public domain under its [copyright policy](https://www.boem.gov/about-boem/copyright-restrictions-and-permissions). Attribution and original URLs are retained.

`sourceYear: 2026` records the directory/geometry snapshot. It does not imply 2026 production, and the discovery inventory does not cover discoveries newer than the reserves history.

## Geometry and identity

The locator parses the official field code into area and named block, requires that exact area/block/field membership in Appendix A, and joins `AREA_CODE + BLOCK_NUMB` in the official DBF to `PROT_NUMBE`. ArcGIS returns the matching block polygon transformed to EPSG:4326. Its area centroid is a representative approximate point, generally within a block about three miles on a side; it is not a reservoir outline or the precise discovery well. Native NAD27 coordinates are never used directly as WGS84. There is no fallback to a town, basin or planning-area centre.

1,327 field/block positions pass the strict join. Nine geometry exclusions are recorded in `sources/boem-position-manifest.json`; TS000 can still receive discovery evidence through its existing explicit GEM identity, leaving eight omitted sites.

Existing GEM units are matched using an exact BOEM field code in the published name and a plausible Gulf location. If BOEM supplies nicknames, a named GEM discovery must also agree with one; a generic code-only designation remains valid. Conflicting names are preserved separately: Tiberius/Hadrian South, Salsa/Conger, Rigel/Neidermeyer and Ballymore/East Anstey. An exact official nickname is accepted only within 25 km; this prevents unrelated homonyms elsewhere in the United States. Multiple explicitly coded operator assets for one field each receive the evidence; no additional BOEM marker is created for that field. Their pre-existing asset identities are not merged by this contribution. Matches are recorded individually in `audit`.

Tiberius/KC964 (`goget:L100000320669`) has a GEM position 170.49 km from its official block. Its operator explicitly places the separate 2023 oil discovery in block KC964; BOEM lists the older Hadrian South gas field under the same block code. Their histories are not merged. Spruance is also explicitly dated 2019 by LLOG and therefore is not backdated to the BOEM EW921 historical-code record (1989); the latter keeps a neutral code-only label instead of the modern Spruance nickname. Likewise, the independently documented 2017 Shenzi North discovery is kept separate from Shenzi (2002), following Woodside’s 2022 SEC registration statement, page 194. Tiberius is flagged in `coordinateReviews` with both primary URLs rather than silently relocated. The parent pipeline can apply a separately reviewed coordinate correction. GEM's country-centre Taggart position is excluded from matching, so the accurately located BOEM field is retained.

## Reproduction

Only the Python standard library is required. The compact source archive preserves discovery years, source-derived fuel evidence, aliases and reviewed positions. Its decompressed SHA256 is checked on every build. The position manifest retains the original DBF/Appendix A hashes and all 58 ArcGIS request URLs/response hashes. Large original workbooks and shapefiles are not bundled.

Offline check and regeneration:

```sh
python3 pipeline/resources/boem-discoveries.py --check
python3 pipeline/resources/boem-discoveries.py
```

Re-acquire the same reviewed snapshot into a private directory, recompute the polygon centroids, then rebuild the compact archive:

```sh
python3 pipeline/resources/boem-positions.py --source-dir /tmp/hoa-boem-rebuild
python3 pipeline/resources/boem-discoveries.py --acquire \
  --source-dir /tmp/hoa-boem-rebuild \
  --positions /tmp/hoa-boem-rebuild/hoa-boem-field-positions.json
python3 pipeline/resources/boem-discoveries.py --check
```

The locator uses the committed extract's fixed field-ID set, downloads only absent original inputs, and rejects a changed source or geometry response against the reviewed manifest. The acquisition step likewise verifies original archive hashes and the positions file before replacing the compact archive. BOEM URLs are mutable: a future differing release must be reviewed and its manifest updated intentionally. The deterministic gzip has `mtime=0`; the contribution is regenerated from this extract plus the committed GOGET extract. The latter is used only for reviewed identity matching, never for new BOEM coordinates or discovery dates.

Validation: all new sites and updates pass the application Zod schemas; all 157 update targets exist; field IDs and new site IDs are unique; every new coordinate lies within the Gulf bounds; offline regeneration is byte-identical.

The pinned GEM Mad Dog record (`L100000314393`) contains 1989, contradicted by BOEM GC826 and [Woodside’s SEC-filed history, section 5.2.4](https://www.sec.gov/Archives/edgar/data/844551/000119312522100529/d559567d425.htm), which give 1998. `normalize.ts` corrects only that exact erroneous value and retains the primary correction URL. Production periods and the archived raw source remain unchanged; a regression test verifies this separation.

Mad Dog Southwest is a separately designated GEM phase with no documented discovery date. It therefore does not inherit the parent field’s 1998 discovery through the BOEM join; the principal Mad Dog field still receives that history.
