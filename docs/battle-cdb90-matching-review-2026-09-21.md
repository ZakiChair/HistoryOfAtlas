# CDB90 matching review — 21 September 2026

The final import adds 134 reviewed CDB90 battle profiles. Discovery found 362 exact DBpedia article links to existing catalogue QIDs; 164 candidates passed its preliminary date filter and received a scope review. That filter did not establish complete date agreement: the strict importer subsequently rejected four candidates because a next-midnight uncertainty bound had been mistaken for an additional battle day.

The source is [Jeffrey B. Arnold's CDB90 revision](https://github.com/jrnold/CDB90/tree/e0b35ec4d798cec3bb4e6970c0f6bb7aa69e2f4c), pinned to commit `e0b35ec4d798cec3bb4e6970c0f6bb7aa69e2f4c`. The revised data is licensed ODC-BY 1.0; the original US Army Concepts Analysis Agency data is public domain. The repository artifacts are:

- [Source manifest](../data/curated/battle-cdb90-source.json): immutable revision, resource byte counts, SHA-256 digests, attribution and licensing.
- [Reviewed crosswalk](../data/curated/battle-cdb90-matches.json): all 164 decisions and original force identity reviews.
- [Generated profiles](../data/curated/battle-cdb90-profiles.json): the 134 approved profiles, with quantity-level provenance.
- [Intake report](../data/reports/battle-cdb90-intake.json): a disposition for every one of the 660 source battle rows and digests of the manifest, review and generated profiles.

| Decision                         | Rows |
| -------------------------------- | ---: |
| Approved and imported            |  134 |
| Existing manual profile retained |   10 |
| Rejected promotion               |   20 |
| Total reviewed                   |  164 |

The 268 approved force assignments comprise 74 explicit existing participant IDs, already typed `polity` or `military-unit`, and 194 local forces. A local force retains the original CDB `NAM` designation and receives a battle-specific military-unit ID; its polity is not guessed from derived `actors`.

This review establishes correspondence and force identity. It does not independently certify every CDB quantity. Imported counts remain source estimates, with strength interpretations, uncertainty margins, aggregate casualty semantics, explicit zero versus unknown values, and source licensing preserved. Equipment and tactical movements are not established by CDB90.

## Source hierarchy and duplication

All 164 reviewed rows are parentless in the complete 660-row `data/battles.csv`. Comparing every source row by DBpedia target finds one duplicated target among those reviewed: sources 574 and 575 both link to Q4873015. They describe separate north and south sectors; neither is promoted or summed as a complete-battle estimate.

Original `belligerents.csv` NAM takes precedence over derived actors. Examples:

- Source 6, Breitenfeld: NAM identifies Swedish/Saxon and Imperial/Holy League armies. Derived actors omit Saxony and the League. Both forces remain local aggregates.
- Source 21, Marston Moor: both derived actors say Royalist, but NAM distinctly identifies Royalist and Parliamentary armies. The Parliamentary/allied force remains local, avoiding attribution of its full English/Scottish camp total to one faction.
- Sources 52 and 53: NAM still says French/Bavarian when derived actors say only France.
- Source 117, Austerlitz: the existing Q179023 French colonial empire is not an unambiguous identity for Napoleon’s field army. The French and allied forces remain local.
- Sources 220–226: German/Bavarian forces in 1870 remain local; no post-1871 German Empire identity is introduced.
- Source 208, Atlanta: the US Army of the Tennessee is not identical to the broader Military Division of the Mississippi, so no ID is inherited from that broader command.

The identity review left four entries with military names as local forces because their schema kind is `unknown`: Q4794361 (source 176 attacker), Q5159662 and Q2252166 (source 192 defender and attacker), and Q689849 (source 208 attacker). Their apparent source-name correspondence is recorded in the crosswalk without silently reclassifying them. Source 192 was subsequently excluded by the independent numerical check below, so its two local assignments are outside the final import.

## Rejected promotions

Six candidates were excluded during the initial scope review:

| Source | Target                 | Reason                                                                                                                                                                                         |
| ------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 241    | Q1215310 San Juan Hill | Original NAME combines San Juan Hill **and El Caney**. The combined row cannot supply full-battle counts for San Juan Hill alone.                                                              |
| 300    | Q1754797 Cape Helles   | FIRST DARDANELLES LANDING and ALLIED ARMY do not establish a Cape Helles-only scope. Separate Anzac and Kum Kale actions occurred that day.                                                    |
| 517    | Q250309 Tarawa         | The Betio-specific, reduced-force scope is held outside the import. It is not automatically enlarged to full-atoll coverage. Erroneous WAR=OKINAWA and LOCN=JAPAN metadata must not propagate. |
| 568    | Q1930278 Karameh       | The Jordanian 1st Infantry Division estimate is not shown to cover Palestinian commandos also involved in the broader battle.                                                                  |
| 574    | Q4873015 Sinai         | North sector only; shares its target with source 575.                                                                                                                                          |
| 575    | Q4873015 Sinai         | South sector only; shares its target with source 574.                                                                                                                                          |

The strict chronology and strength-scope gates excluded seven further candidates. Their final decisions and detailed notes are retained in the crosswalk:

| Source | Target                         | Failed gate                                                                                                                                                                                                                 |
| ------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 26     | Q510943, Preston (1648)        | The source ends on 18 August 1648, with an unknown hour. Its upper uncertainty bound is midnight on 19 August; the catalogue actually ends on 19 August.                                                                    |
| 105    | Q1415566, Würzburg             | The Austrian attacker has 44,000 total personnel engaged, strength code 3; initial strength and reinforcements are unknown. The defender has 30,000 initial personnel, code 1. Compatible accounting cannot be established. |
| 170    | Q48163, Custoza (1866)         | The Italian attacker has 90,000 total personnel engaged, code 3, with unknown initial strength and reinforcements. The defender has 75,000 initial personnel, code 1. Compatible accounting cannot be established.          |
| 243    | Q2619692, Te-li-Ssu            | The Russian defender has 38,000 total personnel engaged, code 3, with unknown initial strength and reinforcements. The attacker has 36,000 initial personnel, code 1. Compatible accounting cannot be established.          |
| 249    | Q1445532, Lule Burgas          | The source ends on 1 November 1912; midnight on 2 November is only its uncertainty bound. The catalogue ends on 2 November.                                                                                                 |
| 294    | Q684872, Second Masurian Lakes | The source ends on 21 February 1915; midnight on 22 February is only its uncertainty bound. The catalogue ends on 22 February.                                                                                              |
| 303    | Q1582511, Ctesiphon (1915)     | The source ends on 24 November 1915; midnight on 25 November is only its uncertainty bound. The catalogue ends on 25 November.                                                                                              |

The four chronology exclusions preserve the existing catalogue dates. A timestamp interval used to represent an unknown hour does not establish combat on the following day. The other three exclusions preserve the distinction between initial strength and total personnel engaged; the importer requires sufficient source accounting before comparing forces with different strength codes.

The [Australian War Memorial's Cape Helles entry](https://www.awm.gov.au/collection/E84739) distinguishes the simultaneous Anzac landing. Its [British landings account](https://www.awm.gov.au/visit/exhibitions/dawn/plan/british) additionally distinguishes Kum Kale. These support leaving source 300 unresolved rather than assigning its 32,000 attackers exclusively to Helles.

The [US Navy museum entry](https://www.history.navy.mil/content/history/museums/nmusn/explore/photography/wwii/wwii-pacific/gilbert-marshall-islands-campaign/invasion-gilbert-islands/tarawa-atoll-betio.html) identifies the 20–23 November 1943 engagement as the Battle of Tarawa Atoll: Betio. This supports a possible narrower equivalence for source 517, subject to a later explicit scope review. The [Naval History and Heritage Command overview](https://www.history.navy.mil/browse-by-topic/wars-conflicts-and-operations/world-war-ii/1943/tarawa.html) distinguishes Betio's capture on 23 November from securing other atoll islands by 28 November. The current crosswalk retains the exclusion.

The [UN-hosted seminar report](https://www.un.org/unispal/document/auto-insert-193667/) describes both Palestinian commandos and Jordanian units at Karameh. It is used only to identify the omitted force-scope question, not to import its political characterization or casualty figures. The [US State Department historical volume summary](https://history.state.gov/historicaldocuments/frus1964-68v20/summary) also identifies the attack on al-Fatah bases at Karameh.

## Independent source checks

A subsequent [15-battle sample audit](../data/reports/battle-cdb90-evidence-qc.json) identified three further holds. This review does not independently certify every retained CDB90 estimate.

- Source 192, Corinth (Q233360): CDB90 assigns 4,233 casualties to the Union and 2,520 to the Confederates. The [National Park Service listing](https://www.nps.gov/civilwar/mississippi.htm) places the 2,520 total on the Union side. The conflicting allocation is held pending an explicit correction.
- Source 179, Front Royal (Q2125491): the 16,000-man Confederate parent-army strength does not establish the force at this action. The [National Park Service account](https://www.nps.gov/articles/000/battle-of-front-royal.htm) distinguishes the approximately 3,000 engaged troops from the larger army.
- Source 267, Le Cateau (Q2003949): the 250,000-man German First Army estimate remains unresolved against the particular corps and divisions described in the [CHACR guide, printed page 19](https://chacr.org.uk/wp-content/uploads/2021/09/The-Western-Front-Vol1.pdf). This is a conservative force-scope hold, not a claim that the source count is proven false. The casualty estimate has a historical attribution and is not silently replaced.

## Existing reviewed profiles

Sources 66, 77, 82, 85, 92, 145, 178, 191, 199 and 230 correspond to manually reviewed Plassey, Plains of Abraham, Bunker Hill, Trenton, Cowpens, Waterloo, Shiloh, Antietam, Gettysburg and Isandlwana profiles. They are marked `reviewed-existing`. The combined profile loader retains manual reviews as authoritative.

## Reproduction and validation

Run from the repository root with the catalogue records available. The first command downloads missing resources from the pinned manifest, verifies their byte counts and SHA-256 digests, and generates the profiles and intake report. Cached source files are verified before reuse.

```sh
pnpm data:battles:cdb90 --fetch
pnpm data:battles:cdb90 --check
pnpm data:battles
pnpm data:battles:check
pnpm data:battles:cdb90 --check
```

Once the source cache is present, omit `--fetch` to regenerate without downloading. `--check` verifies the cached source snapshot and compares regenerated profiles and report with the repository artifacts without rewriting them. Repeating it after the catalogue build checks that importing from the rebuilt records remains stable.

The published-data checker runs offline: it verifies the manifest, crosswalk and profile digests against the intake report, checks their source revision agreement, and requires the approved QID set to equal the generated profile set. The importer separately binds the review to the manifest's repository, commit and license; validates exact article identity and complete source-day coverage; rejects parent-linked subengagements and duplicate approved targets; and enforces military identity, quantity scope and numerical safeguards.

Focused regression commands:

```sh
python3 -m unittest pipeline.battles.test_cdb90 pipeline.battles.test_import_cdb90
pnpm exec vitest run tests/unit/battle-profiles.test.ts
```

The final intake accounts for all 660 rows: 134 imported, 20 rejected, 10 retained existing reviews, 36 unreviewed child rows, 244 other unreviewed rows, and 216 unreviewed rows without an article link. Source estimates never become deaths by implication; an explicit zero casualty count remains distinct from an unknown count. Coalition totals are retained as one source force rather than divided among members.

## Follow-up identity and scope review

Four additional rows are held in the reviewed crosswalk: Perryville (193), New Market (204), Petersburg II (209), and Five Forks (217). The issue is the named force or combined-army scope, rather than a mere disagreement between estimates. Original source bytes and numbers remain preserved in the pinned snapshot.

- The [US Army Perryville staff-ride handbook](https://www.armyupress.army.mil/Portals/7/educational-services/staff-rides/StaffRideHB_Perryville.pdf) identifies Bragg’s force as the Army of the Mississippi; the source labels it Army of Tennessee. Its estimate is not declared false solely because of this name error.
- [NPS New Market](https://www.nps.gov/articles/000/battle-of-new-market.htm) identifies Sigel’s Department of West Virginia and Breckinridge’s assembled Valley force, rather than the source’s Army of the Potomac / Army of Northern Virginia labels.
- [NPS Petersburg opening assaults](https://home.nps.gov/pete/learn/historyculture/the-opening-assaults.htm) includes Army of the Potomac reinforcements beyond the Army of the James named by the source.
- [NPS Five Forks](https://www.nps.gov/pete/learn/historyculture/battle-of-five-forks.htm) describes V Corps and Sheridan’s cavalry; the source’s 30,000-man estimate is labeled V Corps alone.

Malvern Hill remains an initial-force estimate including reserves physically present behind the hill; it must not be read as the number actually firing. Port Republic’s detachment-scale count remains imported, with the broad historical command name flagged for a later display review. These qualifications and all seven holds are recorded in `data/reports/battle-cdb90-evidence-qc.json`.

## Additional complete-date review: 33 candidates

The full active-period converter found 33 unreviewed exact-article candidates which an older preliminary next-midnight comparison had skipped. Native conversion was only a technical eligibility check. Historical review approved 24 and held nine; no source quantities were edited. The crosswalk now covers 197 source rows: 158 imported, 29 held and ten existing manual reviews. Approved profiles contain 75 reused historical participant IDs and 241 local force assignments.

Source-backed `identityReview` entries clarify local names in English and French. They preserve local IDs, side keys, strength/loss quantities and raw NAM provenance; source citations for identities remain separate from CDB citations for numbers. Wimpfen’s existing defender name is also corrected to Georg Friedrich’s army, with its numerical profile unchanged.

| CDB row | Event                                    | Decision |
| ------- | ---------------------------------------- | -------- |
| 4       | Q677121 — Battle of Dessau Bridge        | approved |
| 5       | Q629302 — Battle of Lutter               | approved |
| 11      | Q428972 — Battle of Wittstock            | approved |
| 14      | Q1436705 — Battle of Tuttlingen          | rejected |
| 15      | Q174574 — Battle of Freiburg             | rejected |
| 16      | Q1415925 — Battle of Jankau              | approved |
| 17      | Q913821 — Battle of Herbsthausen         | rejected |
| 22      | Q4087469 — Battle of Tippermuir          | approved |
| 33      | Q3636391 — Battle of Khotyn (1673)       | rejected |
| 34      | Q672198 — Battle of Sinsheim             | approved |
| 37      | Q1001093 — Battle of Turckheim           | approved |
| 42      | Q1612417 — Battle of Fleurus (1690)      | approved |
| 47      | Q1862475 — Battle of Marsaglia           | approved |
| 57      | Q402312 — Battle of Dettingen            | rejected |
| 74      | Q571694 — Battle of Bergen (1759)        | approved |
| 79      | Q506909 — Battle of Warburg              | approved |
| 97      | Q855271 — Battle of Jemappes             | approved |
| 98      | Q1085392 — Battle of Neerwinden (1793)   | approved |
| 103     | Q610328 — Battle of Castiglione          | approved |
| 104     | Q1217073 — Battle of Neresheim           | approved |
| 114     | Q475544 — Battle of Messkirch            | rejected |
| 150     | Q1150410 — Battle of Boyacá              | approved |
| 154     | Q1508820 — Battle of Junín               | approved |
| 210     | Q4871114 — Battle of Globe Tavern        | approved |
| 218     | Q2313310 — Battle of Selma               | rejected |
| 235     | Q302519 — Battle of Adwa                 | approved |
| 282     | Q689972 — Battle of Kraśnik              | approved |
| 284     | Q667519 — Battle of Gnila Lipa           | rejected |
| 293     | Q1245157 — Battle of Loos                | approved |
| 296     | Q615324 — First Battle of the Isonzo     | approved |
| 297     | Q233242 — Second Battle of the Isonzo    | approved |
| 299     | Q702169 — Fourth Battle of the Isonzo    | approved |
| 593     | Q2892447 — Second Battle of Mount Hermon | rejected |

The [pre-1700 dossier](battle-cdb90-early-review-2026-09-21.md) gives the first 13 decisions. [Four older chronology holds](battle-cdb90-chronology-review-2026-09-21.md) remain unchanged. Herbsthausen receives a separately documented public date correction to 5 May 1645; its CDB row remains dated 2 May and excluded.

### 57 — Battle of Dettingen

Conservative force-scope hold, not proof that the CDB total is wrong. NAM identifies the Pragmatic Army as British, Hanoverian and Austrian and describes Austrian cavalry actually fighting at Dettingen. CDB labels its 35000 initial personnel only BR & HAN ARMY, under George II; neither the NAM account nor the tabulated CDB row establishes whether those 35000 include the Austrian contingent or describe the named British/Hanoverian subset. A shorter historical label may be incomplete, but renaming it Pragmatic Army would assert an unverified aggregate scope. Retain the raw estimate; do not add Austrian strength, divide the count, or approve proportional whole-camp representation until its inclusion is supported. The decision is about unresolved inclusion, not differences between published strength estimates.

- [National Army Museum — Battle of Dettingen; The campaign of 1743 and Infantry fire sections](https://www.nam.ac.uk/explore/battle-dettingen)

### 74 — Battle of Bergen (1759)

The 13 April 1759 engagement is Ferdinand of Brunswick’s allied force against Broglie’s French force. PR & ALLIED ARMY stays a combined local force; its estimate is not assigned to Prussia, Hanover or Britain alone. These sources review event and force identity; CDB numerical estimates and uncertainty are retained, not independently certified.

- [National Army Museum — Seven Years War, Ferdinand’s allied army](https://www.nam.ac.uk/explore/seven-years-war)
- [Royal Collection Trust — RCIN 731066.r, Battle of Bergen, 13 April 1759](https://militarymaps.rct.uk/the-seven-years-war-1756-63/map-of-the-battle-of-bergen-1759-bergen-enkheim-hesse-germany-50deg0900n-08deg4500e)

### 79 — Battle of Warburg

The 31 July 1760 battle is the force under Ferdinand against du Muy’s French force. The contemporary map distinguishes these battlefield forces from the larger campaign armies. Preserve the combined local PR & ALLIED ARMY aggregate without allocating its total to individual allies. These sources review event and force identity; CDB numerical estimates and uncertainty are retained, not independently certified.

- [Royal Collection Trust — RCIN 733016.c, contemporary plan of Warburg, 31 July 1760](https://militarymaps.rct.uk/the-seven-years-war-1756-63/map-of-the-battle-of-warburg-1760-warburg-north-rhine-westphalia-germany-51deg3000n-09deg1000e)
- [National Army Museum — Seven Years War, Ferdinand’s allied army](https://www.nam.ac.uk/explore/seven-years-war)

### 97 — Battle of Jemappes

The 6 November 1792 battle pits Dumouriez’s Army of the North against the Austrian force of the Duke of Saxe-Teschen. The museum’s contemporary print identifies the latter, giving a specific local display name for the broad CDB ALLIED ARMY. No number is reassigned to a modern polity or split among contingents. These sources review event and force identity; CDB numerical estimates and uncertainty are retained, not independently certified.

- [Paris Musées / Carnavalet — contemporary print G.28626, Jemappes, 6 November 1792](https://parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/victoire-de-l-infanterie-de-dumouriez-sur-les-troupes-autrichiennes-1)
- [Fondation Napoléon — Mortier, Army of the North at Jemappes and Neerwinden](https://www.napoleon.org/histoire-des-2-empires/biographies/mortier-adolphe-edouard-casimir-joseph-duc-de-trevise-1768-1835-marechal/)

### 98 — Battle of Neerwinden (1793)

Neerwinden on 18 March 1793 is Coburg’s Imperial Austrian army against Dumouriez’s Army of the North, not the 1693 battle. Preserve both as local field forces and retain the source initial-strength estimates. These sources review event and force identity; CDB numerical estimates and uncertainty are retained, not independently certified.

- [Deutsche Biographie — Friedrich Josias, campaign of 1793 and Neerwinden on 18 March](https://www.deutsche-biographie.de/gnd100443907.html)
- [Fondation Napoléon — Mortier, Army of the North at Jemappes and Neerwinden](https://www.napoleon.org/histoire-des-2-empires/biographies/mortier-adolphe-edouard-casimir-joseph-duc-de-trevise-1768-1835-marechal/)

### 103 — Battle of Castiglione

The single engagement on 5 August 1796 is distinct from the earlier Lonato operations. The Fondation account describes 30000 French troops against Wurmser’s 25000 at Castiglione, after Quasdanovich’s separate force was defeated. CDB mixed strength codes 1 and 3 are accepted only because both rows satisfy initial strength plus reinforcements equals the tabulated total; no wider campaign total is substituted. These sources review event and force identity; CDB numerical estimates and uncertainty are retained, not independently certified.

- [Fondation Napoléon / Revue du Souvenir Napoléonien 410 — Castiglione, 5 August 1796](https://www.napoleon.org/wp-content/themes/napoleon/annexes/hors-serie/premiere-campagne-italie/fr/lesecrits/articles/articles02.html)

### 104 — Battle of Neresheim

The 11 August 1796 engagement is Moreau’s Army of the Rhine and Moselle against the Austrian field army under Archduke Charles. Local forces preserve this historical command scope without using a present-day Austrian or French state identity. These sources review event and force identity; CDB numerical estimates and uncertainty are retained, not independently certified.

- [Fondation Napoléon — Moreau, Army of the Rhine and Moselle in 1796](https://www.napoleon.org/en/history-of-the-two-empires/biographies/moreau-jean-victor/)
- [Deutsche Biographie — Hotze, Austrian army and Neresheim on 11 August 1796](https://www.deutsche-biographie.de/sfz35859.html)

### 114 — Battle of Messkirch

Conservative force-scope hold. Exact article and 5 May 1800 date match, but the dispatch by Moreau reproduced in Dollinger/Wohleb, printed p. 400, explicitly states that Saint-Cyr’s corps could not participate in the actions at Engen and Messkirch. The broad CDB FR ARMY initial strength of 60000 is not reconciled with those absent formations. Do not label the number false or replace it with a smaller estimate; require evidence that both source totals describe forces present at Messkirch, not wider campaign armies.

- [Badische Landesbibliothek — Dollinger/Wohleb, ZGO 93, printed p. 400, Moreau’s dispatch](https://regionalia.blb-karlsruhe.de/files/27323/BLB_Dollinger_Koalitionskrieg_1799.1801.pdf)

### 150 — Battle of Boyacá

Soublette’s report dated 8 August 1819 describes the 7 August engagement of Bolívar’s Liberating Army and Barreiro’s royalist field army at Boyacá. Its reported 13 killed plus 53 wounded also explains why the CDB 66 is casualties, not deaths. Preserve the CDB estimate as one local force per side, with no nationality subdivision or modern Colombian army identity. These sources review event and force identity; CDB numerical estimates and uncertainty are retained, not independently certified.

- [Gobernación de Boyacá — Soublette’s battle report, 8 August 1819](https://www.boyaca.gov.co/el-puente-de-boyaca-y-sus-monumentos/)

### 154 — Battle of Junín

The 6 August 1824 engagement was between the opposing cavalry components, ahead of the larger infantry armies. The Spanish Army historical account describes about 900 Patriot and 1300 Royalist cavalry, which are the lower endpoints of the CDB estimates, rather than the entire 10000/8000-person campaign armies. Preserve the CDB 2000/2000 estimates and their signed uncertainty; the local display names clarify cavalry scope without narrowing the counts to one named regiment. Santa Cruz’s report identifies the participating cavalry commands. No infantry equipment profile is inferred. These sources review event and force identity; CDB numerical estimates and uncertainty are retained, not independently certified. The agreement with the lower endpoints does not independently confirm either 2000 central estimate or equal opposing strengths: Santa Cruz describes the Patriot cavalry as numerically inferior. The figures remain competing estimates for the cavalry engagement, not a reconstructed count of the larger infantry armies.

- [Bicentenario del Perú — Santa Cruz’s battle report, 7 August 1824](https://bicentenario.gob.pe/parte-batalla-junin-1824/)
- [Spanish Army Historical Service — Revista de Historia Militar, cavalry action at Junín](https://publicaciones.defensa.gob.es/media/downloadable/files/links/R/E/REVISTAS_PDF635_1.pdf)

### 210 — Battle of Globe Tavern

The whole 18–21 August 1864 battle covers Warren’s V Corps reinforced by elements of II and IX Corps against the Confederate force including Heth and Mahone. Preserve the CDB plus-qualified aggregates and code 3 total personnel engaged; neither total becomes the full Army of the Potomac or Army of Northern Virginia. The minor difference between NPS and CDB Confederate casualties is retained as an estimate difference. These sources review event and force identity; CDB numerical estimates and uncertainty are retained, not independently certified. The CWSAC casualty fields give 4455 Union and 1600 Confederate casualties. Its narrative establishes 18–21 August; the broad June–December date field is a campaign label, and its zero strength placeholders are not used as evidence of zero forces.

- [National Park Service — Battle of Weldon Railroad, 18–21 August 1864](https://www.nps.gov/pete/learn/historyculture/battle-of-weldon-railroad.htm)
- [National Park Service — CWSAC VA072, Globe Tavern narrative and casualty estimates](https://www.nps.gov/civilwar/search-battles-detail.htm?battleCode=va072)

### 218 — Battle of Selma

Conservative battle-versus-campaign scope hold supported by the U.S. Army Center of Military History. Bradley, The Civil War Ends, 1865, printed p. 50 gives 13480 cavalry departing on Wilson’s raid on 22 March and then records Croxton’s brigade moving separately to Tuscaloosa; p. 52 gives about 9000 in Long’s and Upton’s two divisions outside Selma on 2 April. CDB assigns 13500 initial personnel to US CAV CORPS MIL DIV MISSISSIPPI for the one-day battle, closely corresponding to the larger raid force rather than the two divisions present. The source also describes the defenders as cavalry, state troops and pressed local citizens, while CDB names CS CAV CORPS (ELMS); inclusion of the non-cavalry defenders in its 7000 is unresolved. This is a demonstrated detachment/force-scope issue, not merely different estimates. Keep the raw CDB counts, but do not use them as whole-battle proportional camps or substitute 9000/4000 automatically.

- [Mark L. Bradley, U.S. Army Center of Military History, The Civil War Ends, 1865 (2015), pp. 50, 52–53](https://history.army.mil/portals/143/Images/Publications/catalog/75-17.pdf)
- [U.S. Government Publishing Office copy of CMH Pub 75–17](https://www.govinfo.gov/content/pkg/GOVPUB-D114-PURL-gpo57532/pdf/GOVPUB-D114-PURL-gpo57532.pdf)

### 235 — Battle of Adwa

The 1 March 1896 battle is Menelik II’s Ethiopian army against Baratieri’s expeditionary force, including Eritrean ascari. Retain each aggregate locally; do not attach the whole Italian-side count to European infantry alone, and do not split Ethiopian forces among commanders. The Ministry of Culture study discusses an expeditionary force exceeding 20000; it does not independently establish the precise CDB 20251 strength or the Ethiopian 120000 estimate. Both remain explicitly attributed source estimates, not exact headcounts or reconstructed orders of battle. These sources review event and force identity; CDB numerical estimates and uncertainty are retained, not independently certified. The Ministry of Defence memorial history instead describes three Italian columns with 14500 men against more than 100000 Ethiopian fighters. The Culture volume’s expeditionary figure does not establish which personnel were present on 1 March. This review found no affirmative evidence identifying absent formations inside the CDB total, so the disagreement alone is not treated as proof of a scope error. Neither institutional estimate replaces the CDB values.

- [Library of Congress — B. Melli, La colonia Eritrea (1899), description of the battle on 1 March 1896](https://www.loc.gov/item/02015779/)
- [Italian Ministry of Culture — Fonti e problemi della politica coloniale italiana, vol. II, Baratieri’s expeditionary force](https://dgagaeta.cultura.gov.it/public/uploads/documents/Saggi/5bd17690622e2.pdf)
- [Italian Army General Staff — Compendio storico Somalia, Eritrean ascari at Adwa](https://www.esercito.difesa.it/Documents/compendio-sto-somalia-200903.pdf)
- [Italian Ministry of Defence — I Sacrari Militari Italiani all’estero, printed p. 178, Daragonat/Adwa](https://musei.difesa.it/allegati/I%20Sacrari%20Militari%20Italiani/files/basic-html/page182.html)

### 282 — Battle of Kraśnik

Whole-battle correspondence: the Austrian State Archives identify Dankl’s Austro-Hungarian First Army against the Russian Fourth Army at Kraśnik on 23–25 August 1914. Preserve both original CDB NAM labels as local military forces, with AUS referring here to Austria-Hungary. Both CDB strengths use code 3 (total personnel engaged). The archive corroborates event, dates and army identities, not the CDB estimates of 350000/260000 personnel or 50000 casualties per side; no source quantities are replaced or independently certified. Do not map either force to modern national actors.

- [Austrian State Archives — 1914 Krasnik, Komarów, Lemberg](https://wk1.staatsarchiv.at/operative-kriegsfuehrung/1914-krasnik-komarow-lemberg/index.html)

### 284 — Battle of Gnila Lipa

Conservative scope hold, not a finding that the CDB estimates are false. Exact article and full dates match, but the Austrian State Archives describe the Austro-Hungarian Third Army and the separate Kövess army group, becoming the Second Army, in the 26–30 August fighting. CDB names only AUS 3RD ARMY(+) opposite RUS 3RD & 8TH ARMIES. The plus sign does not itself establish whether the 240000-person aggregate includes Kövess. Quarantine until the source force scope is reconciled; do not add a second force or infer/split coalition counts.

- [Austrian State Archives — 1914 Krasnik, Komarów, Lemberg](https://wk1.staatsarchiv.at/operative-kriegsfuehrung/1914-krasnik-komarow-lemberg/index.html)

### 293 — Battle of Loos

Whole Loos offensive, retaining the CDB 25 September–14 October 1915 window also used by the National Army Museum WWI timeline. CHACR chapter 10 identifies British First Army against German Sixth Army and lists formations committed over the battle; its title ends on 15 October, a differing chronology convention. Preserve BR 1ST ARMY and GER 6TH ARMY(-) as local CDB military forces, including the minus qualifier. Both strengths are code 3 total personnel engaged, not the six British divisions of the opening assault. CHACR publishes different casualty estimates (50380 British; about 26000 German); retain the CDB 61713/19836 as attributed estimates, not a consensus or deaths. Sources establish event/formation scope, not independent verification of CDB counts.

- [National Army Museum WWI timeline — Battle of Loos, 25 September–14 October 1915](https://ww1.nam.ac.uk/timeline/battle-loos/)
- [CHACR — The Western Front, volume 1, chapter 10, printed p. 69: forces engaged at Loos](https://chacr.org.uk/wp-content/uploads/2021/09/The-Western-Front-Vol1.pdf)

### 296 — First Battle of the Isonzo

Whole First Isonzo battle, 23 June–7 July 1915: the Italian Ministry of Defence’s Milite Ignoto chronology confirms these boundaries. Visintin’s regional historical institute account identifies the Italian Second and Third Armies attacking along the Isonzo against Boroević’s Austro-Hungarian Fifth Army during the first four offensives. Preserve IT 2ND & 3RD ARMIES as one combined local force and AUS 5TH ARMY as the opposing local force; do not divide either total among armies, nationalities or equipment. Both CDB strengths use code 3. Identity/date review does not independently certify the CDB personnel and casualty estimates.

- [Italian Ministry of Defence — Milite Ignoto (1988), PDF p. 5: official battle chronology](https://www.difesa.it/assets/allegati/26653/milite_ignoto.pdf)
- [Angelo Visintin, Istituto regionale per la storia della Resistenza e dell’Età contemporanea nel FVG — Il fronte dell’Isonzo](https://www.regionestoriafvg.eu/tematiche/tema/434/Il-fronte-dellIsonzo)

### 297 — Second Battle of the Isonzo

Whole Second Isonzo battle using the 18 July–3 August 1915 convention explicitly printed in Italian Ministry of Defence, Milite Ignoto, PDF p. 5. Austrian State Archives use the broader end date 10 August; retain the supported CDB/catalogue convention and disclose the variation rather than extend or silently combine periods. Visintin identifies the opposing Italian Second/Third and Austro-Hungarian Fifth Armies for the 1915 offensives. Preserve the combined Italian NAM as one local force, and the Austrian NAM as another, with code 3 total personnel engaged on both sides. Scope/date corroboration is not independent numerical certification.

- [Italian Ministry of Defence — Milite Ignoto (1988), PDF p. 5: official battle chronology](https://www.difesa.it/assets/allegati/26653/milite_ignoto.pdf)
- [Angelo Visintin, Istituto regionale per la storia della Resistenza e dell’Età contemporanea nel FVG — Il fronte dell’Isonzo](https://www.regionestoriafvg.eu/tematiche/tema/434/Il-fronte-dellIsonzo)
- [Austrian State Archives — 1915 Isonzo battles; longer second/fourth battle date conventions](https://wk1.staatsarchiv.at/operative-kriegsfuehrung/1915-isonzooschlachten/index.html)

### 299 — Fourth Battle of the Isonzo

Whole Fourth Isonzo battle using the 10 November–2 December 1915 convention explicitly printed in Italian Ministry of Defence, Milite Ignoto, PDF p. 5. Austrian State Archives use a broader end date of 14 December; this known chronology variation is retained in this review, not used to stretch the CDB interval. Visintin identifies the Italian Second/Third Armies and Austro-Hungarian Fifth Army across the four 1915 offensives. Preserve IT 2ND & 3RD ARMIES as one local force and AUS 5TH ARMY as the other, both using CDB code 3 total personnel engaged. Do not infer army subdivisions or independently certify CDB strengths/casualties.

- [Italian Ministry of Defence — Milite Ignoto (1988), PDF p. 5: official battle chronology](https://www.difesa.it/assets/allegati/26653/milite_ignoto.pdf)
- [Angelo Visintin, Istituto regionale per la storia della Resistenza e dell’Età contemporanea nel FVG — Il fronte dell’Isonzo](https://www.regionestoriafvg.eu/tematiche/tema/434/Il-fronte-dellIsonzo)
- [Austrian State Archives — 1915 Isonzo battles; longer second/fourth battle date conventions](https://wk1.staatsarchiv.at/operative-kriegsfuehrung/1915-isonzooschlachten/index.html)

### 593 — Second Battle of Mount Hermon

Conservative force-scope hold despite exact article and 8 October 1973 date agreement. The Israeli Ministry of Defence’s account says approximately 140 personnel were allocated to the rescue mission because the rest of Golani was engaged elsewhere, describes elements under battalions 51 and 17 plus two tanks, and reports retreat in numerical inferiority. CDB instead assigns initial strength 2692 to IS GOLANI BDE(-), versus 1583 to SYR PARA BDE(-). The local assault versus parent-force scope is unresolved; do not replace CDB with 140 or infer an exhaustive opponent total. An earlier HERO June 1976 table also labels the 8 October opponent Moroccan Bde(+), illustrating unstable force attribution; it is not a basis for changing the opponent to Morocco. Require source reconciliation before proportional animation.

- [Israel Ministry of Defence — Failed attempt to recapture the Israeli Hermon outpost, 8 October 1973](https://yomkipurwar.mod.gov.il/events/Pages/ניסיון-הנפל-לכיבוש-מוצב-החרמון-הישראלי.aspx)
- [HERO, Comparative Analysis of Arab and Israeli Combat Performance, June 1976, figure 29, printed p. 21 (PDF p. 23)](https://www.dupuyinstitute.org/pdf/054.pdf)

The pinned source remains the sole numerical source of these imports. Junín’s central 2000/2000 estimates are not evidence of equal actual cavalry strengths; Adwa’s differing institutional strength estimates are disclosed rather than silently substituted. Neither approval establishes exact troop positions, equipment proportions or a sequence of losses.

## Modern chronology follow-up

A subsequent [review of 131 modern source rows](battle-cdb90-modern-dates-review-2026-09-21.md) inspected ten promising whole-event candidates. It admits Third Isonzo (298) after an independently sourced end-date correction and records nine further holds. The live crosswalk now contains 207 reviews: 159 approved, 38 rejected and 10 preserved existing profiles, using 75 existing participant IDs and 243 local force assignments. Festubert, Gaza and Mukden receive independent catalogue date corrections without quantitative approval. Source phases attached to a whole-battle article remain excluded.
