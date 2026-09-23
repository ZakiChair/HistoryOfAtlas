# Quantified CDB90 equipment review, 1600–1815

Merged into `data/curated/battle-equipment.json` after validation: 31 retained battles, 34 explicit participant assignments. The review itself changed no quantities or camps. Identities, aggregate coalitions, camps, strengths, deaths and casualty categories are preserved.

The actual resolver/simulation validation is `/tmp/historyofatlas-validate-cdb90-early.mts`; its complete per-event result is `/tmp/historyofatlas-cdb90-equipment-early-validation.json`. Against the current public records, equipment categories among these 31 battles change from 23 unknown + 8 partial to 20 partial + 11 classified. “Classified” means every depicted side has a supported representative equipment component, not that the complete historical composition is known. All 34 explicit choices resolved to the requested date-compatible profile, with their actual participant present in the simulation. Source-independent record fields and all quantitative evidence compare equal before/after.

## Source basis

- **Commonwealth, 1650–1651 (two forces):** the [National Army Museum’s pikeman armour](https://collection.nam.ac.uk/detail.php?acc=1996-07-279-3) and [Civil Wars narrative](https://www.nam.ac.uk/explore/british-civil-wars) support a pike component for Cromwell’s forces at Dunbar and Worcester. Scottish opponents remain unassigned.
- **Prussia, 1756–1760 (nine named Prussian forces, plus Hastenbeck’s documented Prussian component):** the [American Revolution Institute’s surviving Model 1740 infantry musket](https://www.americanrevolutioninstitute.org/discover-the-collections/armaments/) supplies the weapon family. The [primary Prussian infantry regulation of 1750, ETH Library Rar7447](https://doi.org/10.3931/e-rara-29111), printed p.501, distinguishes grenadier caps from turned-up hats and describes gaiters and equipment. The original page image was inspected, not merely its OCR: `/tmp/historyofatlas-prussian-reglement1750-p501.jpg`. The model represents the hat-wearing musket component, without exact regimental dress. Earlier 1741–1745 Prussian battles were deliberately left out of this bounded review because the inspected dress prescription is later.
- **Continental flintlocks, 1745–1759:** [NAM’s Seven Years War account](https://www.nam.ac.uk/explore/seven-years-war) identifies the French armies at Hastenbeck, Krefeld and Minden, and the British/Hanoverian infantry component at Minden. At Hastenbeck, CDB90’s `BR ARMY` label is retained, but NAM explicitly describes Hessian, Prussian and Hanoverian troops: only the attested Prussian equipment component is illustrated. Krefeld’s allied force remains unassigned. [NAM’s Fontenoy object context](https://collection.nam.ac.uk/detail.php?acc=1963-10-253-1) and [13th Regiment history](https://www.nam.ac.uk/explore/somerset-light-infantry-prince-alberts) support the British component of the Fontenoy coalition.
- **American Revolution, 1776–1781 (five forces, four battles):** the same American Revolution Institute collection preserves dated British and French infantry muskets. [NPS’s Brown Bess account](https://www.nps.gov/articles/brown-bess.htm) supports the British shoulder-arm family. Hobkirk’s Hill’s American force uses the already established Continental equipment analogy from [NPS’s Guilford Courthouse teaching collection](https://www.nps.gov/common/uploads/teachers/lessonplans/Accessible%20Section%20508%20format%20American%20Soldiers%20of%20the%20Battle%20of%20Guilford%20Courthouse%20Travel%20Trunk%20Lesson.pdf), without assuming uniform militia dress or rifle proportions.
- **French armies, 1809–1814 (seven forces):** [Musée de l’Armée’s equipment article](https://actualites.musee-armee.fr/evenements/le-campement-de-la-grande-armee-episode-1-sequiper/) explicitly dates the replacement of the bicorne by the shako from 1806, lists the infantry musket and bayonet, and illustrates an 1813–1815 shako. The generator’s existing `napoleonic-infantry` is explicitly `('shako','musket',None)`. This is an equipment analogy for the French component, not a complete uniform reconstruction. French forces in 1792–1805, and the transitional 1807 campaign, remain unassigned by this batch.
- **Peninsular and Quatre Bras coalitions (five forces):** [NAM’s campaign account](https://www.nam.ac.uk/explore/peninsular-war) supports the British component at Vimeiro, Busaco, Albuera and Salamanca. [Albuera battlefield musket balls](https://collection.nam.ac.uk/detail.php?acc=1993-01-91--2) corroborate the arms and coalition context. [Royal Armouries’ Waterloo study](https://royalarmouries.org/objects-and-stories/stories/waterloo-1815) and [NAM’s Waterloo account](https://www.nam.ac.uk/explore/battle-waterloo) support the British component at Quatre Bras. Dutch, Portuguese and Spanish details and proportions are not inferred from the shared model.

## Merge and limits

Only Quatre Bras (`Q705936`) overlaps the existing equipment reviews. Retain its French assignment and append this British-Dutch aggregate assignment; the new note explicitly supersedes the earlier decision to leave that aggregate unassigned. Append/deduplicate source URLs and preserve separate notes. No `kind`, `medium` or polity identity overrides are proposed.

No models, automatic analogy rules or date ranges were changed for this batch. The asset’s overly broad 1790 date floor was separately reported to the integrating agent; it must not be taken as evidence for a French shako in the Revolutionary/Consular period. Austrian, Russian, Ottoman, Swedish and ambiguous multi-army equipment remains unchanged. Marston Moor’s contradictory actor/name provenance remains unresolved. The model families do not recover cavalry/artillery shares, weapon issue returns, exact drill, or uniforms for every coalition member.

An incidental location issue was reported separately: the current Eckmühl record (`Q700860`) points at Munich/Q1726. This review preserves location data; the equipment check does not validate the battlefield coordinates.

## Additional review, 1846–1879

A separate batch adds 45 assignments across 26 records: both sides in 19 American Civil War battles, the U.S. component in six Mexican War battles, and the Zulu force at Ulundi. The equipment file stores the battle-specific supporting links. [NPS’s Civil War weapons account](https://www.nps.gov/articles/000/civil-war-weapons-in-the-shenandoah-valley.htm) and its battlefield accounts support the long-arm infantry component. [NPS’s Mexican War weapons account](https://www.nps.gov/paal/learn/historyculture/lock-stock-barrel.htm) and the [Pike County Military Heritage Museum’s uniform explanation](https://www.pbs.org/video/pike-county-military-heritage-museum-tdd0g0/) support the American musket/forage-cap analogy; Mexican equipment remains unassigned. These are representative components, not complete force compositions.

At Ulundi, the [National Army Museum’s shield from the battle](https://collection.nam.ac.uk/detail.php?acc=1963-10-308-1) establishes the dated Zulu shield/spear component. Its CDB90 local army ID and every quantity remain unchanged. The new optional `equipmentIdentity` records a sourced polity association for eligibility of an explicitly selected profile. It never triggers an automatic equipment choice and never relaxes date or medium gates. Museum narrative losses are not substituted for independently attributed CDB90 casualties.

Together, the early and late batches add 56 new equipment-reviewed battles and extend the existing Quatre Bras review, taking the equipment review file from 67 to 123 records before the separately documented British 1879 correction. Four problematic numerical profiles were quarantined during this review; equipment evidence does not certify a source’s army names or strengths.

The British 1879 correction brings the final equipment-review count to 125. The [unit catalogue](battle-units.md#british-infantry-in-the-1879-zulu-war) documents its rifle, helmet, explicit campaign assignments and visual limits.

## Bergen and Warburg equipment review — 21 September 2026

Approve four explicit `flintlock-infantry` assignments across the two newly imported battles. These represent documented infantry components of complete local forces, without changing their numerical scope. The four assignments are included in the curated equipment crosswalk.

| Battle  | Participant               | Representative profile |
| ------- | ------------------------- | ---------------------- |
| Q571694 | Q571694:cdb90:74:attacker | flintlock-infantry     |
| Q571694 | Q571694:cdb90:74:defender | flintlock-infantry     |
| Q506909 | Q506909:cdb90:79:attacker | flintlock-infantry     |
| Q506909 | Q506909:cdb90:79:defender | flintlock-infantry     |

## Q571694

Equipment review for Bergen, 13 April 1759: the flintlock-infantry model represents a documented infantry component in each complete local force. The Royal Collection battle plan identifies Ferdinand and Broglie; ADB describes Ysenburg advancing with allied battalions and French infantry counterattacking, including the Beauvoisis regiment. The musket family is a disclosed period analogy supported by the NAM Long Land Pattern specimen and Perrier's contemporary French military flintlock illustration at the Met. The cocked hat, coat and weapon are representative eighteenth-century infantry forms, without exact national or regimental dress. This assignment establishes neither the infantry share of either army nor the equipment of cavalry, artillery or specialists. It changes no CDB identity, side, strength or loss estimate.

- [Royal Collection Trust · Bergen battle plan, RCIN 731066.r](https://militarymaps.rct.uk/the-seven-years-war-1756-63/map-of-the-battle-of-bergen-1759-bergen-enkheim-hesse-germany-50deg0900n-08deg4500e)
- [Deutsche Biographie · ADB Ysenburg, Johann Kasimir, 1898, PDF page 2: allied battalions at Bergen](https://www.deutsche-biographie.de/downloadPDF?url=sfz35293.pdf)
- [Deutsche Biographie · ADB Urff, Georg Ludwig, 1895: French infantry and Beauvoisis at Bergen](https://www.deutsche-biographie.de/sfz83418.html)
- [National Army Museum · Long Land Pattern flintlock musket, c. 1742, NAM 1994-06-2-1](https://collection.nam.ac.uk/detail.php?acc=1994-06-2-1)
- [Metropolitan Museum of Art · Perrier, French military flintlock engraving, c. 1750, 2004.57](https://www.metmuseum.org/art/collection/search/26920)

## Q506909

Equipment review for Warburg, 31 July 1760: the flintlock-infantry model represents a documented infantry component in both local armies. The National Army Museum places the 5th Regiment of Foot at Warburg; the contemporary Pflueg plan identifies infantry battalions in Du Muy's French force. The NAM Long Land Pattern musket and Perrier's French military flintlock engraving support the period weapon family. Exact regimental dress, hat variants and national musket patterns remain illustrative. Neither army is asserted to consist entirely of infantry, and no proportion, battalion-to-personnel conversion, cavalry or artillery assignment is inferred. The existing complete CDB forces, opposing sides and all strength and loss estimates remain unchanged.

- [Royal Collection Trust · Pflueg plan of Warburg, RCIN 733016.c, c. 1760](https://militarymaps.rct.uk/the-seven-years-war-1756-63/map-of-the-battle-of-warburg-1760-warburg-north-rhine-westphalia-germany-51deg3000n-09deg1000e)
- [National Army Museum · Royal Northumberland Fusiliers: 5th Regiment of Foot at Warburg](https://www.nam.ac.uk/explore/royal-northumberland-fusiliers)
- [National Army Museum · Long Land Pattern flintlock musket, c. 1742, NAM 1994-06-2-1](https://collection.nam.ac.uk/detail.php?acc=1994-06-2-1)
- [Metropolitan Museum of Art · Perrier, French military flintlock engraving, c. 1750, 2004.57](https://www.metmuseum.org/art/collection/search/26920)

For Warburg, the original plan title explicitly lists 28 infantry battalions in Du Muy's force. This is presence evidence only; that organizational count is not converted into men or an infantry percentage. For Bergen, ADB Ysenburg describes three forward battalions advancing into musket fire, while ADB Urff explicitly identifies French infantry and the Beauvoisis regiment. No count from these narratives is imported.

The current registry bounds for this model are **1740–1783**, which include both 1759 and 1760. These assignments require no registry extension. The generic cocked-hat figure does not claim to reconstruct grenadier caps, regimental colors, every contingent's national dress or its exact musket pattern.

Validation: the equipment-file schema parses; all four exact local IDs exist as land military units; all four explicit assignments resolve to a date-compatible `flintlock-infantry` profile. In-memory application preserves IDs, names, kinds, sides, dates, coordinates, strengths, deaths and casualties. The public catalogue rebuild and browser checks are recorded in the implementation checkpoint.

## British Civil War coalition follow-up

Two further explicit assignments retain the existing 1642–1651 model window:

| Battle                | Participant                | Model             |
| --------------------- | -------------------------- | ----------------- |
| Marston Moor, Q326417 | Q326417:cdb90:21:attacker  | civil-war-pikeman |
| Worcester, Q1116626   | Q1116626:cdb90:28:defender | civil-war-pikeman |

At Marston Moor, [Historic England’s battlefield report](https://historicengland.org.uk/content/docs/listing/battlefields/marston-moor/) identifies the infantry of three allied armies and reproduces contemporary accounts of their action. The figure represents the English Parliamentary infantry component within that combined force. A source-backed display name now makes the English–Scottish coalition explicit; the original CDB designation remains in the numerical qualifiers. No combined total is reassigned to one constituent.

At Worcester, [the battlefield report](https://historicengland.org.uk/content/docs/listing/battlefields/worcester/) and [Cromwell’s letter of 4 September 1651](https://www.olivercromwell.org/Letters_and_Speeches/Letters/Letter_168.pdf) establish close pike combat against the Royalist army. The already assigned Commonwealth force is preserved; the Royalist local force receives the same period weapon family. This does not certify the precise dress or armour distribution of Scottish soldiers. For both battles, [NAM 1996-07-279--3](https://collection.nam.ac.uk/detail.php?acc=1996-07-279--3) supplies the pot helmet and armour analogy. The museum’s general regiment proportions are not copied into either army. IDs, sides, strengths, uncertainty and loss definitions remain unchanged.

Dunbar’s Scottish force remains unassigned. The [Scottish Battlefields Trust](https://www.dunbar1650.org/the-armies/) documents Scottish pikemen but also woollen bonnets, grey coats and declining armour use. The currently armoured model cannot establish the missing Scottish dress attribution. Tippermuir also remains unassigned: the [HES inventory](https://portal.historicenvironment.scot/apex/f?p=1505:300:::::VIEWTYPE,VIEWREF:designation,BTL39) establishes Irish/Highland Royalists and Covenanter infantry without enough detail to assign the existing armoured model across these forces. This review does not widen a model window or treat all British forces as identically equipped.
