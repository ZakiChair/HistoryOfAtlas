# Cornwall and 1942 carrier equipment review

Review begun 21 September 2026; model verification completed just after midnight on 22 September, Europe/Zurich. This audit concerns original render assets and equipment eligibility. Numerical source reviews and their later integration are separate.

## Cornwall: evidence and interpretation

The former industrial-warship illustration did not distinguish a County/Kent heavy cruiser from other powered warships. The new `county-kent-heavy-cruiser` model uses two primary objects held by Royal Museums Greenwich:

- [NPA9348, Cornwall partial as-fitted profile](https://www.rmg.co.uk/collections/objects/rmgc-object-53306), recording the refit alterations on 31 December 1937. The actual plan image was inspected, including the three raked funnels, stepped bridge, aft hangar and aircraft-handling structures.
- [N8274, Cornwall broadside photograph, 1938](https://www.rmg.co.uk/collections/objects/rmgc-object-1018357). The photograph was inspected to check the long high-sided hull, four twin main-gun turrets in fore-and-aft superfiring pairs, three funnels, two masts and hangar silhouette.

The event link is [Australian War Memorial photograph 128072](https://www.awm.gov.au/collection/C48238), whose description identifies Cornwall as the ship that sank Pinguin on 8 May 1941. That photograph depicts Pinguin, and was used for identification and chronology, not as a source for Cornwall's shape. The [British Naval Intelligence Division report CB 4051 (29), October 1941, pp.20–21](https://w.uboatarchive.net/Int/PinguinINT.htm) provides contemporary action context, including Cornwall's aircraft and turret groups. Its prisoner accounts are not treated as independently established damage or fitting specifications.

This evidence supports a **post-refit family analogy used in the reviewed 1941 action**, not a precisely reconstructed 1941 fitting state. No claim is made about exact radar, light anti-aircraft installations, camouflage, paint colour, internal machinery, crew, every deck fitting, or every County-class ship. Neutral materials improve readability; colours are not extracted from the monochrome photograph. The aircraft-handling structure is visible, but no aircraft are placed on the ship: a ship figurine does not imply an aircraft count.

The original geometry includes the narrow hull, three slightly raked funnels, four twin turrets with raised inner pairs, bridge, masts, aft hangar, simplified catapult, cranes, boats and railings. March animates vessel motion; Engage adds modest turret movement. The animation is illustrative and does not reconstruct the action's manoeuvres, firing bearings or timing.

## Cornwall assignment boundary

The profile requires `medium: naval`, year **1941**, an explicit profile assignment, and British identity `Q145`. The one-year window is the reviewed application window; it does not assert that this silhouette first existed in 1941 or lasted for only one year. `explicitOnly` blocks both automatic registry selection and automatic analogy rules.

The staged proposal is `/tmp/historyofatlas-cornwall-equipment-proposal.json`. It addresses only `local:Q4677388:cornwall` in `Q4677388`, adding `profileId` and a source-bearing `equipmentIdentity`. It preserves the participant's local identity, Pinguin, dates, coordinates, strength, ship losses and human deaths. An in-memory application passed the equipment schema and checked these invariants and the actual resolver. Live integration is owned by the parent task.

## 1942 straight-deck carrier family

The second model, `ww2-straight-deck-carrier`, makes a carrier cohort visually distinct from a gun-armed cruiser. It uses these primary photographs, all inspected:

- [NHHC/NARA 80-G-16569, Lexington CV-2, 8 May 1942](https://www.ibiblio.org/hyperwar/OnlineLibrary/photos/events/wwii-pac/coralsea/coralsea.htm). The archive caption explicitly notes the earlier removal of Lexington's eight-inch turrets. Those turrets are not part of the model.
- [NHHC/NARA 80-G-17031, Shokaku, 8 May 1942](https://www.ibiblio.org/hyperwar/OnlineLibrary/photos/events/wwii-pac/coralsea/coralsea.htm). The silhouette supports the continuous straight flight deck; damage and smoke are not reproduced.
- [NHHC/NARA 80-G-21627, Yorktown CV-5, 4 June 1942](https://www.history.navy.mil/our-collections/photography/wars-and-events/world-war-ii/midway/80-G-21627.html), inspected through the [archived Navy photograph](https://www.ibiblio.org/hyperwar/OnlineLibrary/photos/images/g20000/g21627.jpg). This is CV-5 at Midway, not the later namesake CV-10.

The original mesh has an uninterrupted axial flight deck, underlying hangar hull, modest starboard island, elevator outlines, arresting-wire indications and small side platforms. There is no angled deck, ski jump, jet equipment, large cruiser gun turret or modelled aircraft. Elevator locations, light weapons and deck fittings are simplified family cues, not a measured plan of one carrier.

The family must not be presented as the exact hull of every American and Japanese carrier. The inspected archive images of [Akagi, NH 73058, 27 April 1939](https://www.ibiblio.org/hyperwar/OnlineLibrary/photos/sh-fornv/japan/japsh-a/akagi2.htm), [Hiryu, USAF 75712 AC, 4 June 1942](https://www.ibiblio.org/hyperwar/OnlineLibrary/photos/sh-fornv/japan/japsh-h/hiryu.htm), and [Shoho, 80-G-17026, 7 May 1942](https://www.ibiblio.org/hyperwar/OnlineLibrary/photos/sh-fornv/japan/japsh-s/shoho.htm) illustrate this limitation: Akagi and Hiryu had port-side islands, while Shoho lacked an island. The generic starboard island also does not reproduce Lexington's distinctive large exhaust structure, or the Japanese carriers' individual funnel arrangements. Hull sizes and classes within the battle cohorts varied.

Eligibility is restricted to naval assignments in **1942**, explicitly associated with the United States `Q30` or Empire of Japan `Q188712`. Both automatic selection paths remain disabled. Local carrier cohorts need separately sourced equipment identities. The parent task supplies the battle assignments and numerical evidence for Midway and Coral Sea; this model review does not infer full fleet composition, aircraft numbers, losses or human deaths.

## Asset budget and verification

Only the two new GLBs were generated with `--only`. All **60 pre-existing GLB SHA-256 values** match the saved baseline. No old asset was regenerated or simplified.

| New asset | Bytes | Triangles | Meshes / nodes |
| --- | ---: | ---: | ---: |
| `county-kent-heavy-cruiser.glb` | 349,876 | 7,040 | 21 / 42 |
| `ww2-straight-deck-carrier.glb` | 412,076 | 7,196 | 7 / 14 |

Each model is below 500,000 bytes and contains independent March and Engage clips. The resulting inventory is **62 GLBs and 67 registry profiles**, with **20,865,556 GLB bytes + 12,576 manifest bytes = 20,878,132 bytes**. The authorized catalogue growth guard is 21,500,000 bytes. The increase from the previous manifest-inclusive inventory is **762,373 bytes**. Assets still load per scene; this catalogue total is not an initial page transfer. The two new geometry downloads total 761,952 bytes before any transport compression, and a scene only requests the relevant model URLs.

Four new tests were observed failing because the profiles were absent, before implementation. After generation, **38 targeted tests passed** across `battle-units.test.ts` and `battle-equipment-identity.test.ts`. These checks cover explicit identity/year/medium restrictions, both automatic-selection paths, the local identity requirement, superfiring turret heights, distinct funnel/turret groups, the carrier's long flat deck above its hangar, actual animation movement, opaque geometry and bounded assets. TypeScript checking and targeted ESLint passed.

Both Blender studio previews were visually inspected: `/tmp/historyofatlas-cornwall-preview.png` and `/tmp/historyofatlas-carrier-preview.png`. The cruiser reads as a three-funnel vessel with separated fore/aft batteries; the carrier reads as a continuous flat flight deck with an offset island. Fine railings, gun barrels and arresting wires may disappear at distant camera scales. These previews do not substitute for the parent task's integrated desktop/mobile browser checks, which were pending when this model review was delivered.

An independent read-only review found no blocking issue. It repeated the four new tests, checked modern Japan `Q17` is ineligible, verified both animation clips and all four turret rotations, inspected the previews, reproduced the old-asset hash comparison, and applied the Cornwall proposal in memory without changing Pinguin or numerical fields.
