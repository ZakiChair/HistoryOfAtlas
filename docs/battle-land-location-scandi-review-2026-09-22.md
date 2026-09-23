# Las Piedras, Toverud and Trangen: location review — 22 September 2026

Integrated in the curated and public catalogue before the 23 September continuation. All three representative site points and six unquantified local forces are present. Six desktop/mobile browser checks passed on 23 September, covering catalogue selection, map placement, animation, source visibility and unknown quantities. The following text records the original source review and staging evidence. Exact preconditions come from `/tmp/historyofatlas-prussian-alias-baseline/records.json`, byte-equivalent at the record level to the three public records when staging. All three previously had no participants, no coordinates, and no strength/death/casualty observations at any level.

| Event                | Existing start / end, retained | Proposed `[longitude, latitude]` | Geographic scope                    |
| -------------------- | ------------------------------ | -------------------------------- | ----------------------------------- |
| Q2889112 Las Piedras | 1811-05-18 / 1811-05-18        | `[-56.2014, -34.7260]`           | Parque Artigas battlefield sector   |
| Q4872580 Toverud     | 1808-04-19 / 1808-04-20        | `[11.4878, 59.9182]`             | Toverud farm / Toverudsletta sector |
| Q4872585 Trangen     | 1808-04-25 / absent            | `[12.1368, 60.6534]`             | Named Trangen combat valley         |

## Las Piedras

