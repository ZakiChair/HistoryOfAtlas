"""Polite, resumable WDQS acquisition. Raw JSON and exact queries are preserved."""
from pathlib import Path
import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/raw/wikidata'
ENDPOINT = 'https://query.wikidata.org/sparql'
USER_AGENT = 'AtlasBelli/1.0 (open-source historical atlas; reproducible CC0 data ingestion)'
ROOTS = {'battle': 'Q178561', 'siege': 'Q188055', 'naval': 'Q1261499', 'war': 'Q198', 'campaign': 'Q831663', 'treaty': 'Q625298', 'conquest': 'Q1361229'}
RATE_LOCK = Lock()
LAST_REQUEST = 0.0

def polite_delay():
    global LAST_REQUEST
    with RATE_LOCK:
        time.sleep(max(0, 3.1 - (time.monotonic() - LAST_REQUEST)))
        LAST_REQUEST = time.monotonic()

def entity_batch(ids):
    key = hashlib.sha256('|'.join(ids).encode()).hexdigest()[:20]
    path = RAW / ('entities-' + key + '.json')
    if path.exists():
        return
    # Read-only entity retrieval does not depend on the query-service replication lag.
    params = {'action': 'wbgetentities', 'ids': '|'.join(ids), 'props': 'labels|descriptions|claims|sitelinks', 'languages': 'en|fr', 'format': 'json'}
    url = 'https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode(params)
    for attempt in range(5):
        try:
            polite_delay()
            request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read()
            result = json.loads(body)
            if 'error' in result:
                raise RuntimeError(result['error'])
            temporary = path.with_suffix('.json.tmp')
            temporary.write_bytes(body)
            temporary.replace(path)
            (RAW / ('entities-' + key + '.meta.json')).write_text(json.dumps({'url': url, 'license': 'CC0-1.0', 'fetchedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'sha256': hashlib.sha256(body).hexdigest(), 'ids': ids}, indent=2))
            return
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as error:
            print(f'entities {ids[0]} attempt {attempt + 1}: {error}', flush=True)
            if attempt == 4:
                raise
            wait = max(65, int(error.headers.get('Retry-After', '65'))) if isinstance(error, urllib.error.HTTPError) and error.code == 429 else (attempt + 1) * 10
            time.sleep(wait)

def query(name, sparql):
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / (name + '.json')
    query_path = RAW / (name + '.sparql')
    if path.exists() and query_path.exists() and query_path.read_text() == sparql:
        return json.loads(path.read_text())['results']['bindings']
    query_path.write_text(sparql)
    url = ENDPOINT + '?' + urllib.parse.urlencode({'query': sparql, 'format': 'json'})
    for attempt in range(4):
        try:
            time.sleep(1.1)
            request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/sparql-results+json'})
            with urllib.request.urlopen(request, timeout=85) as response:
                body = response.read()
            data = json.loads(body)
            temporary = path.with_suffix('.json.tmp')
            temporary.write_bytes(body)
            temporary.replace(path)
            (RAW / (name + '.meta.json')).write_text(json.dumps({'url': url, 'source': ENDPOINT, 'license': 'CC0-1.0', 'fetchedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'sha256': hashlib.sha256(body).hexdigest(), 'rows': len(data['results']['bindings'])}, indent=2))
            print(name, len(data['results']['bindings']), flush=True)
            return data['results']['bindings']
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            print(f'{name}: attempt {attempt + 1}: {error}', flush=True)
            if attempt == 3:
                raise
            retry_after = int(error.headers.get('Retry-After', '65')) if isinstance(error, urllib.error.HTTPError) and error.code == 429 else 5 * (attempt + 1)
            time.sleep(retry_after)

def acquire_sparql():
    roots = ' '.join('wd:' + qid for qid in ROOTS.values())
    taxonomy = query('taxonomy', f'SELECT DISTINCT ?class ?root WHERE {{VALUES ?root {{{roots}}} ?class wdt:P279* ?root}}')
    classes = ' '.join('wd:' + qid for qid in sorted({row['class']['value'].rsplit('/', 1)[-1] for row in taxonomy}))
    candidates = []
    offset = 0
    while True:
        rows = query(f'candidates-{offset:06}', f'SELECT DISTINCT ?item WHERE {{ VALUES ?class {{ {classes} }} ?item wdt:P31 ?class. FILTER EXISTS {{?item (wdt:P585|wdt:P580) ?date}} }} ORDER BY ?item LIMIT 2000 OFFSET {offset}')
        candidates.extend(row['item']['value'].rsplit('/', 1)[-1] for row in rows)
        if len(rows) < 2000:
            break
        offset += 2000
    (RAW / 'candidate-ids.json').write_text(json.dumps(candidates))
    # Query subtype closure once, then classify direct P31 statements locally.
    for offset in range(0, len(candidates), 250):
        ids = candidates[offset:offset + 250]
        values = ' '.join('wd:' + qid for qid in ids)
        query(f'facts-{offset:06}', f'''SELECT ?item ?property ?value ?precision ?calendar ?label WHERE {{
          VALUES ?item {{ {values} }}
          {{ VALUES ?property {{ wdt:P31 wdt:P625 wdt:P361 wdt:P710 wdt:P276 wdt:P17 wdt:P1346 wdt:P18 wdt:P1120 wdt:P1132 wdt:P527 wdt:P1344 }} ?item ?property ?value.
             OPTIONAL {{?value rdfs:label ?label. FILTER(LANG(?label) = "en")}} }}
          UNION {{?item p:P585/psv:P585 ?node. ?node wikibase:timeValue ?value; wikibase:timePrecision ?precision; wikibase:timeCalendarModel ?calendar. BIND("date" AS ?property)}}
          UNION {{?item p:P580/psv:P580 ?node. ?node wikibase:timeValue ?value; wikibase:timePrecision ?precision; wikibase:timeCalendarModel ?calendar. BIND("start" AS ?property)}}
          UNION {{?item p:P582/psv:P582 ?node. ?node wikibase:timeValue ?value; wikibase:timePrecision ?precision; wikibase:timeCalendarModel ?calendar. BIND("end" AS ?property)}}
          UNION {{?item rdfs:label ?value. FILTER(LANG(?value) IN ("en", "fr")) BIND(CONCAT("label_", LANG(?value)) AS ?property)}}
          UNION {{?item schema:description ?value. FILTER(LANG(?value) IN ("en", "fr")) BIND(CONCAT("description_", LANG(?value)) AS ?property)}}
          UNION {{?item wikibase:sitelinks ?value. BIND("sitelinks" AS ?property)}}
          UNION {{?article schema:about ?item; schema:isPartOf ?wiki. VALUES ?wiki {{<https://en.wikipedia.org/> <https://fr.wikipedia.org/>}} BIND(?article AS ?value) BIND("wikipedia" AS ?property)}}
          UNION {{?item wdt:P276 ?place. ?place wdt:P625 ?value. BIND("placeCoord" AS ?property) BIND(STR(?place) AS ?label)}}
        }}''')
    print(f'Acquisition complete: {len(candidates)} dated candidate entities.', flush=True)

def acquire():
    roots = ' '.join('wd:' + qid for qid in ROOTS.values())
    taxonomy = query('taxonomy', f'SELECT DISTINCT ?class ?root WHERE {{VALUES ?root {{{roots}}} ?class wdt:P279* ?root}}')
    classes = ' '.join('wd:' + qid for qid in sorted({row['class']['value'].rsplit('/', 1)[-1] for row in taxonomy}))
    candidates = set()
    for offset in range(0, 1000000, 25000):
        sparql = 'SELECT DISTINCT ?item WHERE {VALUES ?class {' + classes + '} ?item wdt:P31 ?class. } LIMIT 25000' + (f' OFFSET {offset}' if offset else '')
        rows = query(f'discovery-{offset:06}', sparql)
        candidates.update(row['item']['value'].rsplit('/', 1)[-1] for row in rows)
        if len(rows) < 25000:
            break
        # The public endpoint can be in outage mode at one request per minute.
        if not (RAW / f'discovery-{offset + 25000:06}.json').exists():
            time.sleep(65)
    ids = sorted(candidates, key=lambda qid: int(qid[1:]))
    (RAW / 'candidate-ids.json').write_text(json.dumps(ids))
    geolocated_query = 'SELECT DISTINCT ?item WHERE {hint:Query hint:optimizer "None". VALUES ?class {' + classes + '} ?item wdt:P31 ?class. ?item (wdt:P585|wdt:P580) ?date. ?item (wdt:P625|wdt:P276/wdt:P625) ?coord. } LIMIT 25000'
    located_rows = query('geolocated-discovery', geolocated_query)
    eligible = {row['item']['value'].rsplit('/', 1)[-1] for row in located_rows}
    if len(located_rows) >= 25000:
        raise RuntimeError('Geolocated discovery reached its page limit; increase pagination before claiming completeness.')
    (RAW / 'eligible-ids.json').write_text(json.dumps(sorted(eligible)))
    ids = [qid for qid in ids if qid in eligible]
    downloaded = set()
    for path in sorted(RAW.glob('entities-*.json')):
        if not path.name.endswith('.meta.json'):
            downloaded.update(json.loads(path.read_text()).get('entities', {}).keys())
    ids = [qid for qid in ids if qid not in downloaded]
    with ThreadPoolExecutor(max_workers=3) as executor:
        batches = [ids[offset:offset + 50] for offset in range(0, len(ids), 50)]
        for index, _ in enumerate(executor.map(entity_batch, batches)):
            print(f'entities: {min((index + 1) * 50, len(ids))}/{len(ids)}', flush=True)
    # Resolve labels and coordinates only from explicit P276/P710/P361 references.
    linked = set()
    for path in sorted(RAW.glob('entities-*.json')):
        if path.name.endswith('.meta.json'):
            continue
        for entity in json.loads(path.read_text()).get('entities', {}).values():
            if entity.get('id') not in eligible:
                continue
            for property_id in ('P276', 'P710', 'P361', 'P1346', 'P17'):
                for claim in entity.get('claims', {}).get(property_id, []):
                    value = claim.get('mainsnak', {}).get('datavalue', {}).get('value', {})
                    if isinstance(value, dict) and value.get('id'):
                        linked.add(value['id'])
    already_downloaded = set()
    for path in sorted(RAW.glob('entities-*.json')):
        if not path.name.endswith('.meta.json'):
            already_downloaded.update(json.loads(path.read_text()).get('entities', {}).keys())
    linked_ids = sorted(linked - already_downloaded, key=lambda qid: int(qid[1:]))
    with ThreadPoolExecutor(max_workers=3) as executor:
        batches = [linked_ids[offset:offset + 50] for offset in range(0, len(linked_ids), 50)]
        for index, _ in enumerate(executor.map(entity_batch, batches)):
            print(f'linked entities: {min((index + 1) * 50, len(linked_ids))}/{len(linked_ids)}', flush=True)
    print(f'Acquisition complete: {len(ids)} event candidates; {len(linked_ids)} linked entities.', flush=True)
    (RAW / 'acquisition.json').write_text(json.dumps({'status': 'complete', 'candidateCount': len(candidates), 'eligibleCount': len(eligible), 'linkedCount': len(linked_ids), 'completedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}, indent=2))

if __name__ == '__main__':
    acquire()
