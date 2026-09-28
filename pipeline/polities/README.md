# Population and capital evidence

`python3 pipeline/polities/acquire.py` freezes the Wikidata statements needed by
`data/curated/polity-facts-mappings.json` into the committed
`data/curated/polity-facts-wikidata.json`. Existing raw caches are reused. Missing
subjects, capital names and qualifier/reference names use the official read-only
Wikidata API, in batches of 50 with a 4.1-second request interval and retry handling.
Successful API batches are cached under `data/raw/wikidata/polity-facts-acquisition/`.
An incomplete acquisition never replaces the previous extract. Original-language
labels are retained when no English or French translation is available.

`pnpm exec tsx pipeline/polities/build.ts` rebuilds all public profiles, their
index and the coverage/rejection report **offline**. The optional
`data/curated/polity-facts-supplement.json` adds independently sourced observations.
`pnpm exec tsx pipeline/polities/build.ts --check` compares the complete output
file set and bytes, including the report, without writing files.

Source statements retain their IDs, all qualifiers and references, normal and
preferred historical ranks, and revisions or raw-cache hashes and fetch metadata.
Wikidata data is CC0; an import from Wikipedia is identified as an import rather
than an independent bibliographic source. Supplemental observations carry their
own source licenses. The index contains record-specific identity joins; source
identity corrections do not modify geography or the leadership registry.

The normalizer preserves rival same-year observations and undated evidence. It
does not interpolate population, infer capital periods, invent range midpoints,
or turn missing data into zero. Partial-population qualifiers are rejected rather
than misreported as totals; scoped capital assertions are likewise excluded until
their governmental or territorial scope can be represented. Malformed quantities, impossible dates, and temporal
boundaries the profile contract cannot represent are counted in `coverage.json`.
One entity can legitimately have several dated capitals or population estimates.

To refresh: review mappings first, acquire the extract, then rebuild and inspect
the coverage/rejection report. `--check` needs only committed inputs, not the raw
Wikidata cache or network access.
