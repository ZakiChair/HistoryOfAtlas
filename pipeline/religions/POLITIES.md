# Dominant religion per Cliopatria polity

`python3 pipeline/religions/polities.py` rebuilds `public/data/religions/polities.json` and the audit report `data/reports/religion-polities.json` offline, from the committed extract `data/curated/religion-polities-source.json` and the curated `religion-polities-mapping.json` / `religion-polities-supplement.json`. `--check` compares both generated files without writing. `python3 -m unittest discover -s pipeline/religions -p test_polities.py` covers entity identity, intervals, precedence, conflicts, secular states and fail-fast cases.

## Inputs

- `data/raw/religions/seshat-widespread-page1..13.json` — the 1,206-record Seshat _Widespread Religion_ API snapshot (see `SESHAT.md` for acquisition); the order-1 record is the most widespread religion.
- `data/raw/geography/cliopatria.geojson.zip` — pinned commit `ad28a691b7c07c1fca89d0e0636d324667d2a258`; `POLITY` records give the entity name, `Wikidata` QID, `SeshatID` (possibly `;`-separated) and `Area`.
- `data/raw/wikidata/entities-*.json` — entity dumps; P140 statements are reduced to `{item, rank, start, end}` (P580/P582 qualifiers, astronomical years).
- `data/raw/religions/wikidata-religion-items.json` — EN/FR labels of the P140 items, copied into the extract so the offline build never needs it.

## Reacquisition

`python3 pipeline/religions/polities.py --acquire` rebuilds the extract and aborts if the Seshat snapshot is no longer exactly 1,206 records. The extract keeps entity records (id = `clio-` + sha256 of the normalized name, like `pipeline/geography/build.py`), reduced Seshat rows, P140 statements, item labels and sha256 of every raw input.

## Reading grid

`data/curated/religion-polities-mapping.json` groups source labels into atlas families (`null` = unusable label), maps Seshat prevalence codes to graded evidence and lists skipped order-1 codes, generic Wikidata items, Wikidata→family matches and per-source notes. `families[].minYear` and `wikidataItemMinYear` clip every P140 statement so a denomination never paints before it existed; `minYear` is also the reason a Seshat-less year stays neutral. Build-time rules beyond the mapping: undated Seshat order-1 codes cover the polity's lifetime, a gap of ≤10 years between two same-family Seshat spans is bridged (weaker evidence, noted), supplement spans marked `priority: "fallback"` only fill Seshat-uncovered years, and a ≤2-year Wikidata sliver between spans of other bases is dropped. The `wikidata` list on each polity keeps every usable P140 statement for display. An unmapped Seshat religion name or Wikidata item **fails the build** — extend the mapping rather than letting a label through silently. The editorial supplement overrides both sources for its subjects; its spans never extend beyond the entity's observed Cliopatria lifetime. A supplement subject carrying `exclude: {fr, en}` instead of spans is emitted with `spans: []` and the bilingual `excluded` reason — it gets no fill whatever Seshat or Wikidata say (multi-continental colonial aggregates).

## Report

`data/reports/religion-polities.json` records span counts by basis and evidence, Seshat `conflicts`, `wikidataAmbiguous` choices, `secular` states, `supplementOverrides`, the (must stay empty) unmapped lists and a `coverageByYear` table of attributed entities and drawn area per evidence.
