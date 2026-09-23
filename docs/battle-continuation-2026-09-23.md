# Battle map continuation — 23 September 2026

The historical coverage work remains incomplete. This continuation recovers the interrupted integration state, adds one mappable battle, and corrects one misplaced battle. Existing uncommitted work is preserved; no commit or deployment was performed.

## Changes

- [Mount Street Bridge, Q112665883](battle-mount-street-location-review-2026-09-23.md): added the sourced bridge-sector locator `[-6.2403,53.3375]` and two unquantified local forces. The 26 April 1916 start, absent end and empty quantitative observations remain unchanged. Names cover the six interface languages; equipment and losses remain unknown.
- [Spicheren, Q699238](battle-spicheren-location-review-2026-09-23.md): replaced the inherited point near Gravelotte with the published Hauteurs-sector locator `[6.9666,49.2043]`, approximately 69.31 km away. Dates, complete participant objects, equipment and quantities are unchanged. The original core event corpus remains intact; the correction is recorded in reviewed battle metadata.
- Metadata entries can now carry an optional, calendar-valid ISO `reviewedAt`. The builder and checker use it in preference to the file default. The two new reviews are dated 23 September; the previous 38 reviews retain 22 September. The change was tested failing before implementation.
- Confirmed that Entzheim, Prague, the four Prussian equipment assignments, and the Las Piedras/Toverud/Trangen locations were already integrated. Corrected stale staging statements and current README counts, and added browser coverage for the recovered locations.
- [Ichi, Q12612946](battle-ichi-location-review-2026-09-23.md), remains without coordinates: a directly relevant study disputes the relationship of the heritage markers to the actual battlefield. Kjölberg remains a research lead; its memorial point was not accepted as the historic crossing without further evidence.

## Current coverage

The catalogue contains **23,606 records**, **16,860 mappable** and **6,746 without a usable date or location**. It has **222 participant reviews**, **202 comparable opposing-force records** (198 mappable), **40 metadata reviews** and **9 reviewed inclusions**. The CDB registry remains 231 reviewed / 167 imported / 53 held / 11 existing manual profiles. No acquired candidate is missing.

The readiness audit reports 77 full-evidence cases, with whole-model losses in every camp for 56 desktop / 55 mobile cases. These are evidence and rendering categories, not claims of exhaustive history or accurate tactical reconstruction. The library remains at 65 GLBs, with all 60 referenced model files present.

## Verification and preservation

- Final `pnpm check`: TypeScript and **415 unit tests pass**; ESLint has no errors and the pre-existing `.remember/tmp/last-ndc.ts` warning.
- **26 Python tests**, pinned CDB importer `--check`, catalogue integrity, production build and diff whitespace checks pass.
- **40 targeted browser executions pass** across desktop/mobile and native/software rendering for recovered locations, Prussian equipment, Entzheim and Prague. After the final Spicheren correction, **16 further targeted executions pass** for its literal corrected position, both equipment families, quantities and final losses. This is not a rerun of the entire browser suite.
- The Mount Street and Spicheren location tests both failed on their old coordinates before the corresponding data change. Native and software reports are in `test-results/resume-final-{native,software}-report` and `test-results/spicheren-final-{native,software}-report`, with matching artifact directories.
- **23,604 other public event JSON files and all 65 GLBs are byte-identical** to the start-of-turn snapshot. Only the two reviewed events and four catalogue aggregates changed. Existing curated records and original citations are preserved. Independent source and preservation reviews found no material defect.
- All **23,610 exported battle JSON files**, **65 GLBs and model manifest** match their public inputs byte for byte. All fifteen readiness input hashes match. Readiness corpus SHA-256: `156e700388a05f3107526dc706972ff731ab0289c0abbc4028c507ef75fa758d`.

Preservation evidence: `/tmp/historyofatlas-resume-baseline/`, `/tmp/historyofatlas-resume-preservation.json`, `/tmp/historyofatlas-resume-export-audit.json`. Source downloads and manifests are linked from the individual reviews. Full check/build/browser logs use `/tmp/historyofatlas-resume-*` and `/tmp/historyofatlas-spicheren-*`.

Local production preview is available at `http://localhost:3000`. Browser connector surfaces were unavailable for a separate manual French inspection; Playwright verified the actual graphics and controls. Continue with bounded source-backed location and equipment reviews. Missing data is not permission to invent coordinates, strengths or losses.
