# Bounded geographical review — 22 September 2026

Reviewed only Q1754785 (second Breitenfeld, 1642) and Q543994 (Hanau, 1813). The original evidence review changed no live data. Both proposed metadata records were subsequently integrated by the coordinating agent and rebuilt into the public catalogue.

## Breitenfeld II

Recommend withdrawal of `[12.3748, 51.3403]`, without a replacement coordinate. The [official Westsachsen landscape framework](https://www.rpv-westsachsen.de/wp-content/uploads/regionalplan/Grundlagenteil_FB_Teil2.pdf), PDF page 185 / printed 2.6–95, map 2.6-39, explicitly distinguishes the first and second Breitenfeld battlefields north of Leipzig. Its next page distinguishes the 1642 battle from the subsequent capture of Leipzig. The [Saxon State Archives, Rittergut Breitenfeld 20352](https://www.archiv.sachsen.de/archiv/bestand.jsp?oid=06.02&bestandid=20352&syg_id=), independently states that another battle occurred at Breitenfeld in 1642. The small-scale regional map supports a sector, not surveyed coordinates. No point is extracted from its pixels, and the monument commemorating 1631 is not reused.

Map rendered and visually inspected: `/tmp/historyofatlas-geography-two/westsachsen-page185.png`. The approved proposal includes `coords: null`, a basis, the official source URL, and source entries. It preserves the separate CDB date proposal and its expected original values.

## Hanau

Retain the existing source point `[8.9169444444444, 50.133055555556]` with explicit uncertainty as a town-area proxy. It has not been verified as the centre of the field. The [municipal museum, object 187](https://www.museen-hanau.de/sammlung/objekt-der-woche/187-zeitzeugen), places the principal battle in present-day Lamboy-Tümpelgarten. However, the [KulturRegion FrankfurtRheinMain exhibition catalogue](https://www.krfrm.de/wp-content/uploads/2023/11/ausstellungskatalog_krieg_und_freiheit-1.pdf), PDF page 20 / printed pp.36–37, describes the Bavarian recapture of Hanau followed by French bombardment of the Vorstadt on 31 October. Its reproduction of Conrad Westermayr’s painting is credited to Historisches Museum Hanau / Hanauer Geschichtsverein.

That documented urban phase prevents declaring every town-area location unrelated. Neither source proves the exact retained point. No replacement is proposed, and no museum, monument or surviving tree is substituted as a battle coordinate. Rendered spread inspected: `/tmp/historyofatlas-geography-two/hanau-page20.png`. Numerical claims in these geographical sources were not adopted.

## Deliverable

`/tmp/historyofatlas-breitenfeld-hanau-metadata-proposal.json` contains two complete records, extending `/tmp/historyofatlas-next-cdb-metadata-proposal.json`. It passes `BattleMetadataFileSchema`. Hanau retains its original coordinate without a coordinate override; its date-review note gains the geographical caveat. Breitenfeld removes the now-inaccurate sentence that its location remains unchanged.
