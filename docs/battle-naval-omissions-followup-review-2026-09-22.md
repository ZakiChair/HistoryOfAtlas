# Naval omission follow-up: Coquimbo, Niihau and the Kettle War

Reviewed 22 September 2026 against the **23,605-record** published battle catalogue. One individually justified inclusion, its coordinate withdrawal and two unquantified groups were subsequently integrated and rebuilt by the coordinating agent; two items remain on hold. The original evidence review changed no live data. Production validation is recorded in the continuation checkpoint.

| Candidate                                | Decision                                                                     | Date and location                              |
| ---------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| Q51103517, Combate aeronaval de Coquimbo | Include with companion coordinate withdrawal and two unquantified groups     | Retain 6 September 1931; remove the city point |
| Q5975578, Niihau Incident                | Hold outside the reviewed naval-engagement scope                             | No changes to the unpublished candidate        |
| Q1406399, Kettle War                     | Hold because the item combines an individual incident with a longer conflict | No changes to the unpublished candidate        |

## Coquimbo: a distinct air attack, without an invented naval position

The [Museo Histórico Gabriel González Videla article](https://www.museohistoricolaserena.gob.cl/noticias/historia-de-acorazados-y-aviones), read directly and downloaded, reproduces eyewitness accounts of aircraft attacking mutinous ships in Coquimbo Bay. Its [museum-hosted book extract](https://www.museohistoricolaserena.gob.cl/sites/www.museohistoricolaserena.gob.cl/files/images/articles-96988_archivo_01.pdf), PDF page 22 / printed page 171, was rendered and visually inspected. It explicitly identifies **Sunday 6 September**, describes the ships returning to the bay, and separates the encounter from operations at Talcahuano. The short article's “Saturday” is a weekday error; the numbered date agrees with the book and cached event.

The proposal distinguishes **government aircraft** (`air`) from the **mutinous squadron** (`naval`). Both are local military groups with separate camps and empty strength, death and casualty arrays. No equipment or polity identity is inferred. The book gives 22 aircraft, whereas the indexed Revista de Marina account gives 21; damage descriptions also differ. No single estimate, false zero, whole-mutiny fleet count or aircraft-to-ship ratio is adopted. The photograph reproduced on the museum web page is explicitly described as retouched and is not geographic evidence.

The actual resolver selects `[-71.338,-29.9532]` from linked **Coquimbo municipality Q3871**, because the event has no P625. The companion metadata patch removes that point, its provenance and the coordinate-derived region and restores `missing-coordinates`. The date and existing observations are retained. No chart establishing ship positions was found; the bay centre, present port, observer's viewpoint and museum address are not substitutes. Geographic precision remains unresolved, and the fiche should have neither a map marker nor an animation.

The proposed exact before-values are:

```json
{
  "start": { "year": 1931, "month": 9, "day": 6 },
  "end": null,
  "coords": [-71.338, -29.9532]
}
```

The existing **Q5722370, Battle of Coquimbo**, is a different homonym. Its [linked Spanish article](https://es.wikipedia.org/w/index.php?title=Batalla_de_Coquimbo&oldid=170018794) explicitly identifies that QID with the Uruguayan action in 1863. Independently, the [Río Negro departmental government's centenary publication](https://www.rionegro.gub.uy/wp-content/uploads/Rio-Negro-Centenario-FB-Version-Resumida.pdf), PDF page 18, visually inspected, records Flores defeating Olid at Coquimbo on 2 June during that year's campaign. The existing record remains untouched. A catalogue search found no other Coquimbo air-action record; parent mutiny Q4121073 is not published as a battle. The new inclusion covers the individual encounter, not the whole mutiny.

## Niihau: real armed violence, not a demonstrated naval battle

The [National Park Service's account](https://www.nps.gov/perl/learn/historyculture/civilian-casualties.htm) and [Hawaii Department of Transportation aviation history](https://aviation.hawaii.gov/world-war-ii/december-7-1941/), both read directly and downloaded, describe a damaged Japanese pilot's landing, detention, subsequent hostage-taking and lethal struggle with island civilians. The Army relief party arrived after the pilot had died. The rescue tender's transport role does not make it a ship engaged in combat there.

These official retrospective narratives establish that the episode happened. They do not establish opposing fleets or military formations fighting a naval engagement at Niihau. The source label and broad Q876274 class cannot supply that missing evidence. No residents are converted into a military unit, no crash is counted as a ship loss, and no island coordinate is newly endorsed. This hold is about the catalogue's reviewed engagement scope, not a claim that the incident was fictional. Existing Pearl Harbor Q52418 is related background, not an asserted duplicate of the later civilian struggle. No inclusion, metadata or quantitative patch is proposed for Niihau.

## Kettle War: the armed incident and the prolonged dispute need separate scope

The Rijksmuseum catalogue of [contemporary print RP-P-OB-85.344](https://www.rijksmuseum.nl/nl/collectie/object/Voorval-met-de-keizerlijke-brik-op-de-Schelde-1784--7f8a6f056992409a5982e05b8983d136), directly read and downloaded, identifies the encounter between **Louis** and **Dolphijn** on **8 October 1784**, with a Dutch warning shot. Another [museum record of a treaty satire](https://www.rijksmuseum.nl/nl/collectie/object/Spotprent-op-het-Verdrag-van-Fontainebleau-1785--6fa90cee3a743eb64f5011dfb3bcf7fc) identifies the settlement ending the dispute on **8 November 1785**. These are institutional descriptions of primary historical prints, not a claim that the illustrated scene supplies measured ship positions.

The [Militaire Spectator account](https://militairespectator.nl/artikelen/de-scheldekwestie-revisited), read directly, additionally distinguishes the October interception near Saeftinghe from the November seizure of another vessel and the later treaty. The cached item has P585 `1784-10-08` **and** P580 `1784-10-06` / P582 `1785-11-08`. The builder would prefer that prolonged interval. Simply declaring it an eligible individual battle would therefore carry the entire diplomatic conflict into the battle catalogue. Silently shortening it would redefine the item's scope.

Hold pending an explicit incident-versus-conflict identity decision. No existing catalogue record with the same name or encounter was found, so this is not presented as a proven duplicate. No reciprocal fleet battle, one-versus-three ratio, zero losses or Scheldt river point is inferred. The name “war” alone is not the reason for the hold: the conflicting event scope is independently evidenced.

## Cached taxonomy, retrieval limits and validation

The actual merged entity loader finds these revisions in `entities-all-languages-02584c946520a6569c48.json`: Coquimbo **1372376673**, Niihau **2440505264**, Kettle War **2419668713**. Each direct P31 set is exactly `[Q876274]`; the cached taxonomy supplies no engagement root for that class. No blanket promotion is proposed. Live Wikidata attempts failed, so these are explicitly the current **cached** snapshots, not claimed live revisions.

Firecrawl CLI was unavailable. Web reading and direct HTTP downloads supplied the retained evidence. The FACH commander's biography and Revista de Marina article corroborated the action in search results, but direct FACH retrieval failed and Revista downloads returned HTTP 403. The latter PDF could not be visually inspected; neither is a production quantitative source in this proposal. The museum-hosted chapter and Río Negro PDF were successfully downloaded and their relevant pages visually inspected. Source hashes and retrieval limitations are recorded separately.

The staged bundle is:

- `/tmp/historyofatlas-next-naval-inclusions-proposal.json`: Coquimbo only.
- `/tmp/historyofatlas-next-naval-metadata-proposal.json`: mandatory Coquimbo coordinate withdrawal.
- `/tmp/historyofatlas-next-naval-profiles-proposal.json`: two unquantified Coquimbo groups, with distinct media and camps.
- `/tmp/historyofatlas-next-naval-review-audit.json`: decisions, evidence paths/hashes and limits.
- `/tmp/historyofatlas-next-naval-validation.json`: **PASS** from in-memory production normalization, taxonomy-aware inclusion guard, proposal/public schemas, exact metadata preconditions and inclusion-provenance verification.

The validation preserved dates and existing totals/unassigned observations, added no numbers or equipment identity, verified the absence of coordinates/provenance/region, and found `hasComparableOpposingForces` false. Hashes of discovery, taxonomy, index and the three relevant curated files remained unchanged during validation. No build or global tests ran. Integrate the inclusion, withdrawal and participant proposal together; changed before-values must trigger a new review.
