# Ichi location review — 23 September 2026

**Decision: geographic hold.** No curated metadata, participant profile, public record, coordinate, date or quantity was changed by this review. A readily available official heritage locator was rejected after a directly relevant academic study contradicted the assumption that the protected area necessarily represents the actual battlefield.

## Existing record

Q12612946, `Battle of Ichi`, has start `{year:1592,month:8,day:14}`, no end date, no coordinates and no participants. All strength, death and casualty arrays are empty. The existing source is Wikidata revision 2499729210. These values remain unchanged. This review does **not** establish which calendar underlies the imported exact day.

## Official coordinate leads, not accepted battlefield points

The [Korea Heritage Service record for Ichi Battlefield, Wanju](https://www.heritage.go.kr/heri/cul/culSelectDetail.do?ccbaCpno=2333500260000&pageNo=1_1_1_1&sngl=Y) identifies Jeonbuk monument 26, a designated area of 3,318,357.83 m². The downloaded HTML explicitly calls:

```text
jsCntsForm('이치전적지','127.344626184143','36.1073595908458')
```

The official `selectCntsView.do` response assigns `lat="36.1073595908458"` and `lng="127.344626184143"`, then uses `new kakao.maps.LatLng(lat, lng)` for both map centre and marker. Longitude/latitude ordering and degree units are therefore supported by the viewer, rather than inferred from the parameter names. The initially considered display point `[127.3446,36.1074]` is **not proposed for import**.

The separate [KHS Geumsan Ichi battlefield record](https://www.heritage.go.kr/heri/cul/culSelectDetail.do?ccbaAsno=0001540000000&ccbaCpno=2333401540000&ccbaCtcd=34&ccbaKdcd=23&pageNo=1_1_1_0) identifies Chungnam monument 154, area 99,488 m², and publishes `[127.352883260549,36.1322132919099]`. Geumsan's [tourism page](https://www.geumsan.go.kr/tour/html/sub02/0201.html?mng_no=28&mode=V) independently renders a nearby marker at `[127.353112496693,36.1323342208931]`. Neither point is imported or averaged with the Wanju locator.

## Why the heritage designation is insufficient here

Ha Tae-gyu (Jeonbuk National University), _The scope and management status of the Ungchi and Ichi battlegrounds_, **Jeonbuk Sahak 51 (2017), pp.365–408**, DOI [10.28975/jha.2017.10.51.365](https://doi.org/10.28975/jha.2017.10.51.365), has publicly readable Korean and English abstracts through [RISS record A103703399](https://www.riss.kr/link?id=A103703399). The full article was not obtained.

The abstract directly challenges the geographic boundaries of both Ichi heritage designations. It locates the likely main combat along the old pass road rising from Muksan-ri toward the summit, and states that commemorative/protected areas do not adequately coincide with the actual fighting terrain. It specifically discusses monuments 26 and 154, so this is material counterevidence to both candidate locators.

The [Academy of Korean Studies account](https://encykorea.aks.ac.kr/Article/E0046300) confirms the general Ichi battlefield between Daedunsan and Geumsan and opposing forces associated with Gwon Yul and Kobayakawa. It does not resolve the geographic disagreement to a defensible modern point. No precise old-pass location, reliable georeferencing or institutional correction of the disputed boundaries was established in this bounded review.

An official marker alone cannot therefore justify adding battlefield coordinates. A future review should recover the study's maps and newer archaeological/heritage delineations, identify the old pass on an authoritative modern map, and distinguish the actual combat sector from memorial visitor sites. No numerical accuracy radius is inferred.

## Chronology and force holds

The municipal tourism narrative gives the eighth day of the seventh month of 1592 without a calendar conversion. The municipality's [2009 anniversary notice](https://geumsan.go.kr/kr/html/team/080305.html?GotoPage=33&code=kr_04050601&group_at=kr_04050601&menu_dvs_cd=08050301&mode=V&no=73e170e98460488d382a4d3f2b8a0f54&site_dvs_cd=kr) explicitly gives the twentieth day of the seventh lunar month. These accounts do not establish a twelve-day duration. No conversion, replacement date or end date is introduced; the existing 14 August is retained without renewed validation.

The accounts identify opposing Korean/Japanese forces, but their numbers and described contingents vary. No strength, death, casualty, equipment or modern-state identity is imported. No participant profile is staged, at the coordinating agent's request.

## Evidence retained

Downloaded source bytes and SHA-256 hashes are listed in `/tmp/historyofatlas-ichi-review-source-manifest.json`; exact source copies use `/tmp/historyofatlas-ichi-review-*.html`. The manifest records the rejected candidate points and the explicit geographic hold. No build or tests were needed for this documentary review.
