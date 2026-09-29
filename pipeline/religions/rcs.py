#!/usr/bin/env python3
"""Build reviewed RCS religious-composition snapshots without inferring geography.

The default build is offline, using the committed, selected source extract.
--acquire refreshes that extract from the pinned official workbook and Natural
Earth file. Full downloads stay in ignored data/raw/. No interpolation is added.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[2]
CURATED = ROOT / 'data/curated'
RAW = ROOT / 'data/raw/religions-majority'
MAPPINGS = CURATED / 'religion-coverage-rcs-mappings.json'
EXTRACT = CURATED / 'religion-coverage-rcs-source.json'
OUTPUT = CURATED / 'religion-coverage-rcs.json'
REPORT = CURATED / 'religion-coverage-rcs-report.json'
WORKBOOK_URL = 'https://osf.io/download/asg25'
WORKBOOK_SHA256 = '438831b2d5b9375f0369a7645b7af99342e4ace33aa6c844f7a600dc6c44afa6'
NE_COMMIT = 'ca96624a56bd078437bca8184e78163e5039ad19'
NE_SHA256 = '3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb'
NE_URL = f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_COMMIT}/geojson/ne_50m_admin_0_countries.geojson'
CODEBOOK_URL = 'https://www.thearda.com/ARDA/pdf/originalCodebooks/RCS%20Demographics%20v2.0%20Codebook.pdf'
TERMS_URL = 'https://www.thearda.com/data-archive?fid=RCSDEM2&tab=3'
SOURCE_ID = 'rcs-dem-2-0'
GEOMETRY_SOURCE_ID = 'religion-coverage-natural-earth'

# Parent totals and their children never appear in this list together. RCS
# explicitly excludes syncretic categories from CHRPC, MUSPC and BUDPC.
GROUPS = [
    ('CHRPC', 'christianity', 'Christianisme', 'Christianity', '#c084d8', 'cross', 'religion'),
    ('CSYNPC', 'christian-syncretic', 'Traditions syncrétiques chrétiennes', 'Christian syncretic traditions', '#ad79b3', 'cross', 'aggregate'),
    ('JEWPC', 'judaism', 'Judaïsme', 'Judaism', '#669cf6', 'menorah', 'religion'),
    ('MANPC', 'mandaeism', 'Mandéisme', 'Mandaeism', '#709da8', 'water', 'religion'),
    ('MUSPC', 'islam', 'Islam', 'Islam', '#249c66', 'crescent', 'religion'),
    ('MSYNPC', 'muslim-syncretic', 'Traditions classées « syncrétiques musulmanes » par RCS', 'Traditions classified as Muslim syncretic by RCS', '#679c81', 'crescent', 'aggregate'),
    ('ZORPC', 'zoroastrianism', 'Zoroastrisme', 'Zoroastrianism', '#d8606c', 'faravahar', 'religion'),
    ('BAHPC', 'bahai', 'Foi bahá’íe', 'Bahá’í Faith', '#c7aa55', 'star', 'religion'),
    ('JAIPC', 'jainism', 'Jaïnisme', 'Jainism', '#cc629f', 'ahimsa', 'religion'),
    ('SIKPC', 'sikhism', 'Sikhisme', 'Sikhism', '#3690b4', 'khanda', 'religion'),
    ('HINPC', 'hinduism', 'Hindouisme', 'Hinduism', '#c0783c', 'om', 'religion'),
    ('BUDPC', 'buddhism', 'Bouddhisme', 'Buddhism', '#b49c3c', 'dharma-wheel', 'religion'),
    ('BSYNPC', 'buddhist-syncretic', 'Traditions syncrétiques bouddhiques', 'Buddhist syncretic traditions', '#aaa573', 'dharma-wheel', 'aggregate'),
    ('EACPC', 'eac-aggregate', 'Traditions d’Asie orientale (agrégat)', 'East Asian traditions (aggregate)', '#89a2a4', 'yin-yang', 'aggregate'),
    ('INDPC', 'indigenous-aggregate', 'Traditions autochtones (agrégat)', 'Indigenous traditions (aggregate)', '#8484b4', 'earth', 'aggregate'),
    ('NEWPC', 'new-religions-aggregate', 'Nouveaux mouvements religieux (agrégat RCS)', 'New religious movements (RCS aggregate)', '#b58678', 'star', 'aggregate'),
    ('NREPC', 'unaffiliated', 'Sans affiliation religieuse', 'Religiously unaffiliated', '#8b919a', 'circle', 'unaffiliated'),
    ('OREPC', 'broad-other', 'Autres religions non classées', 'Other unclassified religions', '#a09280', 'circle', 'aggregate'),
]
COLUMNS = ['CCODE', 'ABBREV', 'ISO3', 'YEAR'] + [group[0] for group in GROUPS] + ['UNKPC']
METHOD_NOTE = {
    'fr': 'Estimation annuelle RCS : la série combine des sources et des interpolations ou extrapolations. Il ne s’agit pas nécessairement d’un recensement de cette année. Aucune interpolation supplémentaire. Les parts absentes restent inconnues ; les agrégats suivent la nomenclature RCS.',
    'en': 'Annual RCS estimate: the series combines sources with interpolation or extrapolation. It is not necessarily a census for this year. No additional interpolation. Missing shares remain unknown; aggregates follow the RCS classification.',
}


def read_json(path: Path):
    return json.loads(path.read_text())


def render(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n'


def download(url: str, path: Path, expected_hash: str | None = None) -> Path:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={'User-Agent': 'HistoryOfAtlas/1.0 (reproducible source ingestion)'})
        with urllib.request.urlopen(request, timeout=90) as response:
            payload = response.read()
        path.write_bytes(payload)
    if expected_hash and hashlib.sha256(path.read_bytes()).hexdigest() != expected_hash:
        raise ValueError(f'Unexpected source checksum: {path}')
    return path


def workbook_rows(path: Path):
    """Read cached XLSX cell coordinates, preserving absent cells as unknown."""
    namespace = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(path) as workbook:
        strings = [''.join(item.itertext()).strip() for item in ET.fromstring(workbook.read('xl/sharedStrings.xml')).findall('s:si', namespace)]
        headers = {}
        with workbook.open('xl/worksheets/sheet1.xml') as worksheet:
            for _, element in ET.iterparse(worksheet, events=('end',)):
                if not element.tag.endswith('}row'):
                    continue
                row = {}
                for cell in element:
                    column = re.sub(r'\d', '', cell.attrib.get('r', ''))
                    value = cell.find('s:v', namespace)
                    if value is None:
                        continue
                    content = strings[int(value.text)] if cell.attrib.get('t') == 's' else value.text
                    if element.attrib['r'] == '1':
                        headers[column] = content.strip()
                    elif headers.get(column) in COLUMNS:
                        key = headers[column]
                        row[key] = content if key in ('ABBREV', 'ISO3') else float(content)
                if row:
                    yield row
                element.clear()


def matching_mapping(row: dict, mappings: list[dict]) -> dict | None:
    matches = [mapping for mapping in mappings
               if str(int(row['CCODE'])) == str(mapping['ccode'])
               and row.get('ABBREV') == mapping['sourceAbbrev']
               and (row.get('ISO3') or '') == mapping['sourceIso3']
               and mapping['fromYear'] <= row['YEAR'] <= mapping['toYear']]
    if len(matches) > 1:
        raise ValueError(f'Overlapping reviewed RCS mappings for {row["CCODE"]}/{row["YEAR"]}')
    return matches[0] if matches else None


def shares_from_row(row: dict) -> list[dict]:
    """Never normalize, fabricate residual shares, or treat unknown as zero."""
    values = []
    for column, tradition_id, *_ in GROUPS:
        value = row.get(column)
        if value is None:
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 or value > 100:
            raise ValueError(f'Invalid percentage {column}: {value}')
        values.append({'traditionId': tradition_id, 'share': value / 100})
    if not any(item['share'] > 0 for item in values):
        raise ValueError('No known religious-composition shares')
    unknown = row.get('UNKPC')
    if unknown is not None and (not isinstance(unknown, (int, float)) or not math.isfinite(unknown) or unknown < 0 or unknown > 100):
        raise ValueError(f'Invalid unknown percentage: {unknown}')
    if unknown is not None and sum(item['share'] for item in values) + unknown / 100 > 1.01:
        raise ValueError('Known plus unknown shares exceed 101%')
    if sum(item['share'] for item in values) > 1.01:
        raise ValueError('Shares exceed 101%; no automatic renormalization')
    if sum(item['share'] > .5 for item in values) > 1:
        raise ValueError('Several families exceed 50%; overlapping classification')
    return values


def reviewed_geometry(mapping: dict, features: dict) -> dict:
    """Select or combine only explicitly reviewed polygons from the pinned file."""
    parts = mapping.get('geometryParts') or [{'adm0A3': mapping['geometryAdm0A3']}]
    polygons = []
    for part in parts:
        geometry = features[part['adm0A3']]['geometry']
        source_polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
        indices = part.get('polygonIndices', list(range(len(source_polygons))))
        excluded = part.get('excludePolygonIndices', [])
        if any(type(index) is not int or not 0 <= index < len(source_polygons) for index in indices + excluded):
            raise ValueError('Reviewed geometry polygon index is absent from the pinned file')
        polygons.extend(source_polygons[index] for index in indices if index not in excluded)
    if not polygons:
        raise ValueError('Reviewed geometry has no polygons')
    return {'type': 'MultiPolygon', 'coordinates': polygons}


def acquire_extract(mappings: list[dict]) -> dict:
    workbook = download(WORKBOOK_URL, RAW / 'rcsdem2-download.xlsx', WORKBOOK_SHA256)
    geometry_path = download(NE_URL, RAW / 'ne_50m_admin_0_countries.geojson', NE_SHA256)
    features = {feature['properties']['ADM0_A3']: feature for feature in read_json(geometry_path)['features']}
    geometries = {}
    for mapping in mappings:
        source_id = (mapping.get('geometryParts') or [{'adm0A3': mapping['geometryAdm0A3']}])[0]['adm0A3']
        properties = features[source_id]['properties']
        geometry = {'adm0A3': mapping['geometryAdm0A3'],
                    'name': mapping.get('name', {'fr': properties['NAME_FR'], 'en': properties['NAME_EN']}),
                    'geometry': reviewed_geometry(mapping, features)}
        key = mapping['geometryAdm0A3']
        if key in geometries and geometry != geometries[key]:
            raise ValueError(f'Conflicting reviewed geometry definitions for {key}')
        geometries[key] = geometry
    selected_geometries = [geometries[key] for key in sorted(geometries)]
    rows = [row for row in workbook_rows(workbook) if matching_mapping(row, mappings)]
    return {
        'version': 1,
        'source': {'url': WORKBOOK_URL, 'sha256': WORKBOOK_SHA256, 'license': 'ARDA data use terms', 'licenseUrl': TERMS_URL,
                   'citation': 'Brown, Davis, and Patrick James. Religious Characteristics of States Dataset Project: Demographics v. 2.0. ARDA, 2019. https://doi.org/10.17605/OSF.IO/7SR4M',
                   'modifications': 'Selected reviewed country-years and non-nested major-family percentage columns. No new estimates or interpolation.'},
        'geometrySource': {'url': NE_URL, 'sha256': NE_SHA256, 'revision': NE_COMMIT,
                           'extractedSha256': hashlib.sha256(render(selected_geometries).encode()).hexdigest()},
        'columns': COLUMNS,
        'rows': [[row.get(column) for column in COLUMNS] for row in rows],
        'geometries': selected_geometries,
    }


def build(extract: dict, mappings: list[dict], common_traditions: list[dict] | None = None) -> tuple[dict, list[dict]]:
    geometries = {geometry['adm0A3']: geometry for geometry in extract['geometries']}
    observations, rejected, used_geometries = [], [], set()
    seen = set()
    for values in extract['rows']:
        row = dict(zip(extract['columns'], values))
        mapping = matching_mapping(row, mappings)
        if not mapping:
            continue
        ccode, year = str(int(row['CCODE'])), int(row['YEAR'])
        key = f'rcs-{ccode}-{year}'
        if key in seen:
            raise ValueError(f'Duplicate RCS snapshot: {key}')
        seen.add(key)
        geometry_id = mapping['geometryAdm0A3']
        if geometry_id not in geometries:
            raise ValueError(f'No source geometry for {geometry_id}; refresh the extract')
        try:
            shares = shares_from_row(row)
        except ValueError as error:
            rejected.append({'ccode': ccode, 'year': year, 'reason': str(error)})
            continue
        used_geometries.add(geometry_id)
        observations.append({
            'id': key, 'regionId': f'rcs-{ccode}',
            'name': mapping.get('name', geometries[geometry_id]['name']),
            'geometryId': f'rcs-ne-{geometry_id}', 'time': {'kind': 'snapshot', 'year': year},
            'populationScope': mapping['populationScope'], 'shares': shares,
            'sourceIds': [SOURCE_ID, 'rcs-dem-2-0-codebook'], 'note': METHOD_NOTE,
        })
    common = {tradition['id']: tradition for tradition in (common_traditions or [])}
    traditions = []
    for item in GROUPS:
        if item[1] in common:
            tradition = {key: common[item[1]][key] for key in ('id', 'names', 'color', 'symbol')}
            tradition['kind'] = 'religion'
        else:
            tradition = {'id': item[1], 'names': {'fr': item[2], 'en': item[3]}, 'color': item[4], 'symbol': item[5], 'kind': item[6]}
        traditions.append(tradition)
    output = {
        'version': 1, 'snapshotMaxAge': 15,
        'traditions': traditions,
        'sources': [
            {'id': SOURCE_ID, 'title': 'RCS-Dem 2.0 · religious composition estimates', 'url': 'https://www.thearda.com/data-archive?fid=RCSDEM2&tab=1', 'license': extract['source']['license'], 'licenseUrl': TERMS_URL, 'citation': extract['source']['citation']},
            {'id': 'rcs-dem-2-0-codebook', 'title': 'RCS-Dem 2.0 · codebook, methods and territorial coverage (Appendix A)', 'url': CODEBOOK_URL, 'license': 'ARDA data use terms', 'licenseUrl': TERMS_URL},
            {'id': GEOMETRY_SOURCE_ID, 'title': 'Natural Earth · reviewed country geometry', 'url': NE_URL, 'license': 'Public domain', 'licenseUrl': 'https://www.naturalearthdata.com/about/terms-of-use/'},
        ],
        'geometries': [{'id': f'rcs-ne-{key}', 'geometry': geometries[key]['geometry'], 'sourceIds': [GEOMETRY_SOURCE_ID]} for key in sorted(used_geometries)],
        'observations': observations,
    }
    return output, rejected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--acquire', action='store_true', help='Refresh selected source extract from pinned original files')
    parser.add_argument('--check', action='store_true', help='Verify committed fragment matches the offline rebuild')
    args = parser.parse_args()
    if args.acquire and args.check:
        parser.error('--acquire and --check cannot be combined')
    mappings = read_json(MAPPINGS)['mappings']
    if args.acquire:
        EXTRACT.write_text(render(acquire_extract(mappings)))
    common_traditions = read_json(ROOT / 'public/data/religions/history.json')['traditions']
    extract = read_json(EXTRACT)
    if hashlib.sha256(render(extract['geometries']).encode()).hexdigest() != extract['geometrySource']['extractedSha256']:
        raise SystemExit('Selected source geometry checksum does not match provenance')
    output, rejected = build(extract, mappings, common_traditions)
    payload = render(output)
    counts = Counter(row['time']['year'] for row in output['observations'])
    report = render({'version': 1, 'sourceRows': len(extract['rows']), 'snapshots': len(output['observations']),
                     'regions': len({row['regionId'] for row in output['observations']}), 'geometries': len(output['geometries']),
                     'firstYear': min(counts, default=None), 'lastYear': max(counts, default=None),
                     'snapshotsByYear': dict(sorted(counts.items())), 'rejectedCount': len(rejected), 'rejected': rejected,
                     'sourceSha256': extract['source']['sha256'], 'naturalEarth': extract['geometrySource']})
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != payload:
            raise SystemExit(f'{OUTPUT.relative_to(ROOT)} is stale; run python3 pipeline/religions/rcs.py')
        if not REPORT.exists() or REPORT.read_text() != report:
            raise SystemExit(f'{REPORT.relative_to(ROOT)} is stale; run python3 pipeline/religions/rcs.py')
    else:
        OUTPUT.write_text(payload)
        REPORT.write_text(report)
    RAW.mkdir(parents=True, exist_ok=True)
    (RAW / 'rcs-rejected-rows.json').write_text(render(rejected))
    years = [row['time']['year'] for row in output['observations']]
    print(f'RCS: {len(output["observations"])} snapshots, {len(output["geometries"])} geometries, years {min(years) if years else "none"}–{max(years) if years else "none"}; {len(rejected)} inconsistent rows excluded.')


if __name__ == '__main__':
    main()
