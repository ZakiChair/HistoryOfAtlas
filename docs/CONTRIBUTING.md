# Contributing

HistoryOfAtlas separates historical evidence, derived data, and interface code. A useful change improves one of them without disguising uncertainty in another.

## Local workflow

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Before submitting a change, run `pnpm check`, a production `pnpm build`, and the relevant Playwright scenarios with `pnpm test:e2e`. Geography changes additionally run `python3 -m unittest discover -s pipeline/geography -p 'test_*.py'`. The browser suite targets static output, so rebuild after editing application code. Commit a focused change with its reason and verification evidence.

## Historical corrections

Every event must have a valid Wikidata QID and explicit source links. Do not write remembered battle dates, coordinates, participants, outcomes, or troop movements into the display dataset. Correct an underlying Wikidata statement or add a cited normalization rule, then rerun the pipeline. An editorial seed is a link to evidence, not a replacement for it.

Include the shared atlas URL, QID or territorial source-record index, current value, proposed correction, and a reliable reference in an error report. Explain whether the issue is a source error, date conversion, location precision, translation, display logic, or a contested interpretation. Consult source discussions before treating a disputed claim as established fact.

Keep different temporal encodings distinct: source BCE year −1 becomes astronomical 0 in signed historical datasets; Wikidata RDF and Wikibase JSON have their own documented conventions. Use `lib/histdate` and add a focused regression test. Never parse ancient dates with JavaScript `Date`.

## Geography

Pinned geography sources, licences, the tiling contract and known source anomalies are documented in [GEOGRAPHY.md](GEOGRAPHY.md). Preserve original source-record indices, licence attribution, and content checksums. A new geometry source needs verified licensing, a reproducible downloader, provenance, source-date convention, and a quality report.

Territory geometries and battles sharing a year do not establish causation. Populate a territorial change's `eventIds` only with an explicit historical citation supporting the relationship. Do not turn a sequence of battle locations into an asserted march route. Preserve source uncertainty and distinguish cultural regions, alliances, vassalage and political entities.

The first and last observations of a polity in a dataset are not automatically its foundation and dissolution. Do not merge Cliopatria polities only because they share a Wikidata QID: source QID reuse is recorded as a limitation.

## Coverage and neutrality

Review the report by era, region and type whenever editing the curated list. Seek independent coverage for Africa, Asia, Oceania, the Americas and early periods. A map's event density describes available documentation; it is not a measure of a population's propensity for violence. Avoid celebratory language about war or conquest. Treat recent and contested claims with explicit attribution.

Participants whose alliances are not sourced remain unassigned. Missing troop counts, casualties, victors, summaries or images remain absent. Do not introduce placeholder historical facts to make a panel appear complete.

## Interface and performance

Provide interface translations for English, French, German, Spanish, Simplified Chinese and Russian; English is the default. Use semantic controls, visible focus, keyboard navigation and reduced-motion preferences. Any chart or map interaction needs an accessible equivalent. Historical uncertainty and source access are product features, not details to hide for visual polish.

Keep large geometry out of client JavaScript and global React state. Use PMTiles and GPU time filters for map geometry; read temporal JSON partitions on demand and run search in its worker. Summaries, images and polity area histories load when needed. Avoid tests that merely repeat implementation details; test date conventions, interval boundaries, URL restoration and actual user journeys.

## Licensing and source distribution

Wikidata data are CC0; Natural Earth is public domain; Cliopatria is CC BY 4.0; Historical Basemaps geometry is GPL-3.0. Wikipedia text and individual Commons images retain their own attribution and reuse conditions. Do not describe the entire mixed dataset as CC0.

When distributing Historical Basemaps tile adaptations, retain `/geo/HISTORICAL-BASEMAPS-LICENSE.txt` and `/geo/historical-source.tar.gz`, which supplies corresponding source and conversion code. Do not commit credentials, `.env` files, raw acquisition caches, browser profiles, or unlicensed imagery.
