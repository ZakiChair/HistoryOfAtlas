<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Verification

- `pnpm check` — typecheck + vitest + lint.
- `python3 -m unittest discover -s pipeline/religions -p 'test_*.py'` — pipeline unit tests.
- e2e: `PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm exec playwright test <spec> --project=chromium`, against a dev server started with `pnpm exec next dev --port 3001` (port 3000 is often held by `pnpm preview` / `serve out`).
- Data rebuilds: `pnpm data:religions` and `pnpm data:religions:check` (byte-stable); `pnpm data:licenses` then `pnpm data:resources:check` after source changes.
- The epidemic corpus (`public/data/epidemics/history.json`) is hand-authored JSON validated by `EpidemicDatasetSchema` — see `docs/epidemics-data.md`.
