"""Dated, source-backed territorial geometry; no inferred battle causation."""
from __future__ import annotations
import concurrent.futures
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import zipfile
from build import (ROOT, RAW, WORK, PUBLIC, fetch, write_json, digest, astro_year,
                   clean_name, entity_id, entity_color, valid_geometry, label_point, tile)

COMMIT = 'ad28a691b7c07c1fca89d0e0636d324667d2a258'
BASE = f'https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/{COMMIT}'
SOURCE = f'https://github.com/Seshat-Global-History-Databank/cliopatria/tree/{COMMIT}'
PAPER = 'https://doi.org/10.1038/s41597-025-04516-9'

def build_temporal(manifest: dict, report: dict, jobs: int = 2) -> None:
    print('Build Cliopatria temporal boundaries', flush=True)
    zip_path = fetch(f'{BASE}/cliopatria.geojson.zip', RAW/'cliopatria.geojson.zip')
    license_path = fetch(f'{BASE}/LICENSE.md', PUBLIC/'CLIOPATRIA-LICENSE.md')
    readme_path = fetch(f'{BASE}/README.md', RAW/'CLIOPATRIA-README.md')
    temporal_lock = {'commit':COMMIT,'files':[
        {'url':f'{BASE}/cliopatria.geojson.zip','sha256':digest(zip_path)},
        {'url':f'{BASE}/LICENSE.md','sha256':digest(license_path)},
        {'url':f'{BASE}/README.md','sha256':digest(readme_path)}]}
    lock_path = WORK/'cliopatria.lock.json'
    if lock_path.exists() and json.loads(lock_path.read_text()) != temporal_lock:
        raise RuntimeError('Cliopatria source checksum changed for the pinned commit.')
    write_json(lock_path,temporal_lock)
    with zipfile.ZipFile(zip_path) as archive:
        paths = [x for x in archive.namelist() if x.endswith('.geojson') and not x.startswith('__MACOSX/')]
        if len(paths) != 1:
            raise RuntimeError(f'Expected one GeoJSON, got {paths}')
        features = json.loads(archive.read(paths[0]))['features']
    normalized, labels, entities, rejected = [], [], {}, []
    relation_count, ambiguous_zero = 0, []
    for idx, feature in enumerate(features):
        p, geometry = feature.get('properties') or {}, feature.get('geometry')
        if p.get('Type') != 'POLITY':
            relation_count += 1
            continue
        name = clean_name(p.get('Name'))
        if not name or not valid_geometry(geometry):
            rejected.append({'index':idx,'reason':'missing-name-or-polygon'})
            continue
        start, end = astro_year(int(p['FromYear'])), astro_year(int(p['ToYear']))
        if start > end:
            rejected.append({'index':idx,'reason':'reversed-source-date-interval'})
            continue
        if p['FromYear'] == 0 or p['ToYear'] == 0:
            ambiguous_zero.append(idx)
        key = entity_id(name).replace('hb-', 'clio-')
        qid = p.get('Wikidata','')
        qid = qid if re.fullmatch(r'Q[1-9][0-9]*', qid) else ''
        area = round(float(p['Area']))
        props = {'id':f'clio-record-{idx}','entityId':key,'name':name,'polity':name,
                 'wikidataId':qid,'color':entity_color(name),'areaKm2':area,
                 'fromYear':start,'toYear':end,'precision':1,'approximate':True,
                 'sourceUrl':SOURCE,'sourceRecord':idx,'kind':'polity'}
        normalized.append({'type':'Feature','id':idx,'properties':props,'geometry':geometry})
        center = label_point(geometry)
        labels.append({'type':'Feature','id':idx,'properties':props,
                       'geometry':{'type':'Point','coordinates':center}})
        if key not in entities:
            entities[key] = {'id':key,'name':name,'color':props['color'],'wikidataId':qid,
                             'center':center,'observations':[], 'areaApproximate':True,
                             'source':SOURCE,'sourceCitation':PAPER,
                             'wikipedia':p.get('Wikipedia',''),'licence':'CC-BY-4.0'}
        entities[key]['observations'].append({'id':props['id'],'fromYear':start,'toYear':end,
                                             'year':start,'areaKm2':area,'sourceRecord':idx,
                                             'source':SOURCE,'approximate':True})
    records = {f['properties']['id']:f for f in normalized}
    changes, density = [], Counter()
    entity_index = []
    for entity in sorted(entities.values(),key=lambda x:x['name'].casefold()):
        observations = sorted(entity['observations'],key=lambda x:(x['fromYear'],x['toYear']))
        entity['observations'] = observations
        entity['firstObserved'] = min(x['fromYear'] for x in observations)
        entity['lastObserved'] = max(x['toYear'] for x in observations)
        entity['peakAreaKm2'] = max(x['areaKm2'] for x in observations)
        entity['detailsUrl'] = f'/geo/polities/{entity["id"]}.json'
        entity_index.append({k:v for k,v in entity.items() if k not in ('observations','sourceCitation')})
        write_json(PUBLIC/'polities'/f'{entity["id"]}.json',entity)
        previous = None
        for observation in observations:
            record = records[observation['id']]
            geometry_hash = hashlib.sha256(json.dumps(record['geometry'],sort_keys=True,separators=(',',':')).encode()).hexdigest()
            prior_hash = previous['geometryHash'] if previous else None
            if geometry_hash != prior_hash:
                year = observation['fromYear']
                density[year] += 1
                changes.append({'id':observation['id'],'entityId':entity['id'],'year':year,
                                'toYear':observation['toYear'],'areaKm2':observation['areaKm2'],
                                'previousRecordId':previous['id'] if previous else None,
                                'eventIds':[],'source':SOURCE,'sourceRecord':observation['sourceRecord'],
                                'evidence':'dated-source-interval','approximate':True,
                                'geometryChanged':bool(previous)})
            previous = dict(observation, geometryHash=geometry_hash)
    write_json(PUBLIC/'polities.json',entity_index)
    write_json(PUBLIC/'territorial-changes.json',changes)
    intervals = [(y,min(y+249,499)) for y in range(-3499,500,250)]
    intervals += [(y,y+99) for y in range(500,1500,100)]
    intervals += [(y,y+49) for y in range(1500,1900,50)]
    intervals += [(y,min(y+24,2024)) for y in range(1900,2025,25)]
    version = digest(Path(__file__)) + digest(zip_path)
    def create_shard(interval: tuple[int,int]) -> dict:
        start,end = interval
        selected_indices = [i for i,f in enumerate(normalized)
                            if f['properties']['fromYear'] <= end+1 and f['properties']['toYear'] >= start-1]
        shard_name = f'cliopatria-{start}-{end}'
        polygon_path, label_path = WORK/f'{shard_name}.geojson', WORK/f'{shard_name}-labels.geojson'
        write_json(polygon_path,{'type':'FeatureCollection','features':[normalized[i] for i in selected_indices]})
        write_json(label_path,{'type':'FeatureCollection','features':[labels[i] for i in selected_indices]})
        output = PUBLIC/f'{shard_name}.pmtiles'
        tile(output,{'territories':polygon_path,'labels':label_path},hashlib.sha256((version+shard_name).encode()).hexdigest())
        print(f'  {shard_name}: {len(selected_indices)} temporal records, {output.stat().st_size//1024} KiB',flush=True)
        return {'start':start,'end':end,'url':f'/geo/{output.name}','features':len(selected_indices),
                'bytes':output.stat().st_size,'sha256':digest(output)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,jobs)) as executor:
        shards = list(executor.map(create_shard,intervals))
    source = {'label':'Cliopatria · Seshat Global History Databank', 'url':SOURCE,
              'citation':PAPER,'commit':COMMIT,'licence':'CC-BY-4.0',
              'licenceUrl':'https://creativecommons.org/licenses/by/4.0/',
              'modifications':'BCE converted to astronomical years; POLITY records selected; fields normalized; label anchors calculated; geometry simplified into PMTiles; source Area retained.'}
    manifest['sources'].append(source)
    manifest['temporal'] = {'source':'cliopatria','sourceLayer':'territories','labelLayer':'labels',
                            'shards':shards,'changesUrl':'/geo/territorial-changes.json',
                            'entitiesUrl':'/geo/polities.json','density':[{'year':y,'count':n} for y,n in sorted(density.items())],
                            'range':[min(f['properties']['fromYear'] for f in normalized),max(f['properties']['toYear'] for f in normalized)],
                            'records':len(normalized),'entities':len(entities),'licence':'CC-BY-4.0'}
    manifest['limitations'] += [
        'Cliopatria temporal intervals describe source-supported territory observations, not proof of battle-caused annexation.',
        'Battle-event causal links are deliberately absent unless an independent explicit source substantiates them.',
        'Cliopatria RELATION rows (alliances and vassalage groups) are excluded from polity fill to avoid presenting alliances as unitary states.',
        'Source BCE years are shifted +1 into astronomical years. Six source intervals end at 0 despite its signed-BCE convention; 0 is preserved as 1 BCE and recorded in the report.',
        'Historical uncertainty is not quantified by Cliopatria per polygon; all boundaries are shown as approximate.',
        'Cliopatria ends in 2024. Years after 2024 retain the latest sourced boundaries with the source date displayed; no later territorial claims are inferred.'
    ]
    report['cliopatria'] = {'sourceRecords':len(features),'acceptedPolityRecords':len(normalized),
                           'excludedRelationRecords':relation_count,'entities':len(entities),
                           'shards':len(shards),'geometryChanges':len(changes),'ambiguousSourceYearZeroRecords':ambiguous_zero,
                           'rejections':rejected,'pmtilesBytes':sum(s['bytes'] for s in shards),
                           'range':manifest['temporal']['range'],'sources':[source]}
    write_json(WORK/'cliopatria-report.json',report['cliopatria'])
    write_json(PUBLIC/'manifest.json',manifest)
    write_json(WORK/'report.json',report)
    print(f'Cliopatria complete: {len(normalized)} temporal polygons, {len(entities)} polities, {len(changes)} source geometry states.',flush=True)

if __name__ == '__main__':
    build_temporal(json.loads((PUBLIC/'manifest.json').read_text()),json.loads((WORK/'report.json').read_text()))
