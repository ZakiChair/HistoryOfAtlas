# Reproducible reported mine production evidence

This supplement adds dated production evidence to mines already identified in the
atlas. At the initial 2026-09-23 snapshot, the offline builder produces **54 matched
sites and 194 annual category observations**, before integration and deduplication
with the other resource datasets. An observation means a site/category/year, not a
new mine or a continuous operating interval.

## Pinned source and exact extraction

The source is the public SQLite index from
[Kadoa World Mining Monitor at commit `4ab9b84e59193d235feafc974d97696987f8ea53`](https://github.com/kadoa-org/world-mining-monitor/tree/4ab9b84e59193d235feafc974d97696987f8ea53).
The immutable acquisition URL is
[`public/data/mining.db`](https://raw.githubusercontent.com/kadoa-org/world-mining-monitor/4ab9b84e59193d235feafc974d97696987f8ea53/public/data/mining.db).

- SQLite SHA-256: `ef718fe055a99d23fb254257256eff577051df1afbebde57e71acccaec25145f`.
- Extract SHA-256: `12713aa68576473821fba76c387457d6e46b16063e17d45971902d65218a98d7`.
- Extract: `sources/reported-mine-production.json.gz`; 179 mine metadata rows and
  8,564 rows where `production.metric = 'production'`, each ordered by `id`.

The acquisition script selects eight mine columns and 21 production columns in
explicit, stable order. Their definitions are `MINE_COLUMNS` and `RECORD_COLUMNS`
in the script. The top-level JSON keys are `mines`, then `records`. It preserves
SQLite nulls, number types and the original `commodities` JSON string. Serialization
is UTF-8 with literal Unicode, compact separators and no trailing newline. Gzip
uses level 9, no filename and `mtime=0`. Both source and compressed output hashes
are pinned; changed upstream content fails validation rather than silently
replacing evidence. The extract omits report prose (`source_excerpt`) and retains
factual values and report locators.

## Verify or acquire

Only Python's standard library is required. Run from the repository root:

```sh
# Offline verification against the retained original database; writes nothing.
python3 pipeline/resources/reported-production-acquire.py --check --database /tmp/hoa-world-mining.db

# Download the pinned database to a temporary directory and verify existing files.
python3 pipeline/resources/reported-production-acquire.py --check

# Explicit acquisition: writes only the source gzip and its manifest.
python3 pipeline/resources/reported-production-acquire.py --acquire

# Reproduce into an isolated directory with an existing database.
python3 pipeline/resources/reported-production-acquire.py --acquire --database /tmp/hoa-world-mining.db --output-dir /tmp/hoa-reported-production-check

# Verify that the separate offline evidence builder reproduces its checked-in output.
python3 pipeline/resources/reported-production-build.py --check
```

With no mode flag, acquisition defaults to **check**, not write. `--database` skips
the network but still verifies the original database checksum. Check mode compares
the existing manifest and both decompressed content and compressed bytes. Only
`--acquire` writes an archive or manifest; its `retrievedAt` records that acquisition's
UTC date. It never updates the commit or creates new matches automatically. A
different snapshot requires an explicit source review and updated pinned constants.
These commands do not regenerate public atlas data or launch the application.

## Matching, dates and limitations

`reported-production-matches.json` contains reviewed index-to-atlas identities and
aliases. Matching uses a named mine or complex, country and coherent geography;
proximity alone is insufficient. The index's coordinates remain in the
pipeline extract for auditing. **No new coordinates are imported into the atlas.**
Existing independently sourced coordinates and historical interruptions are retained.

The offline builder requires a positive production value, confidence at least 0.95,
a supported commodity, an HTTPS report URL, and a reviewed alias in the report's
row, table or section. It accepts explicit completed calendar quarters in 2021–2026;
at this September snapshot only Q1 and Q2 are eligible for 2026. Fiscal labels require an explicit calendar-quarter mapping; half-year
and ambiguous aggregate periods are excluded. Locator text indicating forecasts,
guidance, targets, tailings, stockpiles or recycling is excluded. Metal-equivalent
indicators, sales, shipments and grades cannot establish extraction of a commodity. Reviewed match
cutoff years are respected. Several index identities therefore yield no accepted
observation despite appearing in the matching file.

Each surviving observation is a single year for its commodity. It is **not** an
opening date, a closure date, evidence of uninterrupted daily extraction, or a
reason to extrapolate into an unobserved year. A positive production metric may
include on-site processing; text filters cannot certify every upstream extraction
detail. Confidence scores describe the index extraction, not independent geological
verification. Company totals, sales and proposed projects are outside this
supplement's intended scope; the named report locator and reviewed mine identity
are necessary safeguards, not a claim that all index rows are reliable.

The primary evidence is the operator report referenced by each accepted row,
sometimes served through the index's archived copy. The public period retains its
report URL and document/page attribution; the pipeline audit retains all contributing
row IDs and the selected table, row and quarter. The index is a discovery and
extraction aid, not a replacement for the underlying report. Its code is MIT;
original operator reports retain their copyright. This supplement republishes
factual report metadata, not report prose, and does not claim that the original
reports are MIT-licensed. Coverage follows the reports and identities reviewed at
this snapshot and is neither exhaustive nor a global inventory of active mines.
