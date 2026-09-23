# Austrian equipment review — 21 September 2026

The new `austrian-seven-years-infantry` profile gives five already quantified battles a sourced Habsburg infantry illustration: Lobositz, Kolin, Leuthen, Hochkirch and Torgau. It represents one regular fusilier component, not the composition or uniform of the entire army.

## Evidence and historical limits

The [Heeresgeschichtliches Museum identifies its Albertina manuscript as a contemporary collection from 1762](https://www.hgm.at/fileadmin/hgm/2024_2025/HGM/pdf/2025/HGM_Presseaussendung_J%C3%A4nner_2025_21012025.pdf), p.2. The [Ligne infantry portrait](https://commons.wikimedia.org/wiki/File:Kaiserliches_Infanterieregiment_No._38_Albertina-Handschrift_1762.jpg), inspected through a public-domain reproduction, shows a black tricorne with pale edging, white coat and breeches, rose facings and black gaiters. [UNamur's exhibition](https://neptun.unamur.be/s/expo-wallons/page/regiment) establishes white-coated Walloon infantry in Austrian service during the Seven Years War. The campaign provides a conservative **1756–1763** analogy window around the portrait, rather than evidence of identical dress throughout the eighteenth century.

The [Austrian Ministry of Defence's _Hessenspiegel_ 2/2019](https://www.bundesheer.at/sk/lask/brigaden/pzgrenbrig4/baon/pdf/hessenspiegel_0219.pdf), p.22, documents and photographs the M1754 smoothbore flintlock with steel ramrod and socket bayonet in the war's context. Its photograph was inspected, as was the earlier [VHÚ Praha M1722/30 museum object](https://www.vhu.cz/wp-content/uploads/2024/07/Vzhuru-ku-Praze-BROZURA.pdf), p.6. The original model has a pinned wooden stock, cock, flint, frizzen, priming pan, ramrod and offset socket bayonet. It is a weapon-family approximation, not a measured replica or proof of universal issue.

[UNamur dates the replacement Kaskett and shorter coat to 1767](https://neptun.unamur.be/s/expo-wallons/page/uniforme). This is a clear reason to reject extending the tricorne silhouette to the Revolutionary Wars. The narrower 1763 cutoff closes the reviewed campaign; it does not assert the disappearance of tricornes that year. Rose facings refer to the inspected Ligne portrait, not every regiment. The later regimental number 38 is omitted because numbering followed in 1769.

## Identity and assignments

Automatic selection requires the historical Habsburg monarchy **Q153136**, the land medium and the date window. Modern Austria, the later Austrian Empire, Holy Roman Empire and Archduchy identity do not qualify. Local CDB army aggregates require both an explicit profile and separately sourced `equipmentIdentity`.

| Battle                    | Assignment                                   | Independent army-affiliation evidence                                                                                                                                                                         |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lobositz, 1756 — Q694478  | CDB90 64 defender, AUS ARMY                  | [Lacy biography](https://www.deutsche-biographie.de/sfz47316.html#adbcontent): Austrian infantry command and Browne's army on 1 October                                                                       |
| Kolin, 1757 — Q127299     | CDB90 67 defender, AUS ARMY                  | [UNamur](https://neptun.unamur.be/s/expo-wallons/page/kolin): Los Rios infantry and the Austrian army on 18 June                                                                                              |
| Leuthen, 1757 — Q313435   | Existing Q153136 identity, automatic analogy | Existing reviewed Habsburg participant; [Daun biography](https://www.deutsche-biographie.de/gnd118678965.html#adbcontent) also identifies the Austrian army                                                   |
| Hochkirch, 1758 — Q695925 | CDB90 73 attacker, AUS ARMY                  | [Daun](https://www.deutsche-biographie.de/gnd118678965.html#adbcontent): Austrian command, night of 13–14 October; [Sincère](https://www.deutsche-biographie.de/sfz80344.html#adbcontent): infantry component |
| Torgau, 1760 — Q688802    | CDB90 81 defender, AUS ARMY                  | [Sincère](https://www.deutsche-biographie.de/sfz80344.html#adbcontent): left-wing infantry on 3 November; Daun corroborates Austrian affiliation                                                              |

The old Lacy biography gives a different Hochkirch date and is used only for Lobositz. No battle date was overwritten. The four explicit patches preserve source army names, participant IDs, camps, chronology, strengths, deaths and casualties; their estimates remain aggregate CDB90 evidence.

Rossbach, Kunersdorf and Liegnitz retain their mixed coalition identities. Hohenfriedberg, Soor and Hohenlinden also remain excluded. Breslau's Archduchy participant is not automatically treated as the Habsburg army. The 1740s and 1790s remain outside this model's reviewed window. Grenadiers, Hungarian and frontier troops, cavalry, artillery, allied contingents, campaign wear and troop proportions are not individually reconstructed.

## Verification and cost

Against the readiness baseline of **21 September 2026, 20:17 UTC**, the actual resolver and simulation identify **five partial → complete equipment selections**: one automatic and four explicit. Applying the proposals left all numerical evidence and identities unchanged. The integrated catalogue reports **65 battles meeting the full-evidence gate, up five**; equipment completeness alone still does not establish a historical order of battle.

The GLB is **350,296 bytes**, with **9,132 triangles**, 17 articulated meshes, 36 nodes and March/Engage clips. The catalogue contains **58 GLBs across 63 profiles**, totaling **19,285,788 GLB bytes** or **19,297,503 bytes with the manifest**. The authorized growth guard increases from 19 MB to **19.5 MB**. The asset remains below 500 KB and is loaded per scene. SHA-256 comparison confirms that all 57 prior GLBs are unchanged; only the new asset was generated.

The source images and rendered preview were visually inspected. The 32 targeted unit tests pass, including date, identity and medium exclusions; the explicit local-identity path; hat and firearm geometry; forward engagement; and all-model loading and animation contracts. TypeScript, targeted ESLint, Python compilation and formatting checks pass. The integrated build, 379 unit tests and data checks also pass. An independent read-only review found no blocking model, attribution or mutation issue. Motion remains illustrative rather than an exact loading drill; browser scene validation is recorded separately in the battle evidence reports.
