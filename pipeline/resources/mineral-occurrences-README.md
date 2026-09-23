# Mineral occurrences and documented knowledge

```sh
python3 pipeline/resources/mineral-occurrences-test.py
python3 pipeline/resources/mineral-occurrences-build.py
python3 pipeline/resources/mineral-occurrences-build.py --check
```

This contribution adds **4,217 locations** (2,643 USGS, 1,574 ICMM) and attaches
4,129 source rows to existing identities. It imports geological/mining-location
knowledge, **never current operating status**. Every new site has `periods: []`.
Its `knowledge` is an approximate documentary `attestation`, not `discovery`.
The historical application can display this knowledge from its cited date onward;
no lifetime of extraction is inferred.

The result is `{sources, sites, knowledgeGroups, audit, omitted}`. Add every new
site before applying knowledge groups: a later catalogue can refer to a new
occurrence imported from the earlier catalogue. Preserve every prior exploitation
period. The 4,124 update targets group 4,129 matched source rows; some targets have
more than one independent catalogue entry. Existing coordinates are retained.

## Evidence and dates

- [USGS Major mineral deposits](https://mrdata.usgs.gov/major-deposits/): 3,168 raw
  records. Archived metadata identifies the Open-File Report series as 2005 but
  gives **2009** as the publication date of the last source in this compilation.
  Consequently 2009 is the conservative catalogue-attestation bound, not a
  fabricated discovery date. The metadata explicitly describes regional points,
  potentially kilometres from the deposits, and inconsistent regional coverage.
  The original preserved ZIP was acquired from Pennsylvania State University;
  its acquisition provenance remains in `sources/manifest.json` and the metadata
  is checked in as `sources/usgs-metadata.txt`.
- [ICMM July 2026 V1.5 catalogue](https://www.icmm.com/website/data/2026/global-mining-dataset-1-5.xlsx?cb=142831):
  7,104 raw records. Only exact asset type `Mine` with High/Moderate identity
  confidence is eligible. Smelters, refineries, plants and mixed facility types
  are excluded to avoid confusing processed material with a local deposit.
  Primary and explicitly listed secondary commodities describe mineral
  associations. Closed mines and future projects may be included as **known
  locations in 2026**, with no production claim. Very Low confidence identities
  remain omitted. Adapted under CC BY 4.0; no ICMM endorsement is implied.

Mappings are explicit. For example, PGE becomes the platinum-group category,
not invented separate platinum and palladium; heavy-mineral sands are not
automatically assigned titanium. Unsupported commodities remain omitted. The
USGS catalogue supplies occurrences for chromium, vanadium, fluorite, boron and
silicon even where the operating-data sources had little or no coverage.

## Identity and geographic safeguards

`mineral-occurrences-reviews.json` holds 423 explicit historic/catalogue identity
matches, the country-screen policy and two known erroneous-identity/position
exclusions. Historical `usgs:*` aliases include Kiruna, whose published USGS
coordinate is superseded by the precise curated position. ICMM06469 is excluded
because its Rosebery label conflicts with the Renison Bell position/group name.
ICMM06878 Priargunsky is excluded because the published town coordinate is about
80 km from the mine.

Other matches require a unique normalized **primary name**, the same country
and positions within 10 km. Pit/directional names remain significant. Nearby
different names, mine-group aliases and multiple matching candidates never cause
an automatic merge. Non-Latin names retain their letters. Source coordinates
and distances remain in the audit.

New locations are screened against the frozen Natural Earth 1:110m country
geometry, with a 40 km allowance for generalized boundaries and regional points.
This is a coarse contradiction screen, not a claim of precise siting or a
political-boundary determination. Historical country labels are checked against
the relevant polygon union. Fifty suspect points, including unsupported small
islands/offshore locations, remain omitted pending review. Coordinates are never
silently moved, sign-flipped or replaced with a country/city centroid. The
`omitted` array documents every rejected raw row (1,926 total across all reasons).

## Reproducibility

Frozen extracts, the 16,937 pre-import canonical identity records, and geographic
screen geometry are compressed in `sources/mineral-occurrences-*.json.gz`.
Their URLs and SHA-256 hashes are recorded in
`sources/mineral-occurrences-manifest.json`. The builder checks hashes and
`--check` compares its complete deterministic output without writing files.
It never changes `public` or `out`. Refresh reviewed identities explicitly when
the canonical resource corpus changes.

Seven targeted tests cover documentary dating, no invented operation, allowed
commodities, processing/low-confidence exclusions, distinct nearby pits,
ambiguous identity matches, non-Latin names, country screening and invalid
coordinates. The emitted sites and knowledge updates are also validated against
the application's Zod schema and all current/new target IDs before integration.
