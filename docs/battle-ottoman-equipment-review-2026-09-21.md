# Ottoman equipment source review — 21 September 2026

Decision: author `ottoman-ww1-infantry`, dated **1915–1918**, automatic representative analogy for land formations whose participant is the historical Ottoman Empire **Q12560**. A military-unit ID may use it only through an explicit assignment plus independently sourced `equipmentIdentity.polityId`. Modern Turkey Q43, Ottoman-named unknowns, geographical labels, and an arbitrary date alone do not establish this identity. All other dates remain outside this family's eligibility.

## Source dossier and visual inspection

- [Australian War Memorial, RELAWM00308.001 / C2089020](https://www.awm.gov.au/collection/C2089020): surviving Turkish-contract Mauser Model 1893, captured at Gallipoli 1915, described as one of the standard WWI types and common there. Front image `3833937.JPG` inspected: long wood stock, bolt action, barrel bands and cleaning rod. The weapon supports the infantry equipment family; it does not establish the proportion of Mausers in any army. No universal exact-model assertion.
- [AWM, REL/01813 / C104719](https://www.awm.gov.au/collection/C104719): coarse khaki serge cap, circa 1914–1918, collected by the War Records Section in Palestine in 1918. Artifact images `4182899.JPG` and `6052750.JPG` inspected. Crown sewn longitudinally; folded tails cross and form nape flaps. Attribution to Enver Pasha is tentative in the museum catalogue, so no certain designer attribution in model label.
- [AWM A02598](https://www.awm.gov.au/collection/A02598): c. 1915 photograph of the Ottoman 125th Infantry Regiment in trenches, copied from Kannengiesser's account. Image `4149522.JPG` inspected. Different hats and field coats coexist. Seated men show buttoned tunic/coat silhouettes, boots or puttees and ammunition equipment. Used for a representative component, not copied as a complete uniform specification.
- [AWM C00636](https://www.awm.gov.au/collection/C00636): August 1915 Gallipoli prisoners. Image `6040920.JPG` inspected. Clear puttees and diverse shirts/caps reinforce the limits of a uniform reconstruction. Captured men are not assumed to retain every equipment item they carried during combat.
- [AWM P04411.084 / C1068491](https://www.awm.gov.au/collection/C1068491): c. 1915 infantry-regiment march, image inspected. Band uniforms and greatcoats are visible; no band-specific details were generalized to infantry.
- [AWM Battles of Gaza](https://www.awm.gov.au/collection/E84346): establishes the Ottoman defensive force in the 1917 battles. Only equipment context is used. Its account and any numbers are not substituted for the CDB90 numerical record.

1915 is the lower bound because the inspected photographs directly date the infantry component to that year; the cap's broad catalogue date is not used to extend the full silhouette into 1914. Palestine 1918 collection provenance and the museum's WWI weapon-service description support the upper bound. This is a conservative editorial family window, not evidence that all soldiers changed dress together at either boundary.

## Geometry and limitations

Author-original GLB: cloth crown with seam and folded tails, plain field tunic, cloth puttees, low boots and modest pouches. Pouch proportions and material colours are schematic. No badge, officer-specific decoration, ethnicity or national colour is inferred. A full-stock Mauser-style rifle has an independent straight bolt/receiver, internal magazine floorplate, barrel bands and cleaning rod. It is geometrically distinct from the Martini-Henry's falling block/underlever and lacks that asset's fixed socket bayonet. No unsupported later steel helmet. No universal warm-weather uniform claim, exact regiment, artillery/cavalry/irregular reconstruction, troop ratio or automatic winter clothing.

Asset: 406,192 bytes, 11,662 triangles, 15 meshes, 32 nodes, March/Engage clips. Catalogue: 56 GLBs, 18,628,960 bytes. Per-asset 500 KB cap; 19 MB catalogue cap accommodates lazy profile loading without stripping prior geometry. Studio preview and the weapon/headgear geometry were inspected before browser verification.

## Measured coverage

Mapped-record baseline: readiness report 2026-09-21T19:16:24.722Z, 134 retained CDB profiles. Actual renderer resolution found 630 mapped unknown Q12560 land formations; 92 fall in 1915–1918. The six 1914 cases remain excluded despite increasing a 1914–1918 rule's nominal total to 98. All 92 current records were resolved through actual `buildBattleSimulation`, `resolveUnitProfile` and `assessBattleReadiness` after the new model registration, without regenerating public data.

| Before → after equipment state | Events |
| --- | ---: |
| Unknown → partial | 27 |
| Unknown → complete | 20 |
| Partial → complete | 37 |
| Partial → partial, one more classified formation | 8 |

This improves 92 formations in 92 events, leaving 538 of the 630 original Q12560 unknowns outside the new window. Complete here refers to the displayed formations only; single-sided events may be equipment-complete without any known adversary or quantities. No newly quantified battles are claimed.

Only one of seven CDB Ottoman gaps benefits: Second Gaza Q388581, whose `TK ARMY OF PALESTINE` source aggregate and numerical estimates stay unchanged. Saint Gotthard 1664, Vienna 1683, Zenta 1697, Petrovaradin 1716, Mount Tabor 1799 and Kumanovo 1912 remain unresolved. The equipment crosswalk contains an explicit patch for Q388581. The other gains come from the representative identity/date rule.

The review resolved all 92 events through the actual simulation and equipment resolver. Applying the Gaza patch preserved participant identity, camp, strengths, deaths and casualties.

## Alternatives kept open

An earlier Janissary/miquelet family would potentially touch 42 unknown Ottoman events in 1683–1718; no adequately bounded common full-body dress source was established in this review. An eighteenth-century gun alone cannot date a universal Janissary uniform. Existing Ottoman 1618 Azeb equipment was left untouched. The French First Republic Q58296 has 80 unknown formations in 1792–1803 and merits a separate bicorne review; it has fewer candidate events than the 92 current Ottoman window, and no new automatic French rule is proposed here.

Tests: 28 targeted tests passed after the two new Ottoman tests first failed for the missing profile/model. New checks cover period, polity, medium, explicit local-unit identity, cap/rifle bounds and forward recoil; existing complete GLB contracts run across the catalogue. Typecheck, targeted lint and Python syntax checks also passed. Browser verification is recorded in the implementation checkpoint.

## Published-catalogue measurement

After merging the new CDB profiles and rebuilding, the Ottoman profile resolves in 98 dated records: 92 mapped and six without a usable location. These are all within 1915–1918; the six additional records do not extend the window into 1914. The model changes 63 records to complete equipment, including 57 mapped records. Equipment completeness describes the depicted representative components, not a complete historical order of battle.

Four Playwright scenarios passed using the software GPU (Gaza and Lone Pine, desktop/mobile, 34.2 seconds). Model download, animation progress and absence of page errors were verified. Screenshots showed intact geometry; close inspection of cap/rifle details uses the separate studio view and the higher-zoom manual browser check.
