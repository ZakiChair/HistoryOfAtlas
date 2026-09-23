# Hornet–Penguin position review — 21 September 2026

**Decision: retain the location hold for Q5037019.** No coordinates or executable metadata patch are proposed. The public start remains 23 March 1815; `end` and `coords` are absent. Its existing one-ship opposing cohorts and losses are untouched.

## Primary evidence recovered

Lieutenant James McDonald’s official letter, dated 6 April 1815, was first printed as Appendix No. 111 in William James, _A Full and Correct Account_ (1817), pp. cc–ccii. The [McGill University Library scan, p. cci](https://archive.org/details/McGillLibrary-rbsc_lc_account-naval-occurences_Lande00467-16048/page/n750/mode/1up) was inspected visually, rather than trusting its imperfect OCR. During the action, it records:

> At 1. 50. the island S.W. three or four miles

The [preceding page](https://archive.org/details/McGillLibrary-rbsc_lc_account-naval-occurences_Lande00467-16048/page/n749/mode/1up), also visually inspected, establishes the letter’s identity and date. Its heading contains a different west-southwest position for **6 April**, which must not become the battle position.

Biddle’s letter to Decatur, 25 March 1815, follows as Appendix No. 112, pp. ccii–ccv. It describes preparing to anchor off the island’s northern end, then sailing westward and engaging; it supplies no battle coordinate or named survey reference. James’s editorial narrative and the reports’ disputed personnel figures were not adopted.

## Institutional corroboration and limits

The [Naval Historical Center’s extended caption for NH 55463](https://www.ibiblio.org/hyperwar/OnlineLibrary/photos/images/h55000/h55463l.htm), a lithograph after William Skiddy’s sketch held by the U.S. Naval Academy Museum, repeats the southwest bearing and three-to-four-mile distance at the opening of the engagement. It uses 13:45 rather than McDonald’s 13:50. NHC explicitly identifies the print’s January date as erroneous and dates the engagement to 23 March. This is corroboration of a relative position, not an independent hydrographic fix.

The [State Department’s published 1865 affidavit by Skiddy](https://history.state.gov/historicaldocuments/frus1866p1/d25) gives latitude 37°06′ S and longitude 12° W **for the island encountered that morning**, not for either ship during the fight. Those coordinates are excluded from any proposed battle position.

## Why the hold remains

The primary wording does not name the cape, summit, shoreline extremity or other reference used for the bearing and range. It does not state whether the bearing is true or magnetic, any applied variation, or a distance-unit definition. The supplied distance is already an estimate. Choosing an island centroid, treating the bearing as exactly 225° true and projecting its midpoint as 3.5 nautical miles would add unsupported assumptions. The evidence narrows the offshore vicinity but does not justify a specific map anchor under the current review standard.

The next useful evidence would be a dated log entry with a named landmark or ship fix, or a contemporary chart plotting the action. [NARA’s Special List 44](https://www.archives.gov/research/military/logbooks/special-list-44-named) lists early Hornet logbooks but leaves their dates blank in the online table; it does not confirm a March 1815 volume. The institutional lead is RG 24, Entry 118, [NAID 581208](https://catalog.archives.gov/id/581208). The USNA Hornet order book MS 56 covers 1823–1825 and is outside this engagement’s period.

## Durable record and checks

The [structured diagnostic report](../data/reports/battle-hornet-penguin-location-review-2026-09-21.json) preserves the decision, observed public metadata, primary observation, source URLs and SHA-256 digests for seven downloaded source files or page images. It is explicitly non-executable, supplies no metadata patch and is not an input to the battle pipeline. Raw research payloads remain outside the repository; hashes identify the bytes reviewed, without assuming future publisher responses will be identical.

The [published battle record](../public/data/battles/events/Q5037019.json) was verified byte-identical when this audit was recorded, with SHA-256 `9b5a96b397dd1102c3659e2d89f6631619d3aa17e7e7a437376a16970490196e`. Its absence of coordinates and 23 March 1815 start date are preserved. All seven cached-source hashes were verified.

Only this audit and its diagnostic JSON were added. No curated, public, runtime or test files were modified. No map-rendering validation is claimed: the reviewed outcome preserves the unmapped state.
