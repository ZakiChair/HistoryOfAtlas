#!/usr/bin/env python3
"""Norwegian discovered fields/deposits, independent from production status."""
import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = 'sodir-discoveries-2026'
BASE = 'https://factmaps.sodir.no/api/rest/services/DataService/Data/FeatureServer/'


def fuels(value):
    # Condensate is not relabelled as crude oil.
    return [category for token, category in [('OIL', 'oil'), ('GAS', 'gas')] if token in (value or '').split('/')]


def evidence(row, prefix):
    year = row.get(prefix + 'DiscoveryYear')
    categories = fuels(row.get(prefix + 'HcType'))
    if not categories or not isinstance(year, int) or not 1800 <= year <= 2026:
        return None
    return {'fromYear': year, 'kind': 'discovery', 'categories': categories,
            'sourceUrl': row[prefix + 'FactPageUrl'],
            'description': 'Discovery year and hydrocarbon type published by the Norwegian Offshore Directorate. This establishes a discovered resource, not commercial production or remaining recoverable reserves. Condensate is not counted as crude oil.'}


def build():
    manifest = json.loads((ROOT / 'sources/sodir-known-manifest.json').read_text())
    data = {}
    for entry in manifest['files']:
        raw = (ROOT / 'sources' / entry['file']).read_bytes()
        if hashlib.sha256(raw).hexdigest() != entry['sha256']:
            raise ValueError('SODIR discovery archive checksum mismatch')
        parsed = json.loads(gzip.decompress(raw))
        if parsed.get('error') or parsed.get('exceededTransferLimit') or len(parsed['features']) != entry['records']:
            raise ValueError('Incomplete SODIR discovery archive')
        data[entry['file'].split('-')[-1].split('.')[0]] = parsed['features']
    wells = {f['attributes']['wlbNpdidWellbore']: f for f in data['wells']}

    def position(feature):
        center = feature.get('centroid')
        if center:
            return [center['x'], center['y']], BASE + ('7100' if 'fldDiscoveryYear' in feature['attributes'] else '7000')
        well = wells.get(feature['attributes'].get('wlbNpdidWellbore'))
        if well and well.get('geometry'):
            return [well['geometry']['x'], well['geometry']['y']], well['attributes']['wlbFactPageUrl']
        return None, None

    # These exact official field IDs are already supplied by the production normalizer.
    producing = {str(row['id']) for row in json.loads(gzip.decompress((ROOT / 'sources/sodir-production.json.gz').read_bytes())) if row['oil'] > 0 or row['gas'] > 0}
    existing_positions = {str(row['id']) for row in json.loads(gzip.decompress((ROOT / 'sources/sodir-fields.json.gz').read_bytes())) if row['longitude'] is not None and row['latitude'] is not None}
    existing = producing & existing_positions
    sites, updates, audit, omitted = {}, collections.defaultdict(list), [], []
    fields = {f['attributes']['fldNpdidField']: f for f in data['fields']}
    discoveries = {f['attributes']['dscNpdidDiscovery']: f for f in data['discoveries']}

    def add(identifier, name, feature, item, present=False):
        if present:
            updates[identifier].append(item)
            return True
        coordinates, coordinate_url = position(feature)
        if not coordinates:
            return False
        site = sites.setdefault(identifier, {'id': identifier, 'name': name, 'coordinates': coordinates,
            'country': 'Norway', 'categories': [], 'sourceId': SOURCE, 'sourceYear': 2026,
            'sourceUrl': item['sourceUrl'], 'coordinateSourceUrl': coordinate_url, 'accuracy': 'approximate',
            'periods': [], 'knowledge': []})
        site['knowledge'].append(item)
        site['categories'] = list(dict.fromkeys(site['categories'] + item['categories']))
        return True

    for identifier, feature in fields.items():
        row = feature['attributes']
        item = evidence(row, 'fld')
        if item:
            add(f'sodir:{identifier}', row['fldName'], feature, item, str(identifier) in existing)

    for identifier, feature in discoveries.items():
        row = feature['attributes']
        item = evidence(row, 'dsc')
        if not item:
            omitted.append({'id': identifier, 'reason': 'Missing explicit hydrocarbon type or valid discovery year'})
            continue
        anchor = feature
        visited = {identifier}
        while not anchor['attributes'].get('fldNpdidField'):
            parent = anchor['attributes'].get('dscNpdidResInclInDisc')
            if not parent or parent not in discoveries or parent in visited:
                break
            visited.add(parent)
            anchor = discoveries[parent]
        field_id = anchor['attributes'].get('fldNpdidField')
        if field_id in fields:
            target = f'sodir:{field_id}'
            success = add(target, fields[field_id]['attributes']['fldName'], fields[field_id], item, str(field_id) in existing)
        else:
            parent_id = anchor['attributes']['dscNpdidDiscovery']
            target = f'sodir-discovery:{parent_id}'
            success = add(target, anchor['attributes']['dscName'], anchor, item)
        (audit if success else omitted).append({'discoveryId': identifier, 'siteId': target,
            'discoveryYear': item['fromYear'], 'officialStatus': row['dscCurrentActivityStatus'],
            'reason': 'Grouped by explicit official field/included-discovery identifier' if success else 'No official centroid or discovery-well position'})

    source = {'id': SOURCE, 'name': 'Norwegian Offshore Directorate — discovered fields and deposits, September 2026',
        'url': 'https://factpages.sodir.no/en/discovery/TableView/Overview', 'year': 2026,
        'license': 'Norwegian Licence for Open Government Data (NLOD) 2.0', 'licenseUrl': 'https://data.norge.no/nlod/en/2.0',
        'description': 'Dated discoveries, including unproduced and abandoned deposits. Official discovery/field IDs reconcile children; centroids or explicitly linked discovery wells supply approximate locations. Production remains an independent dataset; no activity is inferred from discovery.'}
    return {'sources': [source], 'sites': sorted(sites.values(), key=lambda s: s['id']),
        'knowledgeGroups': [{'sourceId': SOURCE, 'updates': [{'siteId': key, 'knowledge': value} for key, value in sorted(updates.items())]}],
        'audit': audit, 'omitted': omitted}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = build()
    content = json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n'
    path = ROOT / 'sodir-discoveries.json'
    if args.check:
        if path.read_text() != content:
            raise SystemExit('SODIR discovery contribution differs from deterministic build')
    else:
        path.write_text(content)
    print(f"SODIR discoveries: {len(result['sites'])} new sites, {len(result['knowledgeGroups'][0]['updates'])} field updates, {len(result['omitted'])} omissions")
