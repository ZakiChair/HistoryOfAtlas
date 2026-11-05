# Historical context: data, time and representation

The context views connect changes in the political map with documented mechanisms,
source coverage, movement and settlements. Their four datasets are loaded separately
from `public/data/context/` and validated before display. Interface labels support the
atlas's seven languages. Authored historical notices are available in French and
English; the other interfaces explicitly identify English text as a fallback.

## Corpora and provenance

| View                   | Published file  | Inputs and limits                                                                                                                                                                                                                         |
| ---------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transformations        | `changes.json`  | Thirty original editorial notices, each with a year, regional anchor, mechanism, consequence, limits and institutional references. A note does not establish every border movement around its date.                                       |
| Source coverage        | `coverage.json` | The complete Cliopatria polity profiles in `public/geo/polities/*.json`, Historical Basemaps observations in `public/geo/entities.json`, and `public/geo/manifest.json`. Counts refer to this inventory, not all historical states.       |
| Exchange and migration | `networks.json` | Fourteen original notices with source-backed reading periods, editorial geographic anchors, mechanisms and limitations. All lines are schematic; none measures a volume or reconstructs an itinerary.                                     |
| Cities and populations | `cities.json`   | Reviewed identities and published profiles in `public/data/polity-facts/`, the committed Wikidata extract `data/curated/context-cities-source.json`, and geographic reference anchors. City and polity populations are stored separately. |

The transformation and network files are hand-authored, not generated from a timeline
of boundary differences. Their Zod schemas are in `lib/context/changes.ts` and
`lib/context/networks.ts`. Every entry requires at least one HTTPS reference.
Records cannot silently acquire a quantitative `volume` field: the network schema
rejects unknown fields.

## Time filters

All internal dates use astronomical years, as elsewhere in the atlas: year `0` is
1 BCE and `-199` is 200 BCE. The interface formats historical dates through
`lib/histdate.ts`; it does not parse them with JavaScript `Date`.

- **Transformations:** without a selected range, show the ten years before and after
  the chosen year. This is a reading window, not an event's duration. A selected
  range replaces it; endpoints are included.
- **Networks:** a network is in the displayed period when its documented reading
  interval overlaps the selected range, or contains the chosen year. Endpoints are
  included. Selecting a notice does not change the atlas year. The separate locate
  action opens that network's reading period on the map.
- **Coverage:** count distinct source entries and dated observations separately. A
  period the selected source does not date shows a dash, because its counts are unknown
  rather than zero.
  Cliopatria intervals and Historical Basemaps snapshots remain different evidence
  models. Neighbouring snapshots do not create an observation for an intermediate
  year. `summarizeCoverage` requires ordered, inclusive bounds.
- **Cities:** `documentedFactPeriod` accepts a dated observation or a fully bounded
  assertion at day, month or year precision. Missing endpoints, coarse periods and
  approximate dates do not establish annual presence. A dated population value is
  never interpolated, carried forward as a current value, or borrowed from a polity
  and presented as its capital's population.

The list and map use the same selection functions:
`changesInPeriod`, `networksInPeriod`, `coverageFeatureCollection`, and
`visibleCities` / `cityEvidenceInPeriod`. No network is extrapolated beyond its
published reading interval. An empty view means no matching entry in these corpora.

## Reading the network selection

