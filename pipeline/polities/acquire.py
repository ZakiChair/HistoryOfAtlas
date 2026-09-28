"""Freeze the P36/P1082 source statements needed by the reviewed polity mappings.

The committed extract rebuilds offline. Existing raw entity caches are read, never
rewritten; missing subjects/labels use the official, read-only Wikidata API.
No extract is published until every required entity and capital label is resolved.
"""
from pathlib import Path
import hashlib
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/raw/wikidata'
DESTINATION = ROOT / 'data/curated/polity-facts-wikidata.json'
USER_AGENT = 'HistoryOfAtlas/1.0 (open-source historical atlas; reproducible CC0 data ingestion)'
LAST_REQUEST = 0.0


def read(path):
    return json.loads(path.read_text())


def item_ids(snaks):
    for snak in snaks:
        value = snak.get('datavalue', {}).get('value')
        if isinstance(value, dict) and isinstance(value.get('id'), str):
            yield value['id']


def claims(entity, prop):
    return [claim for claim in entity.get('claims', {}).get(prop, [])
            if claim.get('rank') != 'deprecated']


def request_batch(ids, full, all_languages=False):
    global LAST_REQUEST
    params = {'action': 'wbgetentities', 'ids': '|'.join(ids),
              'props': 'info|labels|descriptions|claims' if full else 'info|labels',
              'languages': 'en|fr', 'format': 'json'}
    if all_languages:
        del params['languages']
    url = 'https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode(params)
    cache = RAW / 'polity-facts-acquisition' / (hashlib.sha256(url.encode()).hexdigest() + '.json')
    if cache.exists():
        stored = read(cache)
        return stored['entities'], stored['provenance']
    for attempt in range(4):
        wait = 4.1 - (time.monotonic() - LAST_REQUEST)
        if wait > 0:
            time.sleep(wait)
        LAST_REQUEST = time.monotonic()
        try:
            req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=45) as response:
                body = response.read()
            result = json.loads(body)
            if 'error' in result:
                raise RuntimeError(result['error'])
            provenance = {'url': url, 'license': 'CC0-1.0',
                          'fetchedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                          'sha256': hashlib.sha256(body).hexdigest()}
            cache.parent.mkdir(parents=True, exist_ok=True)
            temporary = cache.with_suffix('.json.tmp')
            temporary.write_text(json.dumps({'entities': result.get('entities', {}), 'provenance': provenance}, ensure_ascii=False))
            temporary.replace(cache)
            return result.get('entities', {}), provenance
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as error:
            if attempt == 3:
                raise
            delay = int(error.headers.get('Retry-After', '60')) if isinstance(error, urllib.error.HTTPError) and error.code == 429 else 5 * (attempt + 1)
            print(f'Wikidata retry in {delay}s: {error}', file=sys.stderr, flush=True)
            time.sleep(delay)


def acquire():
    registry = read(ROOT / 'data/curated/polity-facts-mappings.json')
    subject_ids = {row['subjectId'] for row in registry['mappings']}
    subjects, labels = {}, {}
    for path in sorted(RAW.glob('entities-*.json')):
        if path.name.endswith('.meta.json'):
            continue
        provenance = None
        for qid, entity in read(path).get('entities', {}).items():
            if entity.get('labels'):
                labels[qid] = {**labels.get(qid, {}), **entity['labels']}
            if qid not in subject_ids:
                continue
            previous = subjects.get(qid)
            if previous and entity.get('lastrevid', 0) < previous.get('lastrevid', 0):
                continue
            if provenance is None:
                metadata = path.with_suffix('.meta.json')
                provenance = read(metadata) if metadata.exists() else {'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                provenance = {key: provenance[key] for key in ['url', 'license', 'fetchedAt', 'sha256'] if key in provenance}
                provenance['rawFile'] = str(path.relative_to(ROOT))
            subjects[qid] = {'id': qid, **{key: entity[key] for key in ['lastrevid', 'modified', 'labels'] if key in entity},
                             'claims': {prop: entity.get('claims', {}).get(prop, []) for prop in ['P36', 'P1082']},
                             'provenance': provenance}
    missing = sorted(subject_ids - subjects.keys(), key=lambda q: int(q[1:]))
    for offset in range(0, len(missing), 50):
        fetched, provenance = request_batch(missing[offset:offset + 50], True)
        for qid, entity in fetched.items():
            if 'missing' in entity:
                raise RuntimeError(f'Mapped subject missing from Wikidata: {qid}')
            labels[qid] = entity.get('labels', {})
            subjects[qid] = {'id': qid, **{key: entity[key] for key in ['lastrevid', 'modified', 'labels'] if key in entity},
                             'claims': {prop: entity.get('claims', {}).get(prop, []) for prop in ['P36', 'P1082']},
                             'provenance': provenance}
    if subject_ids - subjects.keys():
        raise RuntimeError('Incomplete subject acquisition; previous extract preserved.')

    capitals, dependencies = set(), set()
    for entity in subjects.values():
        capitals.update(item_ids(claim['mainsnak'] for claim in claims(entity, 'P36') if claim.get('mainsnak')))
        for prop in ['P36', 'P1082']:
            for claim in claims(entity, prop):
                for qualifier in ['P459', 'P3831', 'P1013', 'P1480']:
                    dependencies.update(item_ids(claim.get('qualifiers', {}).get(qualifier, [])))
                for reference in claim.get('references', []):
                    for reference_property in ['P248', 'P143']:
                        dependencies.update(item_ids(reference.get('snaks', {}).get(reference_property, [])))
    dependencies.update(capitals)
    missing_labels = sorted((subject_ids | dependencies) - {qid for qid, value in labels.items() if value.get('en') or value.get('fr')}, key=lambda q: int(q[1:]))
    dependency_meta = {}
    for offset in range(0, len(missing_labels), 50):
        batch = missing_labels[offset:offset + 50]
        fetched, provenance = request_batch(batch, False)
        for qid, entity in fetched.items():
            if entity.get('labels'):
                labels[qid] = {**labels.get(qid, {}), **entity['labels']}
                dependency_meta[qid] = {'provenance': provenance, **{key: entity[key] for key in ['lastrevid', 'modified'] if key in entity}}
        print(f'Capital/reference labels: {min(offset + 50, len(missing_labels))}/{len(missing_labels)}', flush=True)
    untranslated = sorted(qid for qid in subject_ids | capitals if not (labels.get(qid, {}).get('en') or labels.get(qid, {}).get('fr')))
    for offset in range(0, len(untranslated), 50):
        fetched, provenance = request_batch(untranslated[offset:offset + 50], False, all_languages=True)
        for qid, entity in fetched.items():
            if entity.get('labels'):
                labels[qid] = entity['labels']
                dependency_meta[qid] = {'provenance': provenance, **{key: entity[key] for key in ['lastrevid', 'modified'] if key in entity}}
    unresolved = sorted(qid for qid in subject_ids | capitals if not labels.get(qid))
    if unresolved:
        raise RuntimeError(f'Unresolved subject/capital labels {unresolved}; previous extract preserved.')
    entities = {}
    for qid in sorted(subject_ids | dependencies, key=lambda q: int(q[1:])):
        names = labels.get(qid, {})
        languages = ['en', 'fr', 'de', 'es', 'zh', 'ru'] if names.get('en') or names.get('fr') else list(names)
        entities[qid] = {**subjects.get(qid, {'id': qid, **dependency_meta.get(qid, {})}),
                         'labels': {language: names[language] for language in languages if language in names}}
    extract = {'version': 1, 'license': 'CC0-1.0',
               'description': 'Immutable P36/P1082 Wikidata statements and qualifiers. Cache hashes/fetch metadata or entity revisions retain acquisition provenance. Imports are not independent verification.',
               'entities': entities}
    body = json.dumps(extract, ensure_ascii=False, separators=(',', ':')) + '\n'
    temporary = DESTINATION.with_suffix('.json.tmp')
    temporary.write_text(body)
    temporary.replace(DESTINATION)
    print(f'Extract complete: {len(subject_ids)} subjects, {len(capitals)} capital entities; {len(body.encode())} bytes', flush=True)


if __name__ == '__main__':
    acquire()
