# Resource discovery and exploitation evidence pipeline

The resource layer shows resources from documented discovery or their earliest
available attestation onward, including unexploited or closed deposits. Discovery
and exploitation are separate evidence. Missing discovery dates use a qualified
catalogue/production attestation, never an invented opening date. See the
[discovery and visibility rules](discovery-README.md) for schema, dates and imports.

## Reproduce offline

```sh
pnpm data:resources
pnpm data:resources:check
pnpm test tests/unit/resources-data.test.ts
```

The application loads only `public/data/resources/sites.json`. It never contacts
GEM, SODIR or another resource API. Build inputs are checked-in compact extracts
in `sources/*.json.gz`, the reproducible `modern-minerals.json` and
`reported-production.json`, national/US registers, rare-earths,
`sodir-discoveries.json`, `boem-discoveries.json` and `mineral-occurrences.json` contributions,
and individually cited chronology in `historical.json`, `historical-expanded.json`,
`west-africa.json` and `current-major-mines.json`.
The source manifest records SHA-256 hashes of original downloads and extracts.
`source-audit.json` records Norwegian GEM fields replaced by SODIR and reviewed
mineral identities merged according to `reconciliations.json`.
No API key, remote database or external service deployment is required.

`ResourceDatasetSchema` validates coordinates, IDs, categories, source references,
dated knowledge or exploitation evidence, ordered periods, category subsets and
attestation-year upper bounds.
The offline check verifies extract hashes and minimum geographic/category
coverage. Normalization tests cover discovery visibility, catalogue attestations, planned dates,
fuel-specific annual observations, preserved production gaps and reconciliation.

## Acquire sources

```sh
python3 pipeline/resources/acquire.py
pnpm data:resources
pnpm data:resources:check
```

Or use existing original downloads:

```sh
python3 pipeline/resources/acquire.py --source-dir /path/to/downloads
```

That directory must contain `major-deposits.zip`, `goget.geojson`, `gcmt.geojson`,
`sodir-production.csv` and `sodir-fields.json`. GEM URLs identify March/August 2026
releases. SODIR endpoints are live; reproducible offline builds use the preserved
September 2026 extracts, not future responses from those endpoints. Acquisition
updates the snapshot date and hashes. When updating source releases, also review
the source-year constants, provenance and normalization assumptions.

The USGS download was blocked at its original host, so its unmodified ZIP came
from Pennsylvania State University's preservation mirror. Its coordinates and
metadata remain archived. Its mineral occurrences now supply qualified knowledge
attestations in the separate occurrence contribution; they never establish an
exploitation period or an invented discovery date.

## Production evidence rules (independent of map visibility)

- **GEM oil/gas:** positive production identifies each fuel. A published production
  start (single-fuel fields) or first fuel observation (mixed fields) is bounded
  by documented closure, last inactive observation, or the dated operating
  status. These operating-life spans are approximate, with explicit zero years
  removed. Discovery and asset names never establish production.
- **GEM coal:** published opening/first output is bounded by documented cessation
  or the 2026 operating-status snapshot. Unknown historical starts permit only
  the status year. Intervals are approximate because intermediate suspensions
  may be undocumented. Explicit zero years remain gaps; proposed, cancelled,
  future and ambiguous dates are excluded.
- **SODIR:** positive annual saleable oil/gas observations join to official field
  IDs and official WGS84 field centroids. Only adjacent years with identical
  fuel categories merge. Zero/missing years remain gaps. The 2026 observation is
  a partial year; condensate and NGL are not relabelled as crude oil.
- **Historical curation:** `historical.json` contains cited primary histories,
  separate coordinate sources and an audit of interpretations. Known shutdowns
  remain separate periods. Approximate archaeology uses `approximate: true`.
  BCE dates use astronomical numbering (1700 BCE = -1699). An end year may be the
  last attestation rather than closure; descriptions distinguish these cases.
- **Global minerals:** see [the mineral import guide](modern-minerals-README.md)
  for MinCan production phases, FINEPRINT mine observations and the GEM iron
  tracker. The offline check validates their source hashes and deterministic
  reconstruction. Source coverage ends in 2021/2022 for the academic catalogues;
  these are evidence limits, not asserted mine closures.
- **West Africa and historic districts:** `west-africa.json` adds individually
  reviewed gold operations, including Mali and the approximate Bambuk/Buré
  historical districts. Known suspended years and stockpile-only processing
  are excluded. A regional historic marker never backdates a modern mine.
- **Recent operator reports:** `current-major-mines.json` supplies observations
  from actual 2023–2026 results. Guidance and planned production are excluded.
  Reviewed matches retain earlier dated evidence without interpolating gaps.
  [The quarterly report index](reported-production-README.md) supplies additional
  mine-level observations through completed Q2 2026. Exact reviewed identities
  retain existing coordinates; each category is attached only to its observed
  year. The offline check guards current-year categories as well as total counts.
- **National producing registers:** [Canada and Australia](national-mining-README.md)
  add qualified recent operating snapshots, explicit extraction facility types and
  published products. Known closures, processing-only sites and reviewed source
  classification errors are excluded or corrected. Australia's latest December
  2025 operating status carries into 2026 only as an explicitly approximate
  last-known status, never as an invented historical lifetime.
- **US current register:** [the qualified USGS snapshot](current-us-mines-README.md)
  adds 19 locations and 31 existing-site updates, preserving its Assumed active
  status and disclosed public-mirror acquisition limitation.
- **Uranium:** `current-uranium.json` contains 28 reviewed operations, explicit
  coordinate provenance and an omission audit; five reviewed identity merges
  retain historical production gaps.
- **Rare earths:** [industrial and satellite evidence](current-rare-earths-README.md)
  adds operator-documented current sites and dated Myanmar/Laos activity. A
  dataset update timestamp alone never establishes current exploitation.

Norwegian duplicate reconciliation requires a matching official normalized name
(or an individually cited official alias), country Norway and positions within
50 km. Proximity alone never causes a merge. SODIR replaces the complete matching
GEM record, so sparse GEM observations cannot fill a SODIR production gap.

Mineral reconciliation uses explicit reviewed identities, never proximity alone.
Replacing a coarse record preserves a more precise chronology and its shutdowns.
Appending observations preserves each period's own categories, so a recent
co-product cannot appear throughout the mine's earlier life. The pipeline fails
on missing identities instead of silently reintroducing a duplicate after updates.

Country labels describe source geography, not historical political ownership.
Field and district markers do not represent exact mine shafts or well locations.
The layer does not estimate reserves, production quantities or historical control.
See [public provenance](../../public/data/resources/README.md) for citations,
licenses, source URLs and coverage limitations.
