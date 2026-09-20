# Atlas Belli

[Live atlas](https://atlas-belli.vercel.app) · [Public repository](https://github.com/ZakiChair/atlas-belli)

An interactive historical atlas of territorial change and documented military events. Move through time to see dated polity geometries, explore sourced events, and inspect what the underlying datasets actually say. The interface defaults to French, with English available.

The main boundary layer uses Seshat **Cliopatria**: 13,380 dated polity geometry records for 1,583 source-named entities, distributed in 39 temporal PMTiles archives. **Historical Basemaps** supplies 50 independent world snapshots. **Natural Earth** supplies the physical basemap. Events are acquired from **Wikidata**, never reconstructed from model memory.

The published corpus contains **20,037 dated, geolocated events**, 240 editorial QIDs, 40 documented chronological sequences and 10 guided stories. Annual navigation loads temporal event tiles; it does not fetch the all-era archive at startup. See [verification and measured limits](docs/QA.md) before interpreting the performance targets as achieved guarantees.

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
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://your-atlas.example -t atlas-belli:local .
docker run --rm -p 8080:8080 atlas-belli:local
```

Replace the example origin with the real deployment origin. The multistage image serves the static export using Nginx as a non-root user. Its configuration preserves the byte-range requests required by PMTiles. No deployment is performed by the repository's CI.

## Historical and coverage limits

- Cliopatria intervals end in 2024; later views retain the last sourced state with its date. Ancient polygons are approximate.
- Historical Basemaps snapshots are irregularly spaced and end in 2010. They cannot establish every intermediate year's boundaries.
- A battle and a nearby dated territorial change are not automatically causally linked. Connecting documented events does not establish an army's march route.
- Dataset observations do not establish a polity's exact founding or dissolution. Shared Wikidata QIDs do not always mean shared polity identity.
- Wikidata coverage is incomplete and uneven. Rejected and missing records remain visible in reports; they are never replaced with invented coordinates or dates.
- Modern coastlines and rivers are geographical context, not reconstructed ancient physical geography.

## Sources and licences

| Source                                                                              | Licence                                                                             |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing)                        | CC0                                                                                 |
| [Cliopatria / Seshat](https://github.com/Seshat-Global-History-Databank/cliopatria) | CC BY 4.0                                                                           |
| [Historical Basemaps](https://github.com/aourednik/historical-basemaps)             | GPL-3.0; licence and complete corresponding source distributed with map adaptations |
| [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)               | Public domain                                                                       |
| [Wikipedia / Wikimedia](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)  | Applicable CC BY-SA text terms; individual image licences                           |

Do not treat this mixed collection as a single CC0 dataset. The application displays attributions and provides direct links to source records.

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [Data pipeline](docs/DATA.md) · [Geography](docs/GEOGRAPHY.md) · [Deployment](docs/DEPLOYMENT.md) · [Contributing](docs/CONTRIBUTING.md)
