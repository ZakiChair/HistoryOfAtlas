#!/usr/bin/env python3
"""Save compact, reproducible source extracts; never called by the application.

Use --source-dir to read the named source downloads
from an existing download directory instead of making network requests.
"""
import argparse
import collections
import csv
import datetime
import gzip
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent
URLS = {
    'major-deposits.zip': 'https://www.datacommons.psu.edu/download/canary/canary-downloads/other-minerals/mineral-resource-online-spatial-data-usgs/mineral-resource-occurrences/major-mineral-deposits-of-the-world/ofr20051294-csv.zip',
    'goget.geojson': 'https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/interim_maps/goget_map_2026-03.geojson',
    'gcmt.geojson': 'https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/Current_maps/gcmt-smp/gcmt-smp_map_2026-08.geojson',
    'sodir-production.csv': 'https://factpages.sodir.no/public?/Factpages/external/tableview/field_production_yearly&rs:Command=Render&rc:Toolbar=false&rc:Parameters=f&IpAddress=not_used&CultureCode=en&rs:Format=CSV&Top100=false',
    'sodir-fields.json': 'https://factmaps.sodir.no/api/rest/services/DataService/Data/FeatureServer/7100/query?where=1%3D1&outFields=fldNpdidField%2CfldName%2CfldFactPageUrl&returnGeometry=false&returnCentroid=true&outSR=4326&f=json',
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path)
    parser.add_argument('--only', nargs='+', choices=URLS,
                        help='Refresh only selected source filenames, retaining other manifest entries')
    args = parser.parse_args()
    output = ROOT / 'sources'
    output.mkdir(parents=True, exist_ok=True)
    manifest_path = output / 'manifest.json'
    manifest = (json.loads(manifest_path.read_text()) if args.only and manifest_path.exists()
                else {'downloadedAt': datetime.date.today().isoformat(), 'files': []})
    manifest['downloadedAt'] = datetime.date.today().isoformat()
    for filename, url in URLS.items():
        if args.only and filename not in args.only:
            continue
        if args.source_dir:
            raw = (args.source_dir / filename).read_bytes()
        else:
            with urllib.request.urlopen(url, timeout=90) as response:
                raw = response.read()
        if filename == 'sodir-production.csv':
            rows = [{
                'id': row['prfNpdidInformationCarrier'], 'name': row['prfInformationCarrier'],
                'year': int(row['prfYear']), 'oil': float(row['prfPrdOilNetMillSm3']),
                'gas': float(row['prfPrdGasNetBillSm3']),
            } for row in csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))]
            target = 'sodir-production.json.gz'
        elif filename == 'sodir-fields.json':
            response = json.loads(raw)
            if response.get('exceededTransferLimit') or response.get('error'):
                raise ValueError('Incomplete SODIR field response')
            rows = [{
                'id': str(feature['attributes']['fldNpdidField']),
                'name': feature['attributes']['fldName'],
                'url': feature['attributes']['fldFactPageUrl'],
                'latitude': feature.get('centroid', {}).get('y'),
                'longitude': feature.get('centroid', {}).get('x'),
            } for feature in response['features']]
            target = 'sodir-fields.json.gz'
        elif filename.endswith('.zip'):
            archive = zipfile.ZipFile(io.BytesIO(raw))
            prefix = 'ofr20051294/'
            commodities = collections.defaultdict(list)
            for row in csv.DictReader(io.StringIO(archive.read(prefix + 'commodity.csv').decode('utf-8'))):
                commodities[row['gid']].append(row['value'])
            rows = [{
                'id': row['gid'], 'name': row['dep_name'], 'country': row['country'],
                'latitude': float(row['latitude']) if row['latitude'] else None,
                'longitude': float(row['longitude']) if row['longitude'] else None,
                'commodities': commodities[row['gid']],
            } for row in csv.DictReader(io.StringIO(archive.read(prefix + 'deposit.csv').decode('utf-8')))]
            (output / 'usgs-metadata.txt').write_bytes(archive.read(prefix + 'ofr-2005-1294.met'))
            target = 'usgs.json.gz'
        else:
            features = json.loads(raw)['features']
            rows = []
            for feature in features:
                props = feature['properties']
                rows.append({
                    'id': props['project-id'], 'name': props['name'],
                    'country': props.get('country-area1', ''),
                    # Published location columns work for points and polygon features.
                    # They are never replaced with invented or country centroid positions.
                    'latitude': props.get('Latitude'), 'longitude': props.get('Longitude'),
                    'accuracy': props.get('location-accuracy', ''),
                    'url': props['url'], 'status': props.get('status', ''),
                    # GOGET discovery is distinct from field production start and FID.
                    # GCMT publishes no discovery year: retain missing, never infer one.
                    'discoveryYear': props.get('discovery-year', ''),
                    'startYear': props.get('start-year', ''),
                    'endYear': props.get('end-year', ''),
                    'production': [{
                        'category': fuel,
                        'year': props.get('prod-year-' + fuel, ''),
                        'value': props.get('prod-' + fuel, ''),
                    } for fuel in (['oil', 'gas'] if filename == 'goget.geojson' else ['coal'])],
                })
            target = filename.replace('.geojson', '.json.gz')
        content = json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        compressed = gzip.compress(content, mtime=0)
        (output / target).write_bytes(compressed)
        entry = {
            'file': target, 'url': url, 'sourceSha256': hashlib.sha256(raw).hexdigest(),
            'extractSha256': hashlib.sha256(compressed).hexdigest(), 'rows': len(rows),
        }
        existing = next((index for index, item in enumerate(manifest['files'])
                         if item['file'] == target), None)
        if existing is None:
            manifest['files'].append(entry)
        else:
            manifest['files'][existing] = entry
        print(f'{target}: {len(rows)} source records, {len(compressed):,} bytes')
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
