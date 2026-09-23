#!/usr/bin/env python3
"""Build dated national producing-mine registers; retain explicit status uncertainty."""
import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
CANADA_URL = 'https://open.canada.ca/data/en/dataset/000183ed-8864-42f0-ae43-c4313a860720'
AUSTRALIA_URL = 'https://services.ga.gov.au/gis/rest/services/AustralianOperatingMines/MapServer/0'
CANADA_CATEGORIES = {
    'gold': 'gold', 'silver': 'silver', 'iron': 'iron', 'nickel': 'nickel', 'copper': 'copper',
    'platinum group metals': 'platinum-group', 'cobalt': 'cobalt', 'selenium': 'selenium',
    'tellurium': 'tellurium', 'uranium': 'uranium', 'zinc': 'zinc', 'titanium': 'titanium',
    'scandium': 'scandium', 'niobium': 'niobium', 'lithium': 'lithium', 'indium': 'indium',
    'cesium': 'cesium', 'tantalum': 'tantalum', 'molybdenum': 'molybdenum', 'lead': 'lead',
    'salt': 'salt', 'potash': 'potash', 'diamonds': 'diamond', 'graphite': 'graphite', 'barite': 'barium',
}
AUSTRALIA_GROUPS = {
    'Precious metals - Au, Ag': ['gold'],
    'Base metals - Cu (Zn, Pb, Mo, Ag, Au)': ['copper'],
    'Base metals - Zn, Pb (Cu, Ag)': ['zinc', 'lead'],
    'Heavy mineral sands - Ti, Zr': ['mineral-sands'],
    'Heavy mineral sands - Ti, Zr, REE': ['mineral-sands'],
    'Bauxite': ['bauxite'], 'Magnesium': ['magnesium'], 'Manganese': ['manganese'],
    'Battery/alloy metals - Li, Ta': ['lithium'],
    'Battery/alloy metals - Ni (Co, Cu, PGE, Sc)': ['nickel'],
    'Uranium': ['uranium'], 'Rare earth elements': ['rare-earths'],
    'Base metals - Cu, Au, U, Ag': ['copper', 'gold', 'uranium', 'silver'],
}


def canadian_categories(properties):
    if not re.search(r'open-pit|underground|solution mining|borehole mining', properties.get('facilities_code_en_spelt', ''), re.I):
        return []
    products = re.sub(r'\([^)]*\)', '', properties.get('product_en_spelt', '')).lower().split(',')
    return list(dict.fromkeys(CANADA_CATEGORIES[value.strip()] for value in products if value.strip() in CANADA_CATEGORIES))


def australian_categories(properties):
    if properties.get('status') != 'Operating mine':
        return []
    return AUSTRALIA_GROUPS.get(properties.get('commodity_group'), [])