The national museum registry identifies the open-air museum as occupying the battlefield and explains that its outdoor area covers battle terrain. The independently published heritage resolution identifies Parque Artigas as the historic battle site, parcel 1905, expressly excluding the stadium. This establishes a spatial connection beyond a later commemorative monument. [Ministerio de Educación y Cultura, Área de Museos · Las Piedras battlefield museum, official site map](https://www.museos.gub.uy/index.php/museos/museos-por-localidad/canelones/item/985-museo-a-cielo-abierto-batalla-de-las-piedras); [Uruguay · Resolution 326/013: Las Piedras battlefield, Parque Artigas cadastral parcel 1905, stadium excluded](https://www.impo.com.uy/bases/resoluciones/326-2013/1).

The registry HTML publishes `lat=-34.726049` and `lng=-56.2014445`. Its `google.maps.Marker` uses `position: latlng`. These are the institution's marker coordinates, not a route waypoint or a geocoder-derived town centre. The proposal rounds them to four decimals and describes the park sector. It does not claim a precise troop position, surrender point or centroid of the whole battlefield; no historical accuracy radius is supplied.

The Presidency's published Army address confirms 18 May 1811 and the opposing forces of Artigas and Spanish commander Posadas. Two event-local military groups are proposed, without equating the revolutionary force with modern Uruguay. No counts are imported. [Presidencia de Uruguay · Army commander address: Artigas and Posadas at Las Piedras, 18 May 1811](https://archivo.presidencia.gub.uy/_web/noticias/2009/05/2009051804.htm).

The baseline also contains Q5778779 (3 September 1812) and Q5723232 (1863), distinct Las Piedras engagements. Neither is merged or changed.

## Toverud

The municipality explicitly locates fighting at Toverud farm and on Toverudsletta, and links a map for the 1908 memorial beside that farm. Its heritage inventory independently lists Toverud farm 189/1,2,3 with the memorial. This supports a farm-sector reference, without claiming the monument's spot is an exact 1808 deployment. [Aurskog-Høland kommune · Toverud farm battlefield and official Toverudstøtta map link](https://www.aurskog-holand.kommune.no/innhold/naring-etablering-og-landbruk/turisme/opplevaurskogholand/); [Aurskog-Høland kommune · Cultural heritage plan, part 2, PDF p.29: Toverud farm 189/1,2,3 and memorial](https://www.aurskog-holand.kommune.no/globalassets/bilder-og-dokumenter/politikk-og-planer/kommunale-planer/kommunedelpaner/kommunedelplan-for-kulturminner-og-kulturmiljoer-2007-2015/kulturminneplandel2.pdf).

The municipal short link `https://goo.gl/maps/u7LCZQhEPGDTtpU18` resolves to place-marker fields `!3d59.9182183!4d11.4877597`. The different `@59.9181867,11.4874298` camera centre is not used. Kartverket independently places the named farm nearby at `[11.48952,59.91795]`; its official topographic map was visually checked. The chosen rounded marker remains a representative farm-sector locator. [Kartverket · SSR place 794022, Toverud farm, Aurskog-Høland; official geographic cross-check](https://api.kartverket.no/stedsnavn/v1/sted?stedsnummer=794022&utkoordsys=4258).

**Chronology hold:** the expert encyclopedia gives 19 April; the municipality-published history gives 20 April on printed/PDF p.157, visually inspected. These are discordant day statements, not evidence of a two-day duration. The pre-existing start 19 April / end 20 April is preserved by this location-only proposal, expressly without revalidating its duration. No new end date, reconciliation interval or calendar conversion is invented. [Store norske leksikon · Toverud: date 19 April 1808 and farm engagement](https://snl.no/Toverud); [Aurskog-Høland kommune · Rømskog bygdebok, volume 2, pp.156–157: Norwegian and Swedish forces; date 20 April 1808](https://www.aurskog-holand.kommune.no/globalassets/bilder-og-dokumenter/kultur-idrett-og-fritid/dokumenter/romskog-bygdebok/bind2.pdf).

Norwegian and Swedish event-local forces are attested by the municipal account. Both remain unquantified. Christian August's broader marching force and prisoner figures are not converted into opposing complete battle strengths. No equipment or modern state identities are assigned. Q96373268 Rakkestad (6 August 1814) is a distinct baseline event, not a duplicate of this engagement.

## Trangen

The municipal heritage plan places the 25 April 1808 battle in the valley between Kjellåsen and Butteråsen and identifies the Norwegian and Swedish forces. Its pages 54–56 and schematic were inspected visually. The cemetery at Åsnes church and Sønsterud, where the wounded Dreyer died later, are separate from the battle terrain. Neither supplies the proposed location. [Åsnes kommune · Cultural heritage plan, pp.54–56: Trangen battle, 25 April 1808, valley and opposing forces](https://www.asnes.kommune.no/_f/p1/i932152e9-25c2-4701-b401-60709772c64d/kulturminneplan-asnes-030225-med-innholdsfortegnelse.pdf).

Kartverket SSR place 796072 identifies Trangen as a valley in Åsnes, with published representative point east `12.13681`, north `60.65336`, EUREF89 / EPSG:4258. This actual gazetteer point is used, rounded to four decimals, rather than averaging its geometry or inventing a centre. The inspected official topographic map confirms Trangen between the two named hills. It is a valley-sector anchor, not a calibrated military position; the municipality's schematic is not used as a precision map. [Kartverket · SSR place 796072, Trangen valley, Åsnes; published representative point in EPSG:4258](https://api.kartverket.no/stedsnavn/v1/sted?stedsnummer=796072&utkoordsys=4258); [Kartverket API documentation](https://www.kartverket.no/api-og-data/stedsnavndata/brukarrettleiing-stadnamn-api).

The date is retained as published in the institutional narrative, without calendar conversion. Counts in the account require a separate quantitative review and are not imported here. Two opposing event-local forces are proposed, with no equipment assignment.

## Preservation and validation

No original participant IDs are replaced: all three participant arrays were empty. Six new IDs use the event QID plus `artiguist-forces`, `spanish-royalist-forces`, `norwegian-forces` or `swedish-forces`. They preserve the political and operational distinction of the two sides without asserting uniform troop composition.

All original event sources remain intact, including Wikidata revisions 2515926130, 2296653898 and 2200558709 respectively. Dates, totals and unassigned observations are unchanged. No zero losses or strength observations are fabricated. The coordinate precision is merely display rounding; none of the three sources provides a measured historical positional error.

The targeted in-memory validation used the real metadata/profile schemas, metadata precondition checks, land geometry and readiness resolver. All three patches pass. It confirmed six sourced groups, zero new observations, all old source objects retained, unchanged dates/totals/unassigned, three mappable records and zero comparable opposing forces. Their resolved profile remains `unclassified-unit`. No full build or global test suite was run.

Staging artifacts:

- `/tmp/historyofatlas-land-location-scandi-proposal.json`
- `/tmp/historyofatlas-land-location-scandi-profiles.json`
- `/tmp/historyofatlas-land-location-scandi-before.json`
- `/tmp/historyofatlas-land-location-scandi-validation.json`
- `/tmp/historyofatlas-land-location-scandi-source-manifest.json`

The source manifest records exact URLs, cached bytes and SHA-256 hashes, baseline hash, inspected images and failed leads. Source copies and derived page renders are in `/tmp/historyofatlas-land-location-scandi-sources/`. The Toverud date discrepancy remains an explicit hold; no location proposal depends on resolving it.
