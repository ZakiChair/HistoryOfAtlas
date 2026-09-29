# Religious-composition sources

## RCS-Dem 2.0

`python3 pipeline/religions/rcs.py` rebuilds the RCS coverage fragment offline from
the committed selected source extract and explicit geography mappings.
`python3 pipeline/religions/rcs.py --check` verifies reproducibility.
`python3 pipeline/religions/rcs.py --acquire` refreshes the selected extract from
the pinned original workbook and Natural Earth revision; full files are cached
under ignored `data/raw/religions-majority/`.
The generated `data/curated/religion-coverage-rcs-report.json` records coverage by
year, rejected rows and both original and selected-geometry checksums.

The source is Davis Brown and Patrick James, _Religious Characteristics of States
Dataset Project: Demographics v. 2.0_, distributed by the Association of Religion
Data Archives (ARDA), [DOI 10.17605/OSF.IO/7SR4M](https://doi.org/10.17605/OSF.IO/7SR4M).
The [official download](https://osf.io/download/asg25) is pinned by SHA-256 in the
script. Only reviewed country-years, 18 non-nested family percentage columns and
the source unknown percentage are retained in the extract, with source geometries.
The original 100-category, 42,747-row workbook is not redistributed.

### Attribution and use conditions

These are **ARDA data use terms**, not a Creative Commons licence or a public-domain
dedication. The [dataset download terms](https://www.thearda.com/data-archive?fid=RCSDEM2&tab=3)
state: “When using ARDA data in publications and presentations, the author should
acknowledge the Association of Religion Data Archives and the original collector(s)”.
They also require responsible use, provide the material without warranty, and
specify Indiana law. The OSF project does not declare an additional named licence.

The atlas publishes selected, transformed composition results with attribution to
ARDA and Brown/James and links to the dataset and its methods. This is not a claim
that the underlying dataset has been relicensed under the atlas content licence.
Natural Earth geometry retains its separate
[public-domain terms](https://www.naturalearthdata.com/about/terms-of-use/).

### Meaning and limits

- The RCS series already contains interpolation and extrapolation. Each displayed
  snapshot explicitly says so. An annual row is not necessarily a census for that
  year. This pipeline adds no estimates or interpolation.
- Appendix A of the [codebook](https://www.thearda.com/ARDA/pdf/originalCodebooks/RCS%20Demographics%20v2.0%20Codebook.pdf)
  defines changing population territories. ISO3 equality alone is never enough:
  the mapping registry binds CCODE, source abbreviation, source ISO3, reviewed
  years, a specific Natural Earth geometry and a bilingual population-scope label.
  France uses only the three reviewed metropolitan polygons. Russia excludes the
  pinned Crimean polygon because RCS explicitly excludes Crimea. China combines
  the CHN, HKG and MAC outlines only from 1999, matching the codebook's inclusion
  of Hong Kong and Macao. These selections are checked against a pinned Natural
  Earth file hash; no geometry is guessed from country names.
- RCS Christian, Muslim and Buddhist totals exclude their separate syncretic
  categories. The East Asian aggregate combines Shinto, Confucianism, Daoism and
  Chinese folk traditions after source adjustments for multiple affiliations.
  Parent categories are never summed with their children.
- Indigenous, East Asian and other combined categories are explicitly labelled
  aggregates. Non-affiliation is not labelled a religion. RCS's historical
  classification choices are retained, not asserted as universal identities.
- Missing values remain unknown. The source unknown percentage does not become
  a religious group. Negative percentages (including corrections for multiple
  affiliations), shares above 100%, totals above 101%, or multiple families above
  50% cause the whole snapshot to be excluded, without rescaling.
- The renderer's majority is strictly above 50%; substantial presence starts at
  20%. Source precision is retained at these boundaries. The maximum snapshot
  age is 15 years, and the original reference year must remain visible. A 2015
  estimate remains a 2015 estimate when consulted in 2026.

Run normalization tests with
`python3 -m unittest discover -s pipeline/religions -p 'test_rcs.py'`.
