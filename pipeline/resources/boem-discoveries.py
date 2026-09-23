#!/usr/bin/env python3
"""Reproduce BOEM field-discovery contribution with the Python standard library."""
import argparse
import csv
import gzip
import hashlib
import io
import json
import math
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent
SOURCE_ID = 'boem-fields-2026'
DIRECTORY = 'https://www.boem.gov/oil-gas-energy/resource-evaluation/ocs-operations-field-directory'
HISTORY = 'https://www.boem.gov/oil-gas-energy/resource-evaluation/reserve-history-fields'
PRODUCTION = 'https://www.data.boem.gov/Main/HtmlPage.aspx?page=fieldNames2'
URLS = {
    'tables-2023.zip': 'https://www.data.boem.gov/FieldReserves/Files/2023%20Tables%20xlsx%20Public.zip',
    'mastproddelimit.zip': 'https://www.data.boem.gov/FieldReserves/Files/mastproddelimit.zip',
    'appendcdelimit.zip': 'https://www.data.boem.gov/FieldReserves/Files/appendcdelimit.zip',
}
FIELD = re.compile(r'^[A-Z]{2,3}\d{3,4}[A-Z]?$')
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
DISTINCT_DISCOVERIES = {
    'L100000320716': {
        'reason': 'GEM identifies Mad Dog Southwest as a separate phase without a published discovery date. A shared parent-field code does not establish when the phase-specific resource was discovered; retain its independent GEM evidence.',
        'sourceUrl': 'https://www.gem.wiki/Mad_Dog_Southwest_(GC826)_-_BP_Oil_and_Gas_Phase_(Federal_offshore,_United_States)',
    },
    'L100000319539': {
        'reason': 'Shenzi North is a separate Greater Wildling discovery dated 2017, not the producing Shenzi field discovered in 2002; Woodside registration statement, page 194.',
        'sourceUrl': 'https://www.woodside.com/docs/default-source/asx-announcements/2022/woodside-files-us-registration-statement.pdf?sfvrsn=744ccb93_3',
    },
    'L100000318900': {
        'reason': 'LLOG dates the distinct Spruance discovery to mid-2019, initially at EW877 followed by an EW921 delineation well in 2020. The BOEM EW921 historical code begins in 1989; its later Spruance nickname cannot backdate that discovery.',
        'sourceUrl': 'https://www.globenewswire.com/news-release/2020/10/26/2114601/0/en/LLOG-Exploration-Announces-Discovery-at-Spruance-and-Development-Plans-for-the-Field.html',
    },
}


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def csv_zip(data):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        member = next(name for name in archive.namelist() if name.lower().endswith('.txt'))
        return list(csv.reader(io.StringIO(archive.read(member).decode('latin1'))))


def number(value):
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (ValueError, TypeError):
        return None


