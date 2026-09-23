# CDB90 early follow-up evidence review — 22 September 2026

Eight previously unreviewed rows were checked against the published catalogue and institutional sources. **All eight remain held from CDB90 import.** Two independently supported date corrections are integrated: the start of Alte Veste and the Gregorian date of Poltava. These corrections do not make either quantitative row eligible.

The starting registry had 215 reviewed rows: 165 imported, 40 held and 10 covered by manual profiles. The reviewed addition produces **223 reviewed, 165 imported, 48 held and 10 manual** in the actual importer’s dry run. All 165 existing profile records compare equal. The coordinating agent integrated the eight decisions and two metadata patches, then ran the actual importer and rebuilt the public catalogue. Final preservation and browser checks are recorded in the continuation checkpoint.

The pinned source is [jrnold/CDB90 at e0b35ec4d798cec3bb4e6970c0f6bb7aa69e2f4c](https://github.com/jrnold/CDB90/tree/e0b35ec4d798cec3bb4e6970c0f6bb7aa69e2f4c), with the repository’s ODC-BY-1.0 attribution retained by the source manifest. Its nine locally cached resources passed the manifest’s byte-count and SHA-256 checks. No original dates, numerical fields, uncertainty percentages, force names or article links were edited.

## Decisions

All figures below are **unpublished raw CDB90 estimates**, in personnel. All sixteen strengths use code 1, initial strength, with zero reinforcements in the source. `cas` is the dataset’s personnel battle-casualty field; the figures are neither verified deaths nor silently corrected by this review. Independent accounts establish chronology or raise scope questions, not exact certification of the estimates.

| CDB row and public event          | Original attacker / defender strength; casualties        | Decision and principal reason                                                                                     |
| --------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 7 — Rain, Q703436                 | Swedish 33,000 / Imperial 27,000; 1,000 / 3,000          | Hold: source 15–16 April 1632 differs from institutional 14–15 April.                                             |
| 8 — Alte Veste, Q2002331          | Swedish 46,000 / Imperial 60,000; 4,000 / 2,000          | Hold: 3 September established; the source’s further combat interval on 4 September remains unverified.            |
| 10 — Nördlingen 1634, Q312212     | Swedish 25,000 / Spanish–Imperial 35,000; 12,000 / 2,000 | Hold: source covers 6 September, while the whole battle includes 5 September.                                     |
| 19 — Lens, Q2164950               | French 14,000 / `IMP ARMY` 18,000; 4,000 / 10,000        | Hold: source 10 August versus public/institutional 20 August 1648; no declared source calendar.                   |
| 23 — Kilsyth, Q4087434            | Scottish Royalist 4,900 / Covenanter 6,800; 6 / 6,000    | Hold: source 1644 versus institutional 1645; casualty claims also require critical review.                        |
| 35 — Seneffe, Q1783252            | French 50,000 / Dutch-allied 70,000; 10,000 / 14,000     | Hold: exact midnight endpoint needs an explicit interpretation policy; no unsupported second combat day is added. |
| 36 — Enzheim / Entzheim, Q1143181 | French 22,000 / Imperial-allied 31,700; 3,500 / 2,500    | Hold: confirmed article redirect is not admitted by the current exact-title guard.                                |
| 49 — Poltava, Q152486             | Swedish 21,500 / Russian 80,000; 9,600 / 1,300           | Hold: source calendar undeclared; independent force/reserve and casualty-category questions remain.               |

### Rain — retain the current dates

The [City of Rain’s monument account](https://rain.de/tourismus/sehenswertes/sehenswuerdigkeiten/tilly-denkmal-und-hauptstrasse_id8814) explicitly identifies the two battle days as 14–15 April 1632. Its [Tilly biography](https://rain.de/blumenstadt-rain/rain-gestern-und-heute/personen/persoenlichkeiten/johann-tserclaes-graf-von-tilly) places the wound on 15 April and the withdrawal that night. The public record already matches. CDB’s 15–16 April interval is a substantive date mismatch, not merely the next-midnight uncertainty representation: its start and end low bounds are different days. The municipality’s different Swedish army estimate is disclosed; it is not itself grounds to reject a historical estimate.

### Alte Veste — correct the start, leave the end unasserted

[University of St Andrews SSNE record 1969](https://www.st-andrews.ac.uk/history/ssne/item.php?id=1969) directly places Bellenden’s regiment in the fighting against Wallenstein on 3 September 1632. The [municipal museum of Zirndorf](https://museum.zirndorf.de/das-museum/der-erlebnisweg-wallensteins-lager) confirms the opposed armies and the battle associated with Wallenstein’s camp.

The public record has 9 September and no end. The proposed correction changes only the start to 3 September. CDB records exact intervals of 10:00–20:00 on 3 September and 10:00–11:00 on 4 September. This review has not established that latter interval independently, or distinguished its combat from withdrawal. No end is added, and the correction note explicitly avoids claiming a verified one-day duration. Nor does the institutional identification certify CDB’s initial army totals or combine them with camp followers.

### Nördlingen — preserve the two-day battle

The [Geopark Ries brochure published by Ostalbkreis](https://www.ostalbkreis.de/sixcms/media.php/26/Flyer-Schwedenweg.pdf) describes the municipal museum’s representation of the battle on 5–6 September 1634. The [University of Warsaw news-pamphlet catalogue, item 414](https://cbdu.ijppan.pl/id/eprint/4140/), transcribes a contemporary title explicitly naming both days and lists a report pairing 26–27 August with 5–6 September. This is stronger evidence than treating the 5th as merely a march because some short summaries mention only the victory on the 6th.

The public already spans 5–6 September. CDB has only 05:30–12:30 on the 6th. No metadata change is needed and the event must not be shortened. The source’s combined Spanish–Imperial army would also have to remain one aggregate in any later profile, without duplicating the same total among the seven imported participant identities.

### Lens — no inferred source-calendar conversion

The [Ministry of Culture’s scientific record for Versailles painting MV2726](https://pop.culture.gouv.fr/notice/joconde/000PE005894) separately records the represented event’s date as 20 August 1648. This supports the existing public date; it is a nineteenth-century representation, not a contemporary casualty return. CDB’s two active intervals instead fall on 10 August. A ten-day offset suggests a possible calendar explanation but is not a declaration of the calendar used by this row. The source’s `IMP ARMY` label under Leopold Wilhelm also needs a precise review of the Spanish-Netherlands command before creating a public aggregate. Neither the date nor the force label is rewritten here.

### Kilsyth — wrong source year and contested loss claims

[Historic Environment Scotland’s BTL13 designation](https://portal.historicenvironment.scot/apex/f?p=1505:300:::::VIEWTYPE,VIEWREF:designation,BTL13) dates the battle and main narrative to 15 August 1645. A context paragraph says 16 August 1645, an internal inconsistency worth retaining, but nothing there supports CDB’s 1644. Its competing strength estimates include the older totals represented by CDB. HES explicitly characterizes the Royalist claim of 6,000 Covenanter losses against fewer than twenty of their own as exaggerated. Thus an eventual source-date repair would not by itself settle the meaning or reliability of the 6 and 6,000 casualty figures. The existing public identities and date are preserved.

### Seneffe — an endpoint issue, not a manufactured extra day

The [Château de Seneffe educational PDF](https://chateaudeseneffe.be/la-bataille-de-seneffe/wp-content/uploads/2012/04/Recit_bataille_de_seneffe.pdf) frames the engagement as 11 August 1674. Pages 11–12 end the combat around midnight and distinguish the following morning. CDB supplies an exact fourteen-hour interval, 11 August 10:00 to 12 August 00:00. This can represent the end of the same day’s battle; it does not independently establish combat during 12 August. The current day-level adapter nevertheless returns the 12th as the end date. This case remains held for a future explicit endpoint policy, rather than extending public metadata just to satisfy the gate.

The PDF warns on page 2 that its reconstructed first-person story includes fictional elements. Its factual loss box distinguishes killed, wounded and prisoners and differs from the website narrative. No competing figure is copied, added to CDB, or used as a death total. This is a temporal interpretation hold, not rejection simply because estimates differ.

### Entzheim — historically compatible, exact alias not yet supported

The [December 2021 municipal bulletin](https://www.entzheim.fr/wp-content/uploads/2025/05/DECEMBRE-2021.pdf) identifies the 4 October 1674 engagement between Turenne and Bournonville. Opening [Battle of Enzheim](https://en.wikipedia.org/wiki/Battle_of_Enzheim) directly displays the Entzheim article with an explicit redirect notice and a Wikidata link to Q1143181. The downloaded HTML also contains that direct QID link.

This establishes an alias, not an extra battle or fuzzy name match. However, CDB’s exact article is absent from the published event’s sources, which contain `Battle of Entzheim`. No title guard, source row or public article list is altered. The current hold can be revisited through a separately tested alias-review mechanism. No subsequent Brandenburg reinforcement total is included in the initial army count.

### Poltava — calendar correction does not validate the quantities

The [Presidential Library account](https://www.prlib.ru/node/619368) explicitly pairs 27 June with 8 July 1709 and distinguishes the later 10 July commemoration. The cached Wikidata claims independently label the former Julian and the latter Gregorian. The proposed public date is therefore 8 July. The [Swedish Army Museum’s anniversary exhibition](https://armemuseum.se/utstallning/poltava-28-juni/) uses 28 June, but does not establish what calendar CDB intended.

The library also separates approximately 20,000 Swedish battle participants from reserves, gives 42,000 Russian troops, and separates Russian killed from wounded. Those categories raise additional questions about CDB’s 80,000 Russian strength and 1,300 casualties. They are not sufficient to prove how CDB compiled either number. No reserves, later surrender figures or casualty categories are silently combined; the hold is broader than a calendar mismatch.

## Preservation and validation

No replacement participant profiles are proposed. Across the eight frozen public records there are **19 participant identities and 43 participant-source entries**. Their strength, casualty and death arrays are empty, as are the eight records’ totals and unassigned quantity arrays. The two in-memory metadata applications preserve participants, references, quantities, coordinates, coordinate sources and absent end dates. There is no model assignment or rendering-scale change.

The checks ran against the actual current importer and metadata implementation:

```sh
pnpm exec tsx /tmp/historyofatlas-cdb-early-next-metadata-validate.mts
python3 /tmp/historyofatlas-cdb-early-next-import-validate.py
```

Results:

- Both strict metadata records parse and apply in memory. Deliberately wrong expected source dates are rejected before mutation.
- All eight forced trial approvals are rejected: seven for full-period date mismatch, Entzheim for the exact-article guard. These are technical safeguards, not substitutes for the historical review above.
- The staged registry adds eight held decisions. The merged dry run gives 223 reviewed / 165 imported / 48 held / 10 manual, with no quarantined approved rows.
- All **165 pre-existing imported profile records are deeply equal** to the dry-run output. No public build, global test suite, integration file or production importer code was changed by this review.

Staged artefacts under `/tmp/historyofatlas-cdb-early-next-`:

| Suffix                     | Purpose                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `proposal.json`            | Eight additive crosswalk holds with sources and reasons.                                                                                                                       |
| `metadata-proposal.json`   | Two independent date corrections with strict original-value guards.                                                                                                            |
| `metadata-validation.json` | Schema, application, stale-precondition and preservation results.                                                                                                              |
| `import-validation.json`   | Pinned-source verification, rejection reasons, merged counts and unchanged-profile comparison.                                                                                 |
| `provenance-audit.json`    | All nineteen original participant IDs and per-event preservation accounting.                                                                                                   |
| `raw-dates.json`           | Cached Wikidata date claims, including calendar models.                                                                                                                        |
| `raw-match.json`           | Pinned battle, belligerent and active-period rows. Nördlingen’s encoded title and Entzheim’s alias were resolved explicitly in the review, not by this preliminary match list. |
| `public-before/`           | Eight public records frozen before integration.                                                                                                                                |
| `corrected-events/`        | In-memory metadata results and copies of existing approved events used by the dry run.                                                                                         |
| `sources/manifest.json`    | Download URLs, byte counts and SHA-256 values for cached institutional examples; failed cache requests are identified.                                                         |

Frozen proposal hashes at handoff:

```text
proposal.json
64e516742061c7197ef85ed2982b934194edb58ae45ddf7d2d80502a78f63d24
metadata-proposal.json
e672ed3aa28eb2ff6deeb54675eb30f0fd9cd8ff3e7ea77c81d19d3d261ce65b
```

Selected directly downloaded evidence hashes, available through the source-cache manifest:

```text
seneffe.pdf
c3c9fef82dac9b3351eef4767e3202d6cfcbe2a7c43df6a5b54921240326d5e3
noerdlingen.pdf
2cd854b7e1cfe4bf8f1ab4a16a82d7949078ef71ba3fd134c7d88c42e46b6648
entzheim-2021.pdf
b6ed10962e352f4d269a8f9c81cc9fac82c2048fa481759b38b100c0416adb7c
poltava.html
4d417341ce6e2e40612a4d90dff004a6e28be0e08a29a5777669f7ba22b50fb2
```

The Trove replacement page returned HTTP 403; the older HES designation page was opened and read directly. An unrelated cached HAB introduction and the access-denied Bavarikon lead are not used to assert an Alte Veste endpoint. No cached institutional material is republished as a numerical dataset.
