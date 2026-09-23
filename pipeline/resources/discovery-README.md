# Resource discovery and historical visibility

The map shows **known resources**, from their discovery or earliest available
documentary attestation onward. It does not equate a marker with an operating
mine, recoverable reserves or uninterrupted production.

`ResourceSite.knowledge` stores `{fromYear, kind, categories, sourceUrl}` with
optional uncertainty and description. `kind: discovery` requires an explicit
discovery date. `kind: attestation` is a dated documentary bound when discovery
is unknown. Neither a database retrieval date nor a mine opening is relabelled
as a discovery. A site may have `periods: []` if it has dated knowledge evidence.

`resourceKnowledge` compares independent knowledge with the site's exploitation
observations, retaining the earliest evidence **for each resource category**.
An earlier production observation proves the resource was already known, but
remains an approximate attestation rather than a discovery. The selected year's
known categories determine markers, filtering and counts. A date range includes
resources known by its end. Once known, a resource stays visible through closures
and observation gaps. Later co-products are not backdated to the site's first
commodity. Full evidence remains available in the detail panel.

`exploitedResourcesInPeriod` retains the stricter production-only query for
data validation. Production gaps, explicit zero years and closures remain intact.
The detail panel separately states whether exploitation is documented for the
selected year/range. Absence of a production observation is not proof of inactivity.

## Added evidence

- GEM GOGET's original `discovery-year` is retained during acquisition. The
  explicit terminal unit designation supplies the published oil/gas classification.
  For mixed fields the field-level discovery date is approximate for individual
  fuels because separate dates are unavailable. Positive production still comes
  only from production records. Geolocated discovered/developed/closed fields are
  eligible even without output. Country-only positions remain excluded.
- GCMT has no discovery field. Dated opening/production evidence or the 2026
  catalogue provides attestation; a proposed opening never becomes a discovery
  or exploitation date.
- SODIR contributes explicit discovery years and hydrocarbon types for 142 fields
  and 648 discoveries. Official field/included-discovery IDs avoid duplicating
  field components. Existing 128 production identities receive knowledge updates;
  291 additional field/deposit locations have no invented production. Two entries
  lack an explicit hydrocarbon type and are omitted. Coordinates use official
  centroids or an explicitly linked discovery well, marked approximate. Condensate
  is not recategorized as crude oil.
- [USGS/ICMM occurrences](mineral-occurrences-README.md) extend global geological
  coverage through qualified catalogue attestations. They never establish current
  extraction. Exact identity matches retain reviewed positions and production
  histories. Each catalogue's omissions and geographic screens are auditable.
- [BOEM Gulf offshore fields](boem-README.md) add officially dated
  discoveries and knowledge updates to existing GEM identities. Published field
  nicknames distinguish separate discoveries that share an offshore block.
  Positions are approximate official block centroids, not individual wells.
  Oil requires separate crude-oil evidence; condensate never becomes crude oil.
  No production periods are inferred from discovery dates or reserves.

SODIR acquisition URLs and frozen-byte hashes are in
`sources/sodir-known-manifest.json`; `sodir-discoveries-build.py --check` verifies
offline reconstruction. Its three extracts contain the official discovery layer
7000, field layer 7100 and the 49 explicitly linked well positions needed where
centroids are unavailable. `norwegian-discovery-matches.json` records 19 reviewed
GEM identities replaced by the corresponding official discovery/field, including
the Carmen well-identity/position mismatch and the distinct Othello/Othello Sør.

Knowledge imports use `appendResourceKnowledge`, after production reconciliation.
They preserve old period categories, source URLs and coordinates. An older
catalogue cannot lower a site's existing source snapshot year. Missing identities,
invalid categories, future attestations and missing evidence fail validation.

Coverage is as broad as the retained public sources permit, not a complete global
census. In particular, old sources often lack true discovery dates; their sites
appear at an explicitly labelled attestation instead of an invented early date.
