#!/usr/bin/env python3
"""Build a fully static, reproducible Natural Earth + historical-basemaps atlas."""
from __future__ import annotations
import argparse
import concurrent.futures
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import time
import unicodedata
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/raw/geography'
WORK = ROOT / 'data/geography'
PUBLIC = ROOT / 'public/geo'
HIST_COMMIT = 'da7a4b735ecef70aebdc9c73e409d8a2500d50f3'
NE_COMMIT = 'ca96624a56bd078437bca8184e78163e5039ad19'
HIST_BASE = f'https://raw.githubusercontent.com/aourednik/historical-basemaps/{HIST_COMMIT}'
NE_BASE = f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_COMMIT}'
UA = 'AtlasBelli/1.0 (open historical atlas; reproducible geography ingestion)'
NE_FILES = {
    'land': 'ne_50m_land.geojson',
    'coastline': 'ne_50m_coastline.geojson',
    'rivers': 'ne_50m_rivers_lake_centerlines.geojson',
    'current_borders': 'ne_50m_admin_0_countries.geojson',
    'relief': 'ne_50m_geography_regions_polys.geojson',
}
PALETTE = ['#c39a53', '#7faba0', '#c47f69', '#9c99bc', '#7c9fb2', '#b5a175', '#ad7f9a', '#8daa77', '#d4a474', '#6fa7a2', '#a993b8', '#b5ac6d']

def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + '\n')

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def fetch(url: str, target: Path) -> Path:
    if target.exists() and target.stat().st_size:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    last = None
    for attempt in range(5):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(request, timeout=180) as response:
                payload = response.read()
            temporary = target.with_suffix(target.suffix + '.download')
            temporary.write_bytes(payload)
            temporary.replace(target)
            time.sleep(.15)
            return target
        except (urllib.error.URLError, TimeoutError) as exc:
            last = exc
            time.sleep(2 ** attempt)
    raise RuntimeError(f'Cannot fetch {url}: {last}')

def astro_year(source_year: int) -> int:
    return source_year + 1 if source_year < 0 else source_year

def clean_name(value: object) -> str:
    return re.sub(r'\s+', ' ', str(value or '')).strip()

def entity_id(name: str) -> str:
    normalized = unicodedata.normalize('NFKC', name).casefold()
    return 'hb-' + hashlib.sha256(normalized.encode()).hexdigest()[:14]

def entity_color(name: str) -> str:
    return PALETTE[int(hashlib.sha256(name.casefold().encode()).hexdigest()[:8], 16) % len(PALETTE)]

def rings_area(rings: list) -> float:
    # Chamberlain-Duquette spherical polygon area; metres squared, no planar projection.
    def ring_area(ring: list) -> float:
        total = 0.0
        for p1, p2 in zip(ring, ring[1:]):
            lon_delta = math.radians(p2[0] - p1[0])
            if lon_delta > math.pi:
                lon_delta -= 2 * math.pi
            elif lon_delta < -math.pi:
                lon_delta += 2 * math.pi
            total += lon_delta * (2 + math.sin(math.radians(p1[1])) + math.sin(math.radians(p2[1])))
        return abs(total) * 6371008.8 ** 2 / 2 / 1e6
    return max(0, ring_area(rings[0]) - sum(ring_area(ring) for ring in rings[1:])) if rings else 0

def geometry_area(geometry: dict) -> float:
    if geometry['type'] == 'Polygon':
        return rings_area(geometry['coordinates'])
    if geometry['type'] == 'MultiPolygon':
        return sum(rings_area(rings) for rings in geometry['coordinates'])
    return 0

def point_in_ring(x: float, y: float, ring: list) -> bool:
    inside = False
    for a, b in zip(ring, ring[1:]):
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
    return inside

def label_point(geometry: dict) -> list:
    polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
    rings = max(polygons, key=rings_area)
    ring = rings[0]
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    low_x, high_x, low_y, high_y = min(xs), max(xs), min(ys), max(ys)
    # An interior point in the largest polygon. This is label placement, never event geocoding.
    for division in (2, 4, 8, 16):
        candidates = [(low_x + (high_x-low_x) * i/division, low_y + (high_y-low_y) * j/division)
                      for i in range(1, division) for j in range(1, division)]
        candidates.sort(key=lambda p: (p[0] - (low_x+high_x)/2)**2 + (p[1] - (low_y+high_y)/2)**2)
        for x, y in candidates:
            if point_in_ring(x,y,ring) and not any(point_in_ring(x,y,hole) for hole in rings[1:]):
                return [round(x, 5), round(y, 5)]
    return ring[0][:2]

