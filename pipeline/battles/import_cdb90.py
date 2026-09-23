#!/usr/bin/env python3
"""Acquire a pinned CDB90 snapshot and import only explicitly reviewed whole battles."""
import argparse
import collections
import csv
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import urllib.request


ROOT = Path(__file__).resolve().parents[2]
CURATED = ROOT / 'data/curated'
MANIFEST = CURATED / 'battle-cdb90-source.json'
MATCHES = CURATED / 'battle-cdb90-matches.json'
PROFILES = CURATED / 'battle-cdb90-profiles.json'
REPORT = ROOT / 'data/reports/battle-cdb90-intake.json'


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def atomic_write(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
        handle.write(payload)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def validate_manifest(manifest):
    if manifest.get('version') != 1 or manifest.get('repository') != 'https://github.com/jrnold/CDB90':
        raise ValueError('Unsupported CDB90 source manifest')
    if not re.fullmatch(r'[0-9a-f]{40}', manifest.get('commit', '')):
        raise ValueError('The CDB90 source must be pinned to a full commit')
    if manifest.get('license') != 'ODC-BY-1.0' or not manifest.get('attribution'):
        raise ValueError('CDB90 attribution and revised-data license are required')
    resources = manifest.get('resources', [])
    seen = set()
    for resource in resources:
        path = resource.get('path', '')
        if not path or path in seen or Path(path).is_absolute() or '..' in Path(path).parts:
            raise ValueError(f'Invalid or duplicate resource path: {path}')
        seen.add(path)
        if not re.fullmatch(r'[0-9a-f]{64}', resource.get('sha256', '')):
            raise ValueError(f'Missing SHA-256 for {path}')
        if not isinstance(resource.get('bytes'), int) or resource['bytes'] <= 0:
            raise ValueError(f'Missing byte count for {path}')
    required = {'README.md', 'datapackage.json', 'data/battles.csv', 'data/belligerents.csv',
                'data/battle_durations.csv', 'data/active_periods.csv', 'data/enum_codead.csv',
                'src-data/M000121/README.TXT', 'src-data/M000121/CDB90DEF.csv'}
    if not required.issubset(seen):
        raise ValueError(f'Source definitions are missing: {sorted(required - seen)}')


def verify_resource(resource, payload):
    if len(payload) != resource['bytes'] or hashlib.sha256(payload).hexdigest() != resource['sha256']:
        raise ValueError(f"Pinned source checksum mismatch: {resource['path']}")


def acquire(manifest, cache, fetch=False):
    validate_manifest(manifest)
    for resource in manifest['resources']:
        path = cache / resource['path']
        if path.is_file():
            verify_resource(resource, path.read_bytes())
            continue
        if not fetch:
            raise ValueError(f'Missing source {path}; rerun with --fetch')
        url = f"https://raw.githubusercontent.com/jrnold/CDB90/{manifest['commit']}/{resource['path']}"
        request = urllib.request.Request(url, headers={'User-Agent': 'HistoryOfAtlas historical-data importer'})
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read(resource['bytes'] + 1)
        verify_resource(resource, payload)
        atomic_write(path, payload)


def validate_matches(review, source_ids):
    if review.get('version') != 1 or not review.get('reviewedAt'):
        raise ValueError('A versioned, dated historical review is required')
    by_source = {}
    approved_battles = set()
    for match in review['records']:
        source_id = str(match['sourceId'])
        if source_id not in source_ids or source_id in by_source:
            raise ValueError(f'Unknown or duplicate reviewed source row: {source_id}')
        if match.get('decision') not in {'approved', 'rejected', 'reviewed-existing'} or not match.get('note', '').strip():
            raise ValueError(f'Missing historical decision for row {source_id}')
        if not re.fullmatch(r'Q[1-9][0-9]*', match.get('battleId', '')) or not match.get('article'):
            raise ValueError(f'Missing reviewed battle identity for row {source_id}')
        if match['decision'] == 'approved':
            if match['battleId'] in approved_battles:
                raise ValueError(f"Multiple source engagements target {match['battleId']}; review the whole-battle scope")
            approved_battles.add(match['battleId'])
        by_source[source_id] = match
    return by_source


def validate_review_source(review, manifest):
    source = review.get('source', {})
    if any(source.get(field) != manifest.get(field) for field in ('repository', 'commit', 'license')):
        raise ValueError('Historical review does not cover this pinned source revision and license')


def read_csv(cache, name):
    with (cache / 'data' / name).open(newline='', encoding='utf-8') as handle:
        return list(csv.DictReader(handle))


def grouped(rows):
    result = collections.defaultdict(list)
    for row in rows:
        result[row['isqno']].append(row)
    return result


def import_profiles(manifest, review, cache, battle_directory, manual_ids):
    validate_review_source(review, manifest)
    try:
        from .cdb90 import build_profile
    except ImportError:
        from cdb90 import build_profile
    source_rows = read_csv(cache, 'battles.csv')
    ids = {row['isqno'] for row in source_rows}
    if len(ids) != len(source_rows):
        raise ValueError('Duplicate source battle IDs')
    matches = validate_matches(review, ids)
    forces = grouped(read_csv(cache, 'belligerents.csv'))
    periods = grouped(read_csv(cache, 'active_periods.csv'))
    records = {}
    audit = []
    errors = []
    for row in source_rows:
        source_id = row['isqno']
        match = matches.get(source_id)
        item = {'sourceId': int(source_id), 'name': row['name']}
        if match:
            item.update(battleId=match['battleId'], decision=match['decision'], note=match['note'])
            if match['decision'] == 'approved':
                try:
                    if match['battleId'] in manual_ids:
                        raise ValueError('A manual historical review already owns this battle')
                    battle = json.loads((battle_directory / f"{match['battleId']}.json").read_text())
                    records[battle['id']] = build_profile(match=match, battle=battle, source_battle=row,
                        forces=forces[source_id], periods=periods[source_id], source_meta=manifest)
                    item['status'] = 'imported'
                except (ValueError, KeyError, FileNotFoundError) as error:
                    item.update(status='quarantined', error=str(error))
                    errors.append(f"CDB90 {source_id} / {match['battleId']}: {error}")
            else:
                item['status'] = match['decision']
        elif row['parent']:
            item.update(status='duplicate-child', parent=row['parent'])
        elif not row['dbpedia']:
            item['status'] = 'unreviewed-no-article'
        else:
            item['status'] = 'unreviewed'
        audit.append(item)
    profiles = {'version': 1, 'reviewedAt': review['reviewedAt'],
                'source': manifest['repository'], 'sourceCommit': manifest['commit'],
                'license': manifest['license'], 'attribution': manifest['attribution'],
                'policy': 'Only reviewed whole-battle identities and compatible personnel counts are imported. Historical estimates, uncertainty and original force names are retained; casualties are not deaths.',
                'records': records}
    report = {'version': 1, 'status': 'blocked' if errors else 'reviewed-import',
              'sourceCommit': manifest['commit'], 'attribution': manifest['attribution'],
              'sourceManifestSha256': hashlib.sha256(encoded(manifest)).hexdigest(),
              'reviewSha256': hashlib.sha256(encoded(review)).hexdigest(),
              'profilesSha256': hashlib.sha256(encoded(profiles)).hexdigest(),
              'sourceBattles': len(source_rows), 'reviewed': len(matches), 'imported': len(records),
              'statusCounts': dict(sorted(collections.Counter(row['status'] for row in audit).items())),
              'records': audit}
    return profiles, report, errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true', help='Download missing pinned source files')
    parser.add_argument('--check', action='store_true', help='Verify generated profiles/report without changing them')
    args = parser.parse_args()
    try:
        manifest = json.loads(MANIFEST.read_text())
        cache = ROOT / 'data/raw/cdb90' / manifest['commit']
        acquire(manifest, cache, args.fetch)
        review = json.loads(MATCHES.read_text())
        manual_ids = set(json.loads((CURATED / 'battle-profiles.json').read_text())['records'])
        profiles, report, errors = import_profiles(manifest, review, cache,
            ROOT / 'public/data/battles/events', manual_ids)
        if errors:
            if not args.check:
                atomic_write(REPORT, encoded(report))
            raise ValueError('Approved rows failed validation; profiles were not changed:\n' + '\n'.join(errors))
        if not profiles['records']:
            raise ValueError('Refusing to publish an empty reviewed import')
        for path, value in [(PROFILES, profiles), (REPORT, report)]:
            payload = encoded(value)
            if args.check:
                if not path.is_file() or path.read_bytes() != payload:
                    raise ValueError(f'Generated artifact is stale: {path.relative_to(ROOT)}')
            else:
                atomic_write(path, payload)
        print(json.dumps({'sourceBattles': report['sourceBattles'], 'reviewed': report['reviewed'],
                          'imported': report['imported'], 'statusCounts': report['statusCounts'],
                          'checked': args.check}, indent=2))
    except (ValueError, OSError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()
