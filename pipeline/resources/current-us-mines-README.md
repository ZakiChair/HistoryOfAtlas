# Current US mines: qualified USGS snapshot

`python3 pipeline/resources/current-us-mines-build.py` rebuilds the contribution
from the frozen row extract and reviewed coordinate matches. It does not write
the public application dataset.

The official USGS release is [P1BUPUAM](https://doi.org/10.5066/P1BUPUAM), published
29 June 2026. Its metadata states ground-condition dates from 4 December 2024 to
30 April 2026. The official workbook was unavailable during acquisition. The
public [Rovjok mirror](https://us-facilities.rovjok.com/) identifies the same DOI,
release version and original spreadsheet rows. The frozen manifest records that
attribution and the limitation: workbook bytes were not independently compared.

Only `Mines and Quarries` with `Assumed active` status are eligible. This is a
qualified register snapshot, not measured 2026 production. Every published period
is 2026–2026, marked approximate and described explicitly in French and English.
Processing-only facilities, unsupported commodities and unresolved locations are
omitted. Primary evidence of suspension or future restart overrides the register.
The omission audit records the reason for all 129 excluded facilities.

USGS does not provide coordinates in these rows. The review file joins unique
normalized **primary mine names**, requiring coordinates within the USGS state.
It uses existing FINEPRINT/GEM positions or the ICMM location catalogue. ICMM is
never used as operating-status or commodity evidence. Four additional iron-mine
matches were reviewed with their company prefixes removed and positions agreeing
within 1 km. Group aliases and nearest-neighbour-only matches are not accepted.
Each coordinate keeps its source URL and matching rule.

The result covers 50 sites: 31 append-only observations for existing sites in
`observationGroups`, plus 19 additional locations in `sites`. The
`audit.matchedSiteId` and `mode: observations` fields retain the matching history;
preserve all prior periods and do not bridge earlier gaps.
Meikle is named separately by USGS inside the wider Goldstrike complex; no
automatic merge of its periods into the whole complex is made here.

Lost Creek, Shirley Basin and Alta Mesa were handed to the separate uranium
curation with operator reports proving actual 2026 activity and technical-report
coordinates. They are not duplicated in this contribution. Neither future
Nichols Ranch restart plans nor prospective Rosita wellfields count as production.