def build():
    manifest = json.loads((ROOT / 'sources/national-mining-manifest.json').read_text())
    reviews = json.loads((ROOT / 'national-mining-reviews.json').read_text())
    matches = {match['registryId']: match for match in reviews['matches']}
    overrides = {item['registryId']: item for item in reviews.get('categoryOverrides', [])}
    excluded = {item['registryId'] for item in reviews.get('exclusions', [])}
    sites, audit, omissions = [], [], collections.Counter()
    updates = {'national-canada-2026': collections.defaultdict(list), 'national-australia-2026': collections.defaultdict(list)}
    for file in manifest['files']:
        raw = (ROOT / 'sources' / file['file']).read_bytes()
        if hashlib.sha256(raw).hexdigest() != file['sha256']:
            raise ValueError(f"National register checksum mismatch: {file['file']}")
        features = json.loads(gzip.decompress(raw))['features']
        if len(features) != file['records']:
            raise ValueError('National register row count changed')
        australia = 'australia' in file['file']
        country, source = ('Australia', 'national-australia-2026') if australia else ('Canada', 'national-canada-2026')
        for feature in features:
            row = feature['properties']
            identifier = f"{'ga-operating' if australia else 'nrcan-producing'}:{row.get('objectid', row.get('OBJECTID'))}"
            categories = australian_categories(row) if australia else canadian_categories(row)
            override = overrides.get(identifier)
            if override:
                categories = override['categories']
            if not categories or identifier in excluded:
                omissions['reviewed_exclusion' if identifier in excluded else 'unsupported_or_non_extraction'] += 1
                continue
            name = row['name'] if australia else row['operation_name_en']
            position = feature['geometry']['coordinates'][:2]
            url = AUSTRALIA_URL if australia else CANADA_URL
            period = {'fromYear': 2025 if australia else 2026, 'toYear': 2026,
                      'categories': categories, 'sourceUrl': url, 'approximate': True,
                      'description': (
                          'Geoscience Australia classifies this site as an Operating mine in its December 2025 register, the latest national operating register retrieved in September 2026. The current-year view carries this last-known operating classification forward one year; activity on every day of 2026 is not independently verified. Development and care-and-maintenance layers are excluded. Categories in parentheses in the broad legend are not asserted as produced co-products.'
                          if australia else
                          'Natural Resources Canada principal producing sites, register updated February 2026. An extraction facility (open pit, underground, solution or borehole mining), with the commodities explicitly listed as products. Processing-only sites and exploration projects are excluded. This is a current operating-register snapshot, not an opening date or proof of uninterrupted daily extraction.'
                      )}
            if override:
                period['description'] += ' Commodity review: ' + override['reason'] + ' ' + override['sourceUrl']
            if identifier in matches:
                site_id = matches[identifier]['siteId']
                # Observation appending accepts discrete years, not invented lifetimes.
                for year in range(period['fromYear'], period['toYear'] + 1):
                    updates[source][site_id].append({**period, 'fromYear': year, 'toYear': year})
            else:
                site_id = identifier
                sites.append({'id': site_id, 'name': name.strip(), 'coordinates': position, 'country': country,
                              'categories': categories, 'sourceId': source, 'sourceYear': 2026,
                              'sourceUrl': url, 'coordinateSourceUrl': url, 'accuracy': 'approximate',
                              'periods': [period]})
            audit.append({'registryId': identifier, 'siteId': site_id, 'name': name, 'country': country,
                          'status': row.get('status', 'Principal producing site'),
                          'facilityType': row.get('facilities_code_en_spelt'),
                          'publishedProducts': row.get('product_en_spelt', row.get('commodity_group')),
                          'coordinateSource': file['url'], 'registryYear': file['observedYear']})
    sources = [
        {'id': 'national-canada-2026', 'name': 'Natural Resources Canada — principal producing mines, February 2026',
         'url': CANADA_URL, 'year': 2026, 'license': 'Open Government Licence — Canada',
         'licenseUrl': 'https://open.canada.ca/en/open-government-licence-canada',
         'description': 'Adapted mine/concentrator layer, retaining explicit extraction facility types and produced commodities. Exploration and processing-only facilities are excluded.'},
        {'id': 'national-australia-2026', 'name': 'Geoscience Australia — Operating Mines 2025, latest status reviewed September 2026',
         'url': AUSTRALIA_URL, 'year': 2026, 'license': 'CC BY 4.0',
         'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
         'description': 'Latest known December 2025 operating classification retained for the current 2026 view, explicitly approximate. Does not independently verify daily 2026 activity. Developing and care-and-maintenance sites excluded; only unambiguous commodity groups retained. Coal/iron use dedicated, more recent trackers.'},
    ]
    return {'sources': sources, 'sites': sites,
            'observationGroups': [{'sourceId': key, 'updates': [{'siteId': identifier, 'periods': periods} for identifier, periods in sorted(value.items())]} for key, value in updates.items()],
            'audit': audit, 'omissions': dict(omissions)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = build()
    content = json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n'
    path = ROOT / 'national-mining.json'
    if args.check:
        if path.read_text() != content:
            raise SystemExit('National mining contribution differs from its deterministic build')
    else:
        path.write_text(content)
    print(f"National registers: {len(result['sites'])} new sites, {len(result['audit'])} accepted rows")


if __name__ == '__main__':
    main()