def valid_geometry(geometry: dict | None) -> bool:
    return bool(geometry and geometry.get('type') in ('Polygon','MultiPolygon') and geometry.get('coordinates'))

def tile(output: Path, layers: dict[str, Path], cache_key: str) -> None:
    signature = output.with_suffix('.sha256')
    if output.exists() and signature.exists() and signature.read_text().strip() == cache_key:
        return
    command = ['tippecanoe', '--force', '--quiet', '--minimum-zoom=0', '--maximum-zoom=5',
               '--drop-densest-as-needed', '--simplification=2', '--no-tile-size-limit',
               '--no-feature-limit', '--detect-shared-borders', '--output', str(output)]
    for layer, path in layers.items():
        command.extend(['-L', f'{layer}:{path}'])
    env = dict(os.environ, TIPPECANOE_MAX_THREADS='2')
    result = subprocess.run(command, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(result.stderr[-5000:])
    signature.write_text(cache_key + '\n')

def normalize_snapshot(item: dict) -> tuple[dict, list, list]:
    filename = item['filename']
    source = RAW / filename
    payload = json.loads(source.read_text())
    source_url = f'https://github.com/aourednik/historical-basemaps/blob/{HIST_COMMIT}/geojson/{filename}'
    year = astro_year(item['year'])
    features, labels, entities, rejected = [], [], {}, []
    for idx, feature in enumerate(payload['features']):
        props, geometry = feature.get('properties') or {}, feature.get('geometry')
        name = clean_name(props.get('NAME') or props.get('name'))
        if not valid_geometry(geometry) or not name:
            rejected.append({'source': filename, 'index': idx, 'reason': 'missing-name-or-polygon'})
            continue
        polity = clean_name(props.get('SUBJECTO')) or name
        # IDs describe source labels, not unsupported links to Wikidata entities.
        key = entity_id(polity)
        area = round(geometry_area(geometry))
        precision_raw = props.get('BORDERPRECISION', 1)
        try:
            precision = max(1, min(3, int(precision_raw or 1)))
        except (ValueError, TypeError):
            precision = 1
        properties = {'name': name, 'polity': polity, 'entityId': key, 'year': year,
                      'color': entity_color(polity), 'areaKm2': area, 'precision': precision,
                      'approximate': precision < 3, 'sourceUrl': source_url,
                      'kind': clean_name(props.get('type')) or 'territory'}
        features.append({'type':'Feature', 'id':idx, 'properties':properties, 'geometry':geometry})
        label = label_point(geometry)
        labels.append({'type':'Feature', 'id':idx, 'properties':properties,
                       'geometry': {'type':'Point', 'coordinates':label}})
        if key not in entities:
            entities[key] = {'id':key, 'name':polity, 'color':properties['color'], 'areaKm2':0,
                             'center':label, 'source':source_url}
        entities[key]['areaKm2'] += area
    stem = filename.removesuffix('.geojson')
    normalized, labels_path = WORK / f'{stem}.geojson', WORK / f'{stem}-labels.geojson'
    write_json(normalized, {'type':'FeatureCollection', 'features':features})
    write_json(labels_path, {'type':'FeatureCollection', 'features':labels})
    out = PUBLIC / f'{stem}.pmtiles'
    key = hashlib.sha256((digest(source) + SCRIPT_HASH).encode()).hexdigest()
    tile(out, {'territories': normalized, 'labels':labels_path}, key)
    result = {'year':year, 'sourceYear':item['year'], 'url':f'/geo/{out.name}', 'source':source_url,
              'sourceLayer':'territories', 'labelLayer':'labels', 'approximate':True,
              'features':len(features), 'bytes':out.stat().st_size, 'sha256':digest(out),
              'licence':'GPL-3.0-only', 'originalFilename':filename}
    print(f"  {filename}: {len(features)} territories, {out.stat().st_size//1024} KiB", flush=True)
    return result, list(entities.values()), rejected

SCRIPT_HASH = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch-only', action='store_true')
    parser.add_argument('--jobs', type=int, default=2)
    options = parser.parse_args()
    for directory in (RAW, WORK, PUBLIC):
        directory.mkdir(parents=True, exist_ok=True)
    index_path = fetch(f'{HIST_BASE}/index.json', RAW / 'historical-index.json')
    index = json.loads(index_path.read_text())['years']
    selected = [x for x in index if x['year'] >= -4000]
    downloads = [(f'{HIST_BASE}/geojson/{x["filename"]}', RAW / x['filename']) for x in selected]
    downloads += [(f'{NE_BASE}/geojson/{filename}', RAW / filename) for filename in NE_FILES.values()]
    downloads += [(f'{HIST_BASE}/LICENSE', RAW / 'HISTORICAL-BASEMAPS-LICENSE.txt'),
                  (f'{HIST_BASE}/README.md', RAW / 'HISTORICAL-BASEMAPS-README.md')]
    print(f'Fetch {len(downloads)} pinned source files', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(lambda args: fetch(*args), downloads))
    lock = {'historicalCommit':HIST_COMMIT, 'naturalEarthCommit':NE_COMMIT,
            'files':[{'filename':path.name,'url':url,'sha256':digest(path)} for url,path in downloads]}
    previous_lock = WORK / 'sources.lock.json'
    if previous_lock.exists():
        recorded = {x['filename']:x['sha256'] for x in json.loads(previous_lock.read_text())['files']}
        for item in lock['files']:
            if item['filename'] in recorded and recorded[item['filename']] != item['sha256']:
                raise RuntimeError(f"Checksum changed for pinned source {item['filename']}")
    write_json(previous_lock, lock)
    if options.fetch_only:
        print(f'Fetched all source files; land validation file: {RAW / NE_FILES["land"]}', flush=True)
        return
    if not shutil.which('tippecanoe'):
        raise SystemExit('tippecanoe >= 2.17 is required (brew install tippecanoe, or see docs/GEOGRAPHY.md).')
    print('Build historical PMTiles', flush=True)
    snapshots, entities, rejections = [], {}, []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, options.jobs)) as executor:
        for snapshot, observed, rejected in executor.map(normalize_snapshot, selected):
            snapshots.append(snapshot)
            rejections.extend(rejected)
            for observation in observed:
                key = observation['id']
                if key not in entities:
                    entities[key] = {'id':key,'name':observation['name'], 'color':observation['color'],
                                     'center':observation['center'], 'observations':[]}
                entities[key]['observations'].append({'year':snapshot['year'],'areaKm2':observation['areaKm2'],
                                                      'source':observation['source']})
    print('Build Natural Earth PMTiles', flush=True)
    normalized_layers = {}
    for layer, filename in NE_FILES.items():
        raw = json.loads((RAW/filename).read_text())
        for feature in raw['features']:
            props = feature.get('properties') or {}
            feature['properties'] = {'name':clean_name(props.get('NAME_EN') or props.get('NAME') or props.get('name')),
                                     'name_fr':clean_name(props.get('NAME_FR') or props.get('name_fr')),
                                     'featurecla':clean_name(props.get('featurecla') or props.get('FEATURECLA')),
                                     'scalerank':props.get('scalerank',props.get('SCALERANK',5)),
                                     'wikidata':props.get('WIKIDATAID') or props.get('wikidataid') or ''}
        dest = WORK / filename
        write_json(dest, raw)
        normalized_layers[layer] = dest
    basemap = PUBLIC / 'natural-earth.pmtiles'
    tile(basemap, normalized_layers, hashlib.sha256((SCRIPT_HASH+''.join(digest(RAW/f) for f in NE_FILES.values())).encode()).hexdigest())
    shutil.copyfile(RAW/'HISTORICAL-BASEMAPS-LICENSE.txt', PUBLIC/'HISTORICAL-BASEMAPS-LICENSE.txt')
    # Supply the complete corresponding source of the distributed GPL map adaptations.
    archive_path = PUBLIC / 'historical-source.tar.gz'
    with archive_path.open('wb') as output, gzip.GzipFile(fileobj=output,mode='wb',mtime=0) as compressed:
        with tarfile.open(fileobj=compressed,mode='w') as archive:
            archive_files = [(Path(__file__), 'pipeline/geography/build.py'),
                             (Path(__file__).with_name('cliopatria.py'), 'pipeline/geography/cliopatria.py'),
                             (ROOT/'docs/GEOGRAPHY.md', 'README.md'),
                             (RAW/'HISTORICAL-BASEMAPS-LICENSE.txt','LICENSE'),
                             (RAW/'HISTORICAL-BASEMAPS-README.md','UPSTREAM-README.md'),
                             (WORK/'sources.lock.json','data/geography/sources.lock.json')]
            for item in selected:
                archive_files += [(RAW/item['filename'],f'data/raw/geography/{item["filename"]}'),
                                  (WORK/item['filename'],f'data/geography/{item["filename"]}'),
                                  (WORK/(item['filename'].replace('.geojson','-labels.geojson')),
                                   f'data/geography/{item["filename"].replace(".geojson","-labels.geojson")}')]
            for path, name in archive_files:
                info = archive.gettarinfo(str(path),arcname=name)
                info.mtime, info.uid, info.gid, info.uname, info.gname = 0,0,0,'',''
                with path.open('rb') as handle:
                    archive.addfile(info,handle)
    entity_list = sorted(entities.values(),key=lambda x:x['name'].casefold())
    # Area samples are observed snapshots, never exact founding or dissolution dates.
    for entity in entity_list:
        entity['firstObserved'] = min(x['year'] for x in entity['observations'])
        entity['lastObserved'] = max(x['year'] for x in entity['observations'])
        entity['areaApproximate'] = True
    write_json(PUBLIC/'entities.json', entity_list)
    sources = [{'label':'Historical Basemaps · A. Ourednik et contributeurs',
                'url':'https://github.com/aourednik/historical-basemaps','commit':HIST_COMMIT,
                'licence':'GPL-3.0-only','licenceUrl':'/geo/HISTORICAL-BASEMAPS-LICENSE.txt',
                'correspondingSource':'/geo/historical-source.tar.gz'},
               {'label':'Natural Earth', 'url':'https://www.naturalearthdata.com/', 'commit':NE_COMMIT,
                'licence':'Public domain','licenceUrl':'https://www.naturalearthdata.com/about/terms-of-use/'}]
    manifest = {'version':1,'calendar':'astronomical','snapshots':sorted(snapshots,key=lambda x:x['year']),
                'basemap':{'url':'/geo/natural-earth.pmtiles','layers':list(NE_FILES),
                           'sha256':digest(basemap),'bytes':basemap.stat().st_size,'maxzoom':5},
                'entitiesUrl':'/geo/entities.json','sources':sources,
                'limitations':['Historical snapshots end in 2010. Natural Earth borders are a contemporary reference, not a historical snapshot.',
                               'Ancient borders and cultural areas are approximate; they overlap and do not necessarily denote sovereign states.',
                               'Between snapshots use an explicitly illustrative opacity crossfade, not invented annual boundaries.',
                               'Modern shorelines and rivers do not reconstruct historical physical geography.',
                               'Entity identity follows normalized upstream SUBJECTO labels and is not an asserted Wikidata identity.',
                               'Area figures are approximate spherical geometry measurements; overlapping regions may be counted twice.']}
    write_json(PUBLIC/'manifest.json',manifest)
    report = {'snapshots':len(snapshots),'snapshotRange':[min(x['year'] for x in snapshots),max(x['year'] for x in snapshots)],
              'territoryObservations':sum(x['features'] for x in snapshots),'entities':len(entities),
              'pmtilesBytes':sum(x['bytes'] for x in snapshots)+basemap.stat().st_size,
              'rejections':rejections,'sources':sources,'limitations':manifest['limitations']}
    write_json(WORK/'report.json',report)
    from cliopatria import build_temporal
    build_temporal(manifest, report, jobs=options.jobs)
    print(json.dumps({k:v for k,v in report.items() if k not in ('sources','limitations','rejections','cliopatria')},indent=2))

if __name__ == '__main__':
    main()
