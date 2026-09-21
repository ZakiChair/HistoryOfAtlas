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
USER_AGENT = 'HistoryOfAtlas/1.0 (open-source historical atlas; reproducible CC0 data ingestion)'
ROOTS = {'battle': 'Q178561', 'siege': 'Q188055', 'naval': 'Q1261499', 'war': 'Q198', 'campaign': 'Q831663', 'treaty': 'Q625298', 'conquest': 'Q1361229'}
RATE_LOCK = Lock()
LAST_REQUEST = 0.0
BLOCKED_UNTIL = 0.0

def polite_delay():
    global LAST_REQUEST
    while True:
        with RATE_LOCK:
            remaining = max(LAST_REQUEST + 4.1, BLOCKED_UNTIL) - time.monotonic()
            if remaining <= 0:
                LAST_REQUEST = time.monotonic()
                return
        time.sleep(remaining)

def shared_backoff(seconds):
    global BLOCKED_UNTIL
    with RATE_LOCK:
        BLOCKED_UNTIL = max(BLOCKED_UNTIL, time.monotonic() + seconds)

def entity_batch(ids, all_languages=False):
    key = ('all-languages-' if all_languages else '') + hashlib.sha256('|'.join(ids).encode()).hexdigest()[:20]
    path = RAW / ('entities-' + key + '.json')
    if path.exists():
        return
    # Read-only entity retrieval does not depend on the query-service replication lag.
    params = {'action': 'wbgetentities', 'ids': '|'.join(ids), 'props': 'info|labels|descriptions|claims|sitelinks', 'languages': 'en|fr', 'format': 'json'}
    if all_languages:
        del params['languages']
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
            if isinstance(error, urllib.error.HTTPError) and error.code == 429:
                shared_backoff(wait)
            time.sleep(wait)

def query(name, sparql):
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / (name + '.json')
    query_path = RAW / (name + '.sparql')
    if path.exists() and query_path.exists() and query_path.read_text() == sparql:
        return json.loads(path.read_text())['results']['bindings']
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
            query_path.write_text(sparql)
            (RAW / (name + '.meta.json')).write_text(json.dumps({'url': url, 'source': ENDPOINT, 'license': 'CC0-1.0', 'fetchedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'sha256': hashlib.sha256(body).hexdigest(), 'rows': len(data['results']['bindings'])}, indent=2))
            print(name, len(data['results']['bindings']), flush=True)
            return data['results']['bindings']
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            print(f'{name}: attempt {attempt + 1}: {error}', flush=True)
            if attempt == 3:
                raise
            retry_after = int(error.headers.get('Retry-After', '65')) if isinstance(error, urllib.error.HTTPError) and error.code == 429 else 5 * (attempt + 1)
            time.sleep(retry_after)

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
        # Re-run saturated discovery with ordered pages; never silently truncate growth.
        eligible = set()
        base_query = geolocated_query.removesuffix(' LIMIT 25000')
        for offset in range(0, 1000000, 5000):
            rows = query(f'geolocated-page-{offset:06}', base_query + f' ORDER BY ?item LIMIT 5000 OFFSET {offset}')
            eligible.update(row['item']['value'].rsplit('/', 1)[-1] for row in rows)
            if len(rows) < 5000:
                break
        else:
            raise RuntimeError('Geolocated discovery exceeded its safety limit; no incomplete acquisition will be published.')
    (RAW / 'eligible-ids.json').write_text(json.dumps(sorted(eligible)))
    candidates.update(eligible)
    (RAW / 'candidate-ids.json').write_text(json.dumps(sorted(candidates, key=lambda qid: int(qid[1:]))))
    ids = sorted(eligible, key=lambda qid: int(qid[1:]))
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
    # Preserve native source names instead of rejecting records only for lacking EN/FR labels.
    event_labels = {}
    for path in sorted(RAW.glob('entities-*.json')):
        if path.name.endswith('.meta.json'):
            continue
        for qid, entity in json.loads(path.read_text()).get('entities', {}).items():
            if qid in eligible:
                event_labels[qid] = {**event_labels.get(qid, {}), **entity.get('labels', {})}
    multilingual = sorted(qid for qid in eligible if not event_labels.get(qid, {}).get('en') and not event_labels.get(qid, {}).get('fr'))
    for offset in range(0, len(multilingual), 50):
        entity_batch(multilingual[offset:offset + 50], all_languages=True)
        print(f'original-language labels: {min(offset + 50, len(multilingual))}/{len(multilingual)}', flush=True)
    print(f'Acquisition complete: {len(ids)} event candidates; {len(linked_ids)} linked entities.', flush=True)
    (RAW / 'acquisition.json').write_text(json.dumps({'schemaVersion': 2, 'status': 'complete', 'candidateCount': len(candidates), 'eligibleCount': len(eligible), 'linkedCount': len(linked), 'eventsDownloadedThisRun':len(ids), 'linkedDownloadedThisRun':len(linked_ids), 'multilingualFallbackCandidates':len(multilingual), 'completedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}, indent=2))

if __name__ == '__main__':
    acquire()