def acquire(source_dir, positions_path):
    source_dir.mkdir(parents=True, exist_ok=True)
    files = {}
    sources = []
    manifest_path = ROOT / 'sources/boem-manifest.json'
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else None
    for filename, url in URLS.items():
        path = source_dir / ('hoa-boem-' + filename)
        if not path.exists():
            path.write_bytes(urllib.request.urlopen(url, timeout=120).read())
        data = path.read_bytes()
        if previous:
            expected = next(item for item in previous['sources'] if item['file'] == filename)
            if digest(data) != expected['sha256']:
                raise ValueError('BOEM archive differs from reviewed snapshot: ' + filename)
        files[filename] = data
        sources.append({'file': filename, 'url': url, 'sha256': digest(data)})
    with zipfile.ZipFile(io.BytesIO(files['tables-2023.zip'])) as archive:
        workbook = archive.read(next(name for name in archive.namelist() if name.endswith('.xlsx')))
    with zipfile.ZipFile(io.BytesIO(workbook)) as archive:
        shared = [''.join(item.itertext()) for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        table = ET.fromstring(archive.read('xl/worksheets/sheet8.xml'))
    fields = {}
    for row in table.findall('.//s:row', NS):
        cells = {}
        for cell in row:
            value = cell.find('s:v', NS)
            if value is not None:
                cells[re.sub(r'\d+', '', cell.attrib['r'])] = shared[int(value.text)] if cell.attrib.get('t') == 's' else value.text
        field = cells.get('B', '')
        if not FIELD.fullmatch(field):
            continue
        discovery = int(cells['E'])
        if not 1800 <= discovery <= 2023:
            raise ValueError(f'Unexpected discovery date: {field}: {discovery}')
        item = fields.setdefault(field, {'field': field, 'discoveryYear': discovery, 'historyRows': 0,
            'gasReservesPositive': False, 'crudeOilProductionPositive': False, 'aliases': []})
        if item['discoveryYear'] != discovery:
            raise ValueError(f'Conflicting discovery dates: {field}')
        item['historyRows'] += 1
        item['gasReservesPositive'] |= (number(cells.get('H')) or 0) > 0
    for row in csv_zip(files['mastproddelimit.zip']):
        if row[0] in fields:
            # Column 2 is crude oil. Column 3 is condensate, deliberately excluded.
            fields[row[0]]['crudeOilProductionPositive'] |= (number(row[2]) or 0) > 0
    for alias, field in csv_zip(files['appendcdelimit.zip']):
        if field in fields and alias.strip():
            fields[field]['aliases'].append(alias.strip())
    positions = json.loads(positions_path.read_text())
    if previous and digest(positions_path.read_bytes()) != previous['positionExtractSha256']:
        raise ValueError('BOEM positions differ from reviewed snapshot')
    if isinstance(positions, dict):
        positions = positions['positions']
    by_field = {position['field']: position for position in positions}
    for field, item in fields.items():
        item['aliases'] = sorted(set(item['aliases']))
        if field in by_field:
            item['position'] = by_field[field]
    data = encoded(sorted(fields.values(), key=lambda row: row['field']))
    output = ROOT / 'sources/boem-fields.json.gz'
    output.write_bytes(gzip.compress(data, mtime=0))
    manifest = {'downloadedAt': '2026-09-23', 'sources': sources,
        'positionExtractSha256': digest(positions_path.read_bytes()),
        'positionMethod': 'See boem-positions.py and boem-position-manifest.json; official Appendix A and Blocks DBF join followed by EPSG:4326 polygon centroid.',
        'extractFile': output.name, 'extractSha256': digest(data), 'fields': len(fields)}
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')


def distance(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, [*a, *b])
    d = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371 * 2 * math.asin(min(1, math.sqrt(d)))


def key(name):
    return re.sub('[^a-z0-9]', '', name.lower())


def build(fields, gem):
    names = {row['field'] for row in fields}
    by_field = {row['field']: row for row in fields}
    aliases = {}
    for field in fields:
        for alias in field['aliases']:
            aliases.setdefault(key(alias), set()).add(field['field'])
    positions = {row['field']: row['position']['coordinates'] for row in fields if 'position' in row}
    matches = {}
    rejected = []
    reviews = []
    for row in gem:
        if 'United States' not in row['country'] or row['accuracy'].lower() == 'country-level only':
            continue
        coords = [number(row['longitude']), number(row['latitude'])]
        if None in coords or not (-98 <= coords[0] <= -80 and 18 <= coords[1] <= 32):
            continue
        codes = set(re.findall(r'(?<![A-Z0-9])([A-Z]{2,3}\d{3,4}[A-Z]?)(?![A-Z0-9])', row['name'])) & names
        method = 'Explicit BOEM field code in GEM published unit name'
        if not codes:
            name = re.sub(r'\s*\([^()]*\)\s*$', '', row['name'])
            name = re.sub(r'\s+(Oil and Gas|Gas and Oil|Gas and Condensate|Oil|Gas) (Asset|Field|Pool|Phase)$', '', name)
            name = name.split(' - ')[0]
            possible = aliases.get(key(name), set())
            codes = {code for code in possible if code in positions and distance(coords, positions[code]) <= 25}
            method = 'Exact official Appendix C nickname and position within 25 km'
        if len(codes) != 1:
            if codes:
                rejected.append({'siteId': 'goget:' + row['id'], 'reason': 'Multiple explicit field identities', 'fields': sorted(codes)})
            continue
        field = next(iter(codes))
        if row['id'] in DISTINCT_DISCOVERIES:
            rejected.append({'siteId': 'goget:' + row['id'], 'field': field,
                'gemName': row['name'], **DISTINCT_DISCOVERIES[row['id']]})
            continue
        prefix = row['name'].split(' (')[0].split(' - ')[0]
        official_aliases = by_field[field]['aliases']
        if official_aliases and key(prefix) != key(field) and not any(
            key(alias) in key(prefix) or key(prefix) in key(alias) for alias in official_aliases
        ):
            rejected.append({'siteId': 'goget:' + row['id'], 'field': field, 'gemName': row['name'],
                'officialAliases': official_aliases,
                'reason': 'Named GEM discovery conflicts with official field nickname; a shared block code alone does not prove the same geological field.'})
            if row['id'] == 'L100000320669':
                reviews.append({'field': field, 'siteId': 'goget:' + row['id'], 'gemName': row['name'],
                    'distanceKm': round(distance(coords, positions[field]), 2), 'suggestedCoordinates': positions[field],
                    'coordinateSourceUrl': by_field[field]['position']['coordinateSourceUrl'],
                    'sourceUrl': 'https://investors.kosmosenergy.com/news-releases/news-release-details/kosmos-energy-ltd-oil-discovery-us-gulf-mexico',
                    'reason': 'Kosmos explicitly locates its separate 2023 Tiberius oil discovery in Keathley Canyon block 964. Its position can use this block centroid, but its discovery history must not be merged with the 2008 Hadrian South gas field.'})
            continue
        match = {'siteId': 'goget:' + row['id'], 'gemName': row['name'], 'method': method}
        if field in positions:
            match['distanceKm'] = round(distance(coords, positions[field]), 2)
        previous = matches.setdefault(field, {})
        previous[match['siteId']] = match
    source = {'id': SOURCE_ID, 'name': 'BOEM — Gulf of Mexico discovered oil and gas fields',
        'url': DIRECTORY, 'year': 2026, 'license': 'Public domain — U.S. federal government data',
        'licenseUrl': 'https://www.boem.gov/about-boem/copyright-restrictions-and-permissions',
        'description': 'Official field discovery years from the 2025 reserves release (data through 2023), joined to the 2026 field directory and BOEM block geometry. Gas is explicit in original gas reserves; crude oil requires positive oil production separately from condensate. This contribution records discovered accumulations, not current reserves or continuous production.'}
    sites, updates, audit, omitted = [], [], [], []
    for field in fields:
        code = field['field']
        categories = (['oil'] if field['crudeOilProductionPositive'] else []) + (['gas'] if field['gasReservesPositive'] else [])
        if not categories:
            omitted.append({'field': code, 'reason': 'No unambiguous crude oil or gas evidence'})
            continue
        knowledge = {'fromYear': field['discoveryYear'], 'kind': 'discovery', 'categories': categories,
            'sourceUrl': HISTORY, 'approximate': True,
            'description': f'BOEM field {code}: published field discovery year. The date applies to the geological field; separate reservoir/fuel discovery dates are not supplied. Gas is supported by positive original gas reserves; crude oil is included only when its separate production column is positive, excluding condensate. Discovery does not imply current production or remaining reserves.'}
        existing = sorted(matches.get(code, {}).values(), key=lambda row: row['siteId'])
        if existing:
            for match in existing:
                updates.append({'siteId': match['siteId'], 'knowledge': [knowledge]})
                if match.get('distanceKm', 0) > 50:
                    reviews.append({'field': code, **match, 'suggestedCoordinates': positions.get(code), 'reason': 'Exact field identity; existing GEM position exceeds 50 km from official named block'})
        elif 'position' in field:
            position = field['position']
            # EW921's later nickname Spruance is explicitly a 2019 discovery;
            # it must not label the older 1989 field-code record as Spruance.
            label = '' if code == 'EW921' else ' / '.join(field['aliases'][:2])
            sites.append({'id': 'boem:' + code, 'name': f'{label} ({code})' if label else f'{code} field',
                'coordinates': position['coordinates'], 'country': 'United States', 'categories': categories,
                'sourceId': SOURCE_ID, 'sourceYear': 2026, 'sourceUrl': HISTORY,
                'coordinateSourceUrl': position['coordinateSourceUrl'], 'accuracy': 'approximate', 'periods': [], 'knowledge': [knowledge]})
        else:
            omitted.append({'field': code, 'reason': 'No strict field-to-named-block-to-geometry match'})
        audit.append({'field': code, 'discoveryYear': field['discoveryYear'], 'categories': categories,
            'aliases': field['aliases'], 'matchedSites': existing,
            'positionMethod': 'Centroid of official named field block; the block is explicitly assigned to this field in Appendix A. Approximate field position, not reservoir boundary or exact discovery well.' if 'position' in field else None})
    return {'sources': [source], 'sites': sites, 'knowledgeGroups': [{'sourceId': SOURCE_ID, 'updates': updates}],
        'audit': audit, 'omitted': omitted, 'coordinateReviews': reviews, 'rejectedMatches': rejected}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--acquire', action='store_true', help='Explicitly refresh compact source extract from original BOEM archives and reviewed positions')
    parser.add_argument('--source-dir', type=Path, default=Path('/tmp'))
    parser.add_argument('--positions', type=Path, default=Path('/tmp/hoa-boem-field-positions.json'))
    parser.add_argument('--check', action='store_true', help='Offline: verify extract hash and exact generated contribution')
    args = parser.parse_args()
    if args.acquire:
        acquire(args.source_dir, args.positions)
    manifest = json.loads((ROOT / 'sources/boem-manifest.json').read_text())
    data = gzip.decompress((ROOT / 'sources/boem-fields.json.gz').read_bytes())
    if digest(data) != manifest['extractSha256']:
        raise ValueError('BOEM extract hash mismatch')
    gem = json.loads(gzip.decompress((ROOT / 'sources/goget.json.gz').read_bytes()))
    result = build(json.loads(data), gem)
    output = encoded(result)
    path = ROOT / 'boem-discoveries.json'
    if args.check:
        if path.read_bytes() != output:
            raise ValueError('BOEM contribution differs; run builder and review changes')
    else:
        path.write_bytes(output)
    print(json.dumps({'sites': len(result['sites']), 'updates': len(result['knowledgeGroups'][0]['updates']),
        'omitted': len(result['omitted']), 'coordinateReviews': len(result['coordinateReviews']), 'check': args.check}))


if __name__ == '__main__':
    main()
