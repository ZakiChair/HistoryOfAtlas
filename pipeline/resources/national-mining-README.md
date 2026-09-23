# Current national producing-mine registers

`national-mining-build.py` builds a deterministic contribution from three archived
GeoJSON extracts. The manifest pins their public official URLs, retrieval date,
observation year, record counts and SHA-256 hashes. Rebuild with Python's standard
library; `--check` compares the result without writing.

- **Canada:** Natural Resources Canada's principal producing mines, updated
  February 2026. Only metal/nonmetal records explicitly classified as open-pit,
  underground, solution or borehole extraction are included. Concentrator-only
  sites, exploration projects, smelters and refineries are excluded. Published
  product lists establish categories; a platinum-group entry does not imply
  separate platinum and palladium production.
- **Australia:** Geoscience Australia's December 2025 operating-mine layer.
  Developing and care-and-maintenance layers are excluded. As the latest national
  operating register available at review in September 2026, its last-known status
  is carried into the current view for one year, explicitly approximate. It does
  not verify continuous daily extraction in 2026. Coal and iron use newer dedicated
  GEM trackers. Ambiguous commodity groups and parenthetical possible co-products
  are not expanded into all their constituent metals.

These are status snapshots, not historical opening dates. New sites appear only
in 2026 for Canada, or 2025–2026 for Australia. Existing identities receive only
missing annual/category observations, after dated operator reports have taken
precedence. They retain their previous coordinates and historical periods.

`national-mining-reviews.json` documents explicit identity matches, known stale
statuses and primary-source commodity corrections. Same-country mine names and
consistent geography support identity; proximity alone never merges neighboring
pits. Reviewed tailings/stockpile-only operations and known closures override a
generic operating classification. The source audit retains the original published
product group alongside corrections, so transformations remain inspectable.

Coverage is limited to the registries' scope and publication dates. It is not a
claim of exhaustive worldwide mines, verified current production quantities or
complete interruption histories. Canada is under the Open Government Licence;
Australia under CC BY 4.0. Full attribution and URLs are included in the dataset.
