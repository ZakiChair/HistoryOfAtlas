# Three land-battle location reviews — 22 September 2026

The coordinating agent integrated these reviewed proposals into the curated and rebuilt public catalogue on 22 September 2026: two representative battlefield-sector locations, two date corrections and three unquantified force profiles. The research stage itself changed no live data. Final preservation and browser checks are recorded in the continuation checkpoint.

Baseline catalogue: 23,606 records, 16,854 mappable, 200 quantitatively comparable. Exact copies of the three input records and their SHA-256 hashes are staged in `/tmp/historyofatlas-land-location-next-before.json` and `-before-hashes.json`.

| Record                | Exact published before-values                                           | Proposed after-values                                                                                                                  | Decision                                                                          |
| --------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Tarapacá, Q3357987    | Start 1879-11-26; end absent; coords absent; no participants            | Start 1879-11-27; coordinates still absent; two unquantified local forces                                                              | Correct date; hold geolocation                                                    |
| Ugeumchi, Q4872624    | Start 1894-10-22; end 1894-11-10; coords absent; no participants        | 1894-12-04 through 1894-12-07; `[127.1123, 36.4332]`; three unquantified forces in two camps                                           | Correct calendar and named engagement scope; locate protected battlefield sector  |
| Casa Forte, Q18500027 | Start 1645-08-17; end absent; coords absent; Q45670 and Q617066 present | Date unchanged; `[-34.9201, -8.0358]`; two unquantified local formations replacing the two old entries, with their citations preserved | Locate former engenho / square sector, with limited precision; identify two camps |

Coordinates are longitude, latitude. Four decimal places are rounding of published point references, not a claim of measured positional accuracy. Neither proposed point is presented as a tactical position or the exact centre of all fighting.

## Tarapacá: date corrected, geographic hold

