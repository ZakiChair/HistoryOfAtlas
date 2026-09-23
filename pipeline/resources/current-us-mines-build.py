#!/usr/bin/env python3
"""Build a qualified USGS 2026 mine snapshot from frozen attributed rows.

The USGS release has no coordinates. Positions require a separately reviewed
name/state match; ICMM is only a location reference, never evidence of activity.
"""
import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE_ID = 'usgs-current-us-2026'
SOURCE_URL = 'https://doi.org/10.5066/P1BUPUAM'
CATEGORIES = {
    'Gold': 'gold', 'Silver': 'silver', 'Copper': 'copper',
    'Molybdenum': 'molybdenum', 'Zinc': 'zinc', 'Lead': 'lead',
    'Phosphate Rock': 'phosphate', 'Uranium': 'uranium', 'Iron Ore': 'iron',
    'Barite': 'barium', 'Potash': 'potash', 'Titanium': 'titanium',
    'Selenium': 'selenium', 'Tellurium': 'tellurium',
    'Palladium': 'palladium', 'Platinum': 'platinum', 'Nickel': 'nickel',
    'Magnesium': 'magnesium', 'Fluorspar': 'fluorite', 'Lithium': 'lithium',
    'Rare earths': 'rare-earths', 'Boron': 'boron', 'Cobalt': 'cobalt',
    'Antimony': 'antimony', 'Vanadium': 'vanadium',
}


def build(check=False):
    manifest = json.loads((ROOT / 'sources/current-us-mines-manifest.json').read_text())
    raw = (ROOT / 'sources' / manifest['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == manifest['sha256'], 'Snapshot checksum mismatch'
    rows = json.loads(gzip.decompress(raw))
    assert len(rows) == manifest['records']
    reviews = json.loads((ROOT / 'current-us-mines-reviews.json').read_text())
    matches = {row['facilityId']: row for row in reviews['coordinateMatches']}
    excluded = {row['name']: row for row in reviews['exclusions']}
    grouped = collections.defaultdict(list)
    for row in rows:
        assert row['datasetId'] == 'usgs-p1bupuam-2026'
        assert row['datasetVersion'] == '2026-06-29'
        assert row['publishedYear'] == 2026
        assert row['facilityStatus'] == 'Assumed active'
        assert row['featureType'] == 'Mines and Quarries'
        grouped[row['facilityId']].append(row)
    sites, audit, omitted, updates = [], [], [], []
    for facility, records in sorted(grouped.items()):
        row = records[0]
        categories = sorted({CATEGORIES[r['mineral']] for r in records if r['mineral'] in CATEGORIES})
        match = matches.get(facility)
        exclusion = excluded.get(row['facilityName'])
        if exclusion or not categories or not match:
            omitted.append({'facilityId': facility, 'name': row['facilityName'],
                            'reason': exclusion['reason'] if exclusion else
                            ('No supported extracted commodity' if not categories else 'No unambiguous reviewed coordinate match'),
                            **({'sourceUrl': exclusion['sourceUrl']} if exclusion else {})})
            continue
        assert match['state'] == row['state'] and match['name'] == row['facilityName']
        assert len(match['coordinates']) == 2
        period = {'fromYear': 2026, 'toYear': 2026, 'sourceUrl': SOURCE_URL,
                  'categories': categories, 'approximate': True,
                  'description': 'Activité présumée par l’USGS (statut « Assumed active »), registre publié le 29 juin 2026. '
                                 'Il s’agit d’un état administratif présumé, pas d’une mesure de production en 2026 '
                                 'ni d’une preuve d’exploitation ininterrompue. Les fermetures ou suspensions identifiées '
                                 'par des sources primaires vérifiées sont exclues. / USGS assumed-active mine snapshot; '
                                 'actual annual production and continuous operation are not independently verified.'}
        identifier = 'current-us:' + facility
        if match.get('matchedSiteId'):
            updates.append({'siteId': match['matchedSiteId'], 'periods': [period]})
        else:
            sites.append({'id': identifier, 'name': row['facilityName'], 'coordinates': match['coordinates'],
                          'categories': categories, 'country': 'United States', 'sourceId': SOURCE_ID,
                          'sourceUrl': SOURCE_URL, 'sourceYear': 2026,
                          'coordinateSourceUrl': match['coordinateSourceUrl'],
                          'accuracy': 'approximate', 'periods': [period]})
        audit.append({'id': identifier, 'name': row['facilityName'], 'mode': 'observations',
                      **({'matchedSiteId': match['matchedSiteId']} if match.get('matchedSiteId') else {}),
                      'facilityId': facility, 'status': row['facilityStatus'], 'state': row['state'],
                      'recordIds': [r['id'] for r in records], 'sourceRows': [r['sourceRow'] for r in records],
                      'sourceMinerals': sorted({r['mineral'] for r in records}),
                      'omittedMinerals': sorted({r['mineral'] for r in records if r['mineral'] not in CATEGORIES}),
                      'coordinateEvidence': match, 'retrievedThrough': manifest['mirror']})
    result = {'sources': [{'id': SOURCE_ID,
                          'name': 'USGS — United States mines, 2026 assumed-active register',
                          'url': SOURCE_URL, 'year': 2026, 'license': 'CC0 1.0',
                          'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
                          'description': 'Qualified USGS operating-status snapshot. Only mines/quarries with supported commodities and reviewed independent coordinates are included; processing-only facilities are excluded. '
                                         + manifest['provenanceLimitation']}],
              'sites': sites, 'observationGroups': [{'sourceId': SOURCE_ID, 'updates': updates}],
              'audit': audit, 'omitted': omitted}
    target = ROOT / 'current-us-mines.json'
    serialized = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if check:
        if not target.exists() or target.read_text() != serialized:
            raise SystemExit('Current US mine contribution is stale; rebuild it first.')
    else:
        target.write_text(serialized)
    print(json.dumps({'sites': len(sites), 'updates': len(updates), 'omitted': len(omitted),
                      'categories': dict(collections.Counter(c for s in sites for c in s['categories']))}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify the frozen contribution without writing it.')
    build(parser.parse_args().check)
