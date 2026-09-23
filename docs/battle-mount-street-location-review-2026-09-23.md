# Mount Street Bridge: location and force identities — 23 September 2026

Q112665883 previously had no coordinates or participants. The reviewed locator is **[-6.2403, 53.3375]**, representing the bridge sector. The existing **26 April 1916** start is retained; no end date is added. Two event-local opposing groups identify Irish Volunteers and British forces. Their strengths, losses and equipment remain unknown.

## Evidence chain

The [National Inventory of Architectural Heritage record 50100535](https://www.buildingsofireland.ie/buildings-search/building/50100535/mckenny-bridge-mount-street-lower-northumberland-road-dublin-2-dublin) identifies McKenny Bridge at Mount Street Lower and Northumberland Road. Its map link leads to heritage app `0c9eb9575b544081b0d296436d8f60f8`, web map `5d0718a7135243fa86852b5662082198`, and the NIAHBuildings layer.

The [official feature query](https://services-eu1.arcgis.com/HyjXgkV6KGMSF3jt/arcgis/rest/services/NIAHBuildings/FeatureServer/0/query?where=REG_NO+%3D+%2750100535%27&outFields=%2A&returnGeometry=true&outSR=4326&f=json) returns exactly one feature, named McKenny Bridge, with `REG_NO=50100535`, `LONGITUDE=-6.24032`, and `LATITUDE=53.337541`. Its geometry, explicitly requested in EPSG:4326, is `[-6.240323698173998, 53.337538505431624]`. Both representations round to the adopted coordinates. The page's projected coordinates are not mistaken for latitude/longitude; no town geocoder or map-camera centre is used.

[Hughes, Campbell and Schreibman (2017), printed p. 3, note 4](https://dspace.mic.ul.ie/bitstreams/426e2923-7f1c-460e-a48b-8f1bac9fef8c/download), explicitly equate Mount Street Bridge with McKenny Bridge. This supplies the historical name link to the geographic record. The bridge is a reference within the engagement area, not a surveyed troop position or a claim that the battle occurred on the bridge alone.

The [Maynooth University overview](https://mountstreet1916.ie/battle-of-mount-st/) supports the retained date and identifies the Irish Volunteers and British forces. Its [building study](https://mountstreet1916.ie/battle-of-mount-st/buildings-used/) establishes a wider area along Northumberland Road and the canal. The separate memorial southwest of the bridge, Huband Bridge, and the Grand Canal Street crossing are not substituted for this point. No battlefield boundary or historical positional error radius is inferred.

## Scope and preservation

The local IDs are `Q112665883:irish-volunteers` and `Q112665883:british-forces`. These do not replace any existing participants, because the previous array was empty. Neither a modern Irish polity nor a uniform British order of battle is inferred. Names are provided in English, French, German, Spanish, Italian and Portuguese.

This is a location and identity review. Source strength estimates, deaths and wounded counts require their own scope reconciliation and are not imported. Existing total and unassigned observations remain empty. The original CC0 Wikidata citation is preserved. The animation uses two explicitly unquantified illustrative groups, with no population scale or inferred losses.

The new metadata entry carries its own `reviewedAt: 2026-09-23`; earlier metadata reviews keep their original dates. Exact before-values guard against silently applying this review to a changed source record.

Eight downloaded responses, including the official map configuration and feature response, are recorded with SHA-256 hashes in `/tmp/historyofatlas-mount-street-sources/manifest.json`. The pre-change record and complete public-file hash inventory are in `/tmp/historyofatlas-resume-baseline/`.

## Verification

The new browser scenario first failed on the genuinely absent coordinates, before data integration (`/tmp/historyofatlas-mount-street-red.log`). It exercises catalogue navigation, the literal location and date, two unknown camps, animation and retained unknown losses on desktop and mobile. Final build and test results are recorded in the continuation checkpoint after integration.
