# HistoryOfAtlas

[Live atlas](https://historyofatlas.vercel.app) · [Public repository](https://github.com/ZakiChair/HistoryOfAtlas)

An interactive historical atlas of territorial change and documented military events. Move through time to see dated polity geometries, explore sourced events, and inspect what the underlying datasets actually say. The interface defaults to English and also supports French, German, Spanish, Simplified Chinese and Russian. Historical source text uses the selected language when available, with English as the fallback.

The main boundary layer uses Seshat **Cliopatria**: 13,380 dated polity geometry records for 1,583 source-named entities, distributed in 39 temporal PMTiles archives. **Historical Basemaps** supplies 50 independent world snapshots. **Natural Earth** supplies the physical basemap. Events are acquired from **Wikidata**, never reconstructed from model memory.

The published corpus contains **20,037 dated, geolocated events**, 240 editorial QIDs, 40 documented chronological sequences and 10 guided stories. Annual navigation loads temporal event tiles; it does not fetch the all-era archive at startup. See [verification and measured limits](docs/QA.md) before interpreting the performance targets as achieved guarantees.

Open **3D battles** to search the complete ingested battle catalogue, then select a battlefield, play or scrub its illustrative reconstruction, and zoom in to inspect articulated equipment models. Source-backed army and casualty counts use a common disclosed scale; missing counts remain unknown. The [battle coverage report](public/data/battles/coverage.json) accounts for every acquired source candidate, including records without a usable date or location. Model equipment and movements are illustrative, not an exact tactical reconstruction.

The current battle catalogue contains **23,606 records**, of which **16,860** have usable dates and locations. **202** records have comparable opposing-force quantities; **198** of these can be animated on the map. Some comparisons cover documented subsets while other formations remain unquantified. The [readiness audit](data/reports/battle-readiness.json) distinguishes this from complete force, equipment and loss coverage. Individually [reviewed inclusions](docs/battle-inclusions-review-2026-09-21.md) recover sourced engagements omitted by the discovery taxonomy; neither the acquisition count nor this review establishes exhaustive historical coverage.

The map's **Battles** and **Strategic resources** controls independently show or hide each layer. Hiding battles also stops their 3D playback and removes battle, siege and naval markers from event views. Both choices persist in shared URLs. Resources load only when enabled and follow the **selected year or date range**, from documented discovery or the earliest available attestation. Known resources stay visible after closure, including deposits never exploited; discovery and production are shown separately. Production shutdowns remain gaps in the evidence; approximate dates carry **≈**. Each marker opens its dated evidence and coordinate source. The legend counts sites in the chosen period and distinguishes them from total dataset coverage. Coverage is partial, especially for early periods; missing records do not establish absence of exploitation. See the [resource provenance](public/data/resources/README.md) for coverage and source limitations.

Resources use distinct pictograms shared by the map and legend, with adjacent icons for sites with several known resources by the selected period. Groups display their most frequent resource and the number of sites; clicking the icon or count zooms in. Select a resource in the legend to show only its sites and pictograms, or **All resources** to restore the complete layer. The choice survives year changes and layer toggles; legend counts continue to describe all sites in the selected period. These symbols indicate known resource categories, not current extraction, production quantities or remaining reserves.

The **Religions** layer shows dated origins or first attestations, later milestones, schematic diffusion links and approximate regions. Enable or hide the complete layer, filter a tradition, or independently hide routes and regions. The atlas year (or the end of a selected range) controls all three representations. These are cumulative historical attestations, not a map of current believers, religious majorities or exclusive territories. Each milestone explains the documented mechanisms and links to its sources; approximate dates carry **≈**. Selecting a chronology entry moves the map to its place and date. Layer, tradition and display preferences are preserved in shared URLs. Data and rendering code load only on activation. See [religion data and methodology](docs/religions-data.md).

The mineral catalogue combines MinCan, FINEPRINT, the GEM iron tracker, recent national producing-mine registers and reviewed operator/heritage records, including Mali's gold mines, uranium operations and rare-earth sites. All 45 resource categories have representative pictograms and sourced locations. The expanded layer includes non-producing oil/gas discoveries and USGS/ICMM mineral occurrences. Unknown discovery dates use a labelled documentary attestation; operating-register and satellite evidence never invent discovery dates. During playback, the last resource frame remains visible until the updated source is rendered, avoiding the symbol fade restart that previously made icons blink.

## Run

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. Node 22+ is required; CI and Docker use Node 24. The committed `public/` artifacts let the app start without downloading all source datasets again. No proprietary map token or paid API key is needed.

```sh
pnpm check
pnpm build
pnpm preview
```

## Rebuild the evidence

Install Python 3.11+ and tippecanoe 2.17+ (`brew install tippecanoe` on macOS), then run:

```sh
pnpm data:build
```

This downloads cached raw sources into `data/raw`, normalizes dates and records, deduplicates QIDs, scores importance, checks geography and dates, and generates PMTiles, partitioned event/search indexes, per-record detail files, and quality reports. Repeated runs reuse acquisition caches; the geographic inputs are locked to immutable revisions and SHA-256 checksums. Live Wikidata acquisition can take many minutes and respects rate limits. The generated report, not a claimed target, establishes the available event count.

- [Event quality report](public/data/quality.json): actual counts, coverage, rejects, and the 20,000-event acceptance target.
- [Geography manifest](public/geo/manifest.json): dated tile shards, snapshots, source revisions and limitations.
- `pnpm data:build --offline`: rebuild events from an existing raw cache without acquisition.
- `pnpm data:geo`: rebuild the complete geography independently.
- `pnpm data:battles:acquire`: resume all battle candidates, linked places/participants and source-language labels, respecting source rate limits.
- `pnpm data:battles:cdb90 --fetch`: reproduce the reviewed CDB90 import from its pinned, checksummed source snapshot; `--check` verifies it without rewriting artifacts. See [the source review](docs/battle-cdb90-matching-review-2026-09-21.md).
- `pnpm data:battles`: publish the battle catalogue from the local cache and reviewed profiles, independently of the core event tiles.
- `pnpm data:battles:check`: validate every published battle, quantity, source, candidate classification and unchanged original coordinate/date. This requires a complete acquisition report, but no raw cache.
- `pnpm exec tsx pipeline/battles/readiness.ts`: regenerate the evidence and model-selection audit, including hashes of its current inputs.
- `pnpm data:resources`: reproduce the resource snapshot offline from the committed source extracts; [provenance and acquisition](pipeline/resources/README.md).
- `pnpm data:resources:check`: validate resource coordinates, categories, identifiers and source attribution.

After rebuilding the core events, run `pnpm data:battles` to refresh the independent battle catalogue. Core event publication preserves existing battle and resource artifacts. Reproduce the authored GLBs in an isolated Blender process with `blender --background --factory-startup --python scripts/generate-battle-models.py -- --all`; equipment evidence and model constraints are documented in [the unit guide](docs/battle-units.md).

## Application

Next.js App Router, React, strict TypeScript, MapLibre GL JS, PMTiles, deck.gl, Zustand, accessible Radix controls, Tailwind CSS, Framer Motion, a worker-backed search index, Vitest and Playwright. The application can be exported as static files; geometry does not require a tile server.

The temporal map reads only the current territory archive and evaluates source validity intervals through map filters. Event details, polity area histories and Wikipedia summaries load on demand. Historical dates use an astronomical-year module with no JavaScript `Date` parsing. Shareable URLs preserve the selected year, camera, filters and selection.

Source-backed event and conflict pages, methodology, sitemap, robots file, and an Open Graph image are generated at build time. Every event, polity and territorial observation retains provenance. The methodology page explains unequal coverage and the limits of treating an old boundary map as a precise account of sovereignty.

## Tests and deployment

```sh
pnpm check
python3 -m unittest discover -s pipeline/geography -p 'test_*.py'
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:performance
pnpm audit:lighthouse
```

The hardware Lighthouse audit enforces Performance ≥85, Accessibility ≥95 and SEO ≥95 against the production preview using mobile DevTools throttling. Cloud CI runs functional and accessibility checks; the optional `hardware-budgets` job requires a self-hosted runner labelled `atlas-gpu`. These are acceptance thresholds, not a claim that every device or build has achieved them. Frame-rate and initial bundle targets require their own measurements.

```sh
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://your-atlas.example -t historyofatlas:local .
docker run --rm -p 8080:8080 historyofatlas:local
```

Replace the example origin with the real deployment origin. The multistage image serves the static export using Nginx as a non-root user. Its configuration preserves the byte-range requests required by PMTiles. No deployment is performed by the repository's CI.

## Historical and coverage limits

- Cliopatria intervals end in 2024; later views retain the last sourced state with its date. Ancient polygons are approximate.
- Historical Basemaps snapshots are irregularly spaced and end in 2010. They cannot establish every intermediate year's boundaries.
- A battle and a nearby dated territorial change are not automatically causally linked. Connecting documented events does not establish an army's march route.
- Dataset observations do not establish a polity's exact founding or dissolution. Shared Wikidata QIDs do not always mean shared polity identity.
- Wikidata coverage is incomplete and uneven. Rejected and missing records remain visible in reports; they are never replaced with invented coordinates or dates.
- Modern coastlines and rivers are geographical context, not reconstructed ancient physical geography.
- Religious regions are hand-generalized geographic guides, and diffusion arrows connect documented milestones rather than exact itineraries. Surviving evidence and editorial coverage are uneven; a missing stage does not establish absence of a tradition.

## Sources and licences

| Source                                                                              | Licence                                                                                                                                   |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing)                        | CC0                                                                                                                                       |
| [Cliopatria / Seshat](https://github.com/Seshat-Global-History-Databank/cliopatria) | CC BY 4.0                                                                                                                                 |
| [Historical Basemaps](https://github.com/aourednik/historical-basemaps)             | GPL-3.0; licence and complete corresponding source distributed with map adaptations                                                       |
| [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)               | Public domain                                                                                                                             |
| [Wikipedia / Wikimedia](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)  | Applicable CC BY-SA text terms; individual image licences                                                                                 |
| [USGS major mineral deposits](https://mrdata.usgs.gov/major-deposits/)              | Public domain; source metadata declares no use constraints                                                                                |
| [Global Energy Monitor](https://globalenergymonitor.org/creative-commons-license/)  | CC BY 4.0; normalized and filtered public map extracts                                                                                    |
| [SODIR and reviewed historical mining sources](public/data/resources/README.md)     | Norwegian Licence for Open Government Data for SODIR; individual historical evidence and coordinate sources are attributed in each record |

Do not treat this mixed collection as a single CC0 dataset. The application displays attributions and provides direct links to source records.

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [Data pipeline](docs/DATA.md) · [Geography](docs/GEOGRAPHY.md) · [Deployment](docs/DEPLOYMENT.md) · [Contributing](docs/CONTRIBUTING.md)
