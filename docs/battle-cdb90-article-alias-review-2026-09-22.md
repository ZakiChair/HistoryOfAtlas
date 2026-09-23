# Reviewed CDB90 article aliases — 22 September 2026

The importer can now accept an explicitly reviewed difference between the original CDB90 DBpedia title and the English article already attached to a published battle. It does not fetch redirects, infer similar names or change the source CSV. Existing direct matches produce identical profiles.

`articleAliasReview` requires exactly `sourceArticle`, `targetArticle`, `battleId`, `reviewedAt`, `note` and `sources`. The original title must still match the pinned DBpedia resource exactly after the existing space/underscore normalization. The different target must occur in the published battle’s English article sources, and the review must bind the same QID, have a valid ISO calendar date, explanation and nonempty HTTP(S) source evidence. A malformed review is rejected even if the original article is also present. External evidence is an editorial claim reviewed by a person/agent; these structural checks do not themselves prove that a web redirect is historically correct.

The alias never relaxes complete-period date equality, parent-engagement exclusion, approved decision, source row identity, two opposing military forces, compatible personnel scope or numerical bounds. Its evidence is attached to both participants and its explanation to the profile note. Numerical observations retain only their original CDB provenance. No casualty estimate becomes a death count.

## Entzheim — source row 36, Q1143181

The [original Enzheim redirect revision 457515601](https://en.wikipedia.org/w/index.php?title=Battle_of_Enzheim&oldid=457515601&redirect=no) points to `Battle of Entzheim`. The [target revision 1370440030](https://en.wikipedia.org/w/index.php?title=Battle_of_Entzheim&oldid=1370440030) links Q1143181, whose [English sitelink](https://www.wikidata.org/wiki/Q1143181) is the same target. These are primary evidence of the publishers’ own article identity, not independent numerical evidence.

The [Entzheim municipal bulletin, December 2021, printed pp. 30–31](https://www.entzheim.fr/wp-content/uploads/2025/05/DECEMBRE-2021.pdf) independently identifies the 4 October 1674 engagement, Turenne’s French army and Bournonville’s Imperial force. It places fighting in the present airport sector. The existing event point remains unchanged; this review does not certify its exact battlefield precision.

The pinned CDB rows give initial strengths of 22,000 and 31,700, both code 1, with zero source reinforcements; casualties are 3,500 and 2,500. The whole active period is 4 October. The municipal account instead gives approximately 6,500 combined losses, so its date and identity evidence does not certify CDB’s combined 6,000. All CDB central values, signed uncertainty qualifiers and original `FR ARMY` / `IMP ALLIED ARMY` names remain in numerical provenance. Subsequent Brandenburg arrivals are not added.

Each side is a local aggregate military unit. The prior unquantified polity participant Q12548 is replaced by the local Imperial allied army; both original citation objects, including CC0 licences, are retained in its identity evidence. Neither army is assigned equipment by this review. No coalition shares or tactical positions are reconstructed.

## Verification before wider integration

Four semantic regressions exercise a valid alias, rejected incomplete/misbound evidence, preservation of numerical observations and other rejection gates. The suite first failed on the missing feature, then passed all 26 Python tests. Importing Entzheim adds exactly one profile and leaves all 165 previously imported profile objects unchanged. The eight-battle follow-up review documents any additional aliases separately.