The Biblioteca Nacional de Chile preserves [MC0007387, a contemporary 1879 battle sketch](https://www.memoriachilena.gob.cl/602/w3-article-68006.html). Its [single-page original](https://www.memoriachilena.gob.cl/archivos2/pdfs/MC0007387.pdf) was downloaded, rendered and visually inspected. The title explicitly dates the battle to **27 November 1879**. Its legend distinguishes Chilean and Peruvian troops, and says the depicted positions concern the initial attack.

The drawing has a north arrow and approximate two-kilometre scale but no latitude/longitude grid. It depicts combat along the ravine, settlement and adjacent heights. No reliable modern control-point calibration was established in this bounded review. A town centre, modern cemetery, commemorative monument or OpenStreetMap battlefield label would therefore add unjustified precision. **Keep coordinates absent.**

The optional profile introduces two event-local military forces named for the map’s Chilean and Peruvian formations. It does not count the graphic symbols, infer complete orders of battle, add a coalition contingent or adopt campaign totals. Every strength, death and casualty array remains empty; no equipment identity or profile is assigned.

## Ugeumchi: lunar dates and a published heritage locator

The National Institute of Korean History’s [historical account, section 5](https://contents.history.go.kr/mobile/kc/view.do?levelId=kc_i402520), distinguishes the earlier Gongju fighting from the second engagement conventionally called the Ugeumchi battle, **lunar 8–11 November 1894**. This is the reviewed scope of this record; the earlier October fighting is not included simply because the imported numerical range began in October.

The institute’s documentary chronology prints both calendars directly:

- [Lunar 8 November = Gregorian 4 December](https://db.history.go.kr/modern/level.do?levelId=pry_1894_11_08_0010): attacks begin and defenders fall back toward Ugeumchi.
- [Lunar 9 November = Gregorian 5 December](https://db.history.go.kr/modern/level.do?levelId=pry_1894_11_09_0010): the major attack at Ugeumchi.
- [Lunar 11 November = Gregorian 7 December](https://db.history.go.kr/modern/level.do?levelId=pry_1894_11_11_0010): defeat and withdrawal. This entry also discusses remaining groups withdrawing around lunar 11–12 November; the historical account’s four-day named battle is not extended to every subsequent retreat.

These are published conversions, not dates calculated by the agent. The staged range is **4–7 December 1894 Gregorian**. The old October–November range is retained in the strict metadata precondition and public review provenance after application.

The [Korea Heritage Service record for Ugeumchi Battlefield, Gongju](https://www.heritage.go.kr/heri/cul/culSelectDetail.do?ccbaCpno=1333403870000&pageNo=1_1_2_0) identifies historic site 387, with a designated area of 697,297 m². The downloaded HTML’s location button explicitly calls:

```text
jsCntsForm('공주 우금치 전적', '127.1122867', '36.43321101')
```

Its function passes these values to the official position viewer as `xcnts` and `ycnts`. The proposed rounded location is `[127.1123, 36.4332]`. The [paired heritage description](https://digital.khs.go.kr/heri/heriDetail.do?ctptNo=1333403870000&ctptUid=13898859677466300995) identifies the pass below Gyeonjun Mountain as the actual fighting place. This is a reference point for the designated battlefield sector, not a derived area centroid or a surveyed firing position. The official photograph of the memorial was also inspected; the 1973 memorial alone is not the proof of battlefield location.

The sources identify Donghak forces against Joseon government troops and Japanese troops. The optional profile keeps all three forces distinct, while the latter two share one opposing camp. It does not assign a common nationality or equipment identity to that coalition. Quoted strengths, surviving forces and losses in broader Gongju narratives are not imported. All quantities remain unknown.

## Casa Forte: former engenho sector, not an exact house footprint

The [Brazilian Army’s account of CPOR Recife](https://eblog.eb.mil.br/de/w/centro-de-preparacao-de-oficiais-da-reserva-do-recife-90-anos-de-historia) confirms **17 August 1645**. No date correction is needed.

The [Recife municipal account of 6 June 2012](https://www2.recife.pe.gov.br/node/26901) explicitly places the modern Casa Forte square on the former engenho where the battle occurred. Its complete page was retrieved directly after the local HTTPS client rejected the server’s certificate chain; the public retrieval used no credentials. This statement provides an on-site relationship independent of a commemorative plaque.

The municipal heritage department’s [ZEPH-05 diagnosis](https://conselhodacidade.recife.pe.gov.br/sites/default/files/2020-12/7%C2%AA%20reuni%C3%A3o%20-%202019-02-11%20AP%20DPPC%20DIAGN%C3%93STICO%20ZEPH-05.pdf), PDF page 9, describes the former engenho campina between the church, old casa-grande and road, later remodelled into the park. The rendered page and historical photographs were visually inspected. It does not establish an excavated footprint of the seventeenth-century house.

The [municipality’s coordinate inventory](https://parcerias.recife.pe.gov.br/wp-content/uploads/2023/08/LOCALIZACOES_DOS_PONTOS_DE_INTERESSE_PARA_FINS_DE_MODELAGEM_ECONOMICO__1_.pdf), PDF page 7, lists **PM-07 / PTM-134, Praça de Casa Forte**, at latitude **−8.03581**, longitude **−34.92010**. Page 1 identifies the latitude/longitude columns and explicitly labels this material preliminary and referential. Both pages were rendered and inspected. It is a tourist-point/sign inventory, not an archaeological survey; other entries for the square identify nearby points and are not averaged into an invented centre.

The proposed `[-34.9201, -8.0358]` therefore locates the independently attested former-engenho sector. No numerical error radius, precise assault point, surviving house footprint or claim about the 1934 monument’s presence in 1645 is added.

At the coordinating agent’s request, the optional profile also identifies the two camps already explicitly named by the municipal account: Portuguese and Dutch forces. It uses `Q18500027:portuguese-forces` and `Q18500027:dutch-forces`, both local military formations with unknown quantities. These broad source labels do not assert homogeneous nationality, ethnicity, military branch or government control. They replace the earlier Kingdom of Portugal Q45670 and Dutch West India Company Q617066 entries. **The old participant IDs are replaced, not retained**; their four exact item/P710 citations survive with the corresponding new formations. Both old entries were unquantified. No equipment identity, count or casualty ratio is added.

## Staged artifacts and validation

- `/tmp/historyofatlas-land-location-next-metadata-proposal.json`: strict metadata file, three records, exact before-values.
- `/tmp/historyofatlas-land-location-next-profiles-proposal.json`: three optional participant profiles; no quantities or equipment.
- `/tmp/historyofatlas-land-location-next-validation.json`: **PASS** from real metadata/profile schemas, in-memory application, public record schema and readiness assessment.
- `/tmp/historyofatlas-land-location-next-validate.mts`: reproducible in-memory validator; no rebuild.
- `/tmp/historyofatlas-land-location-next-sources/manifest.json`: downloaded source URLs, hashes and failed retrievals. Local PNGs include the inspected Tarapacá map, Casa Forte coordinate pages 1 and 7, heritage diagnosis page 9 and Ugeumchi photograph.

All old quantities and citations survive. No new numerical observations are introduced. Ugeumchi and Casa Forte become mappable, Tarapacá remains unmapped, and **none becomes quantitatively comparable**. The proposed local forces resolve to the unclassified model; no dated equipment is inferred.

Fundaj’s relevant articles were discoverable but timed out on direct retrieval. They are not required production evidence for this proposal; the directly retrieved municipal description, official coordinate inventory and heritage diagnosis provide the Casa Forte location chain. The coordinating agent also identified an official Donghak foundation article corroborating the lunar conversion; this review does not depend on that additional page because NIKH already prints both calendars explicitly.