| Network                                         | Reading interval          | Principal reference                                                                                                                                                                                                               |
| ----------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chang'an–Tianshan Silk Roads corridor           | c. 200 BCE–1600           | [UNESCO](https://whc.unesco.org/en/list/1442/)                                                                                                                                                                                    |
| Trans-Saharan gold and salt exchange            | c. 800–1400               | [Metropolitan Museum of Art](https://www.metmuseum.org/essays/the-trans-saharan-gold-trade-7th-14th-century)                                                                                                                      |
| Kilwa and Indian Ocean exchange                 | c. 1201–1600              | [UNESCO](https://whc.unesco.org/en/list/144/)                                                                                                                                                                                     |
| Qhapaq Ñan at its fifteenth-century extent      | c. 1401–1500              | [UNESCO](https://whc.unesco.org/en/list/1459/)                                                                                                                                                                                    |
| Transatlantic forced displacement toward Brazil | 1514–1866 source coverage | [SlaveVoyages contributor guide, p. 7](https://legacy.slavevoyages.org/documents/download/GuideContributors.pdf) and [regional connections](https://legacy.slavevoyages.org/blog/volume-and-direction-trans-atlantic-slave-trade) |
| African American Great Migration toward Chicago | c. 1910–1970              | [Smithsonian NMAAHC](https://www.searchablemuseum.com/the-great-migration/)                                                                                                                                                       |

These bounds are not opening and closure dates for an unchanging route. In particular,
1401–1500 illustrates the Qhapaq Ñan's fifteenth-century expansion without claiming
that its roads ceased to exist afterwards. The Atlantic interval is the coverage of
the cited voyage corpus, not the lifetime of a continuously active single corridor.

Each network declares `geometry: "schematic"`. Each waypoint declares
`basis: "editorial-anchor"`, including locations whose names occur in the references.
The coordinates locate broad places for exploration and the joining segments are
editorial. They are not archaeological road traces, shipping tracks or individual
migration journeys. Rounded regional anchors must not be reused as precise source
coordinates.

`approximate` and `uncertain` describe the dates; they do not make a geometry exact
when false. `temporalBasis` explains the selected window. `direction: "both"` for
exchange indicates reciprocal connections, without equal goods or volumes in both
directions. `direction: "forward"` for migration and forced displacement reads from
the first anchor to the last. `directionNote` explains that convention in each notice.
Forced displacement is named explicitly and kept distinct from voluntary migration.

## Coverage is an inventory

`scripts/build-context-coverage.ts` reads complete source observations. It deliberately
does not use `public/geo/territorial-changes.json`: a change log cannot establish how
many source entries are documented in a year.

An entity is assigned an exploration region using its fixed first source label
anchor and the ordered coordinate rules in `pipeline/normalize/region.ts`. These
rules are broad navigation groupings, not continent polygons, historical regions or
annual territorial extents. The fixed points shown by the coverage view are neither
capitals nor reconstructed settlement locations. Counting observations does not
measure area, political importance, source accuracy or historical completeness.

The generated file retains source URLs and original licence names. It also records
an input hash so `--check` can detect stale output after an input change, even when a
summary count happens to stay the same.

## Cities, capitals and population scopes

The [city evidence method](context-cities.md) documents extraction, exclusions and
validation in more detail.

`scripts/build-context-cities.ts` starts from capital assertions attached to reviewed
polity identities. It takes place coordinates and place-specific population claims
from the committed Wikidata extract. Coordinate alternatives remain accounted for;
a location is a reference point, not a dated reconstruction of an ancient city.
Candidates without valid Earth coordinates are counted as excluded, not positioned
at an invented fallback location.

Capital roles are filtered through both their own dates and their reviewed mapping
to the selected political source. A missing or undated role does not establish that
a place was a capital in the chosen year. Place populations refer to the place's
Wikidata subject and retain source dates and scopes; these scopes may differ from a
modern urban agglomeration. Territory populations remain in a separate collection,
with their subject identity and source bounds. Population intervals, estimates and
uncertainty are preserved rather than converted into a false annual series.

## Rebuild and verification

The builds run offline from committed input extracts; they do not scrape source
websites or acquire new historical claims.

```sh
pnpm data:context
pnpm data:licenses
pnpm data:context:check
pnpm data:resources:check
```

`data:context` rebuilds the derived coverage and city datasets, then validates all four
corpora. It leaves authored transformation and network text unchanged.
`data:context:check` checks byte stability of both generated files, validates all four
schemas, and verifies the current licence manifest. Individual builders accept
`--check`: `scripts/build-context-coverage.ts` and `scripts/build-context-cities.ts`.

Targeted unit tests live under `tests/unit/context-*.test.ts`; the normal `pnpm check`
also typechecks and lints the views. After editing a historical notice, check its
dates, place/region scope, wording of uncertainty and direct reference links, then
regenerate the licence manifest. Schema validation alone cannot verify a historical
interpretation.

## Licences

The original transformation notices, network descriptions and schematic annotations
are project content under [CC BY 4.0](../DATA-LICENSE.md), attributed to HistoryOfAtlas
contributors. Institutional works are cited for verification. Their original prose,
maps and databases are not republished or relicensed by these editorial files.

The derived coverage and city datasets keep their input terms: Cliopatria CC BY 4.0,
Historical Basemaps GPL 3.0, Wikidata CC0, and Seshat population supplements CC BY-SA
4.0 where present. A generated mixed file is not a single CC0 or project-CC-BY dataset.
`public/data/licenses.json` lists the underlying datasets and the separate editorial
references; `/about/#context-sources` renders the latter from that manifest.

## October 2026 additions

The editorial corpus now contains **30 transformations** and **14 networks**.
The additions extend the transformations from 539 BCE to 1991 and add Nabataean
incense exchange, Lübeck–Bergen trade, Manila–Acapulco galleons and indentured labour
from India to Mauritius. The next series adds the Grand Canal, Camino Real, Cherokee forced removal and Suez, alongside new transformation notices and capital evidence. See the [first source review](context-enrichment-2026-10-01.md) and [continued enrichment](context-enrichment-2026-10-01-suite.md).

The Manila–Acapulco connection crosses the antimeridian. Rendering cuts the schematic
line at ±180° into a GeoJSON MultiLineString, following
[RFC 7946 §3.1.9](https://www.rfc-editor.org/rfc/rfc7946#section-3.1.9).
The view centre uses the smallest longitude arc containing the anchors, so locating
this connection opens the Pacific. Neither the cut nor the camera calculates a
historical sailing route. The dated source anchors remain unchanged.
