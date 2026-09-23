# Tabaruzaka: reviewed chronology, battlefield sector and opposing groups

Reviewed 22 September 2026. Event `Q9347968` already exists in the catalogue.

## Accepted changes

The [Japan Tourism Agency](https://www.mlit.go.jp/tagengo-db/en/R2-02042.html) and [Agency for Cultural Affairs](https://kunishitei.bunka.go.jp/heritage/detail/401/00003787) identify the battle as 4–20 March 1877. Change the previous opening date of 3 March to 4 March, preserving the existing end date. The national heritage description identifies the upper Sanno-saka road and present park as a Satsuma position. The tourism agency independently places the museum on the former battlefield.

Use **[130.6516, 32.9127]**, longitude/latitude, as an approximate **park-sector locator**. The [municipal guide](https://kumamoto-guide.jp/en/spots/detail/216) embeds a map query at latitude 32.91268157959, longitude 130.65159606934. Four-decimal rounding records the locator without asserting survey accuracy. The museum is a geographic reference inside an independently attested battlefield, not the sole evidence for a battle position. This point is neither a battlefield centroid nor a regiment position.

Add local military-unit identities for government forces and Satsuma rebels, each with a separate side. Keep all strengths, casualties and deaths unknown. Do not reuse a dissolved Satsuma-domain polity or a twentieth-century Japanese uniform. Symbolic formations therefore have no historical size ratio or loss animation.

## Cartographic cross-checks and rejected shortcuts

- The [municipal archaeological survey, chapter V](https://www.city.kumamoto.jp/kiji00370798/3_70798_503260_up_lu7x8801.pdf), PDF page 1 / printed p.282, figure 142, was visually inspected. It locates excavated slopes beside the upper road and documents ammunition remains; it supplies archaeological support, not the numeric locator.
- The official GSI topographic tile at [z16/x56552/y26416](https://cyberjapandata.gsi.go.jp/xyz/std/16/56552/26416.png) was inspected: the chosen sector adjoins the mapped Seinan War remains. The GSI placename search for 田原坂 instead returns a broader northwest label; it was not adopted as the battle point.
- The heritage page’s map centre **[130.70814722, 32.80323861]** is Kumamoto city hall and was rejected.
- The [2025 survey abstract](https://www.city.kumamoto.jp/kiji00370798/3_70798_503289_up_alta0ab3.pdf), PDF page 1, prints impossible minute values such as 32°91′43″ and 130°65′06″. These were not silently interpreted as decimal digits or used in the correction.
- The replica bullet-damaged storehouse is not assumed to retain its original position. Cemeteries and the much wider Seinan campaign are not substituted for the battle.

Sources cached and inspected under `/tmp/historyofatlas-tabaruzaka/`; that directory is supporting scratch material, not a build input. No external map API key is stored in the catalogue or this review.

## Other location triage in this review

Dug Springs (`Q104856960`), Soldier Spring (`Q111235330`) and Hungry Hill (`Q55316716`) remain unchanged. The reviewed accounts did not provide a sufficiently secure combat point. An expedition’s troop strength, a roadside marker and a rediscovered site without a public precise location were not promoted into battle coordinates or quantities.

## Validation boundary

The metadata patch retains exact before-values; the build must reject changed upstream inputs. Verify the public detail and index agree, the missing-coordinate flag clears, and the UI renders two unquantified groups with no loss figures. The global goal remains incomplete: this review contributes one mapped battle, not a complete historical inventory.
