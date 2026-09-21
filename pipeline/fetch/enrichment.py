"""Bounded, resumable people/office enrichment using explicit Wikidata claims.

No general biography crawl: event participants/commanders, mapped-polity office
holders, their offices and the offices' explicit jurisdictions are the boundary.
"""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import time

from wikidata import RAW, ROOT, entity_batch

VERSION = 1


def statements(entity, prop):
    return [claim for claim in entity.get('claims', {}).get(prop, [])
            if claim.get('rank') != 'deprecated' and claim.get('mainsnak', {}).get('datavalue')]


def value_ids(snaks):
    return {value['id'] for snak in snaks
            if isinstance(value := snak.get('datavalue', {}).get('value'), dict)
            and isinstance(value.get('id'), str) and value['id'].startswith('Q')}


def claim_ids(entity, prop):
    return value_ids([claim['mainsnak'] for claim in statements(entity, prop)])


def event_people_ids(entities, event_ids):
    people = set()
    for qid in event_ids:
        event = entities.get(qid, {})
        people.update(claim_ids(event, 'P4791'))
        for claim in statements(event, 'P710'):
            people.update(value_ids(claim.get('qualifiers', {}).get('P4791', [])))
        for participant in claim_ids(event, 'P710'):
            if 'Q5' in claim_ids(entities.get(participant, {}), 'P31'):
                people.add(participant)
    return people


def ruler_ids(entities, polity_ids):
    return {qid for polity in polity_ids for prop in ('P35', 'P6')
            for qid in claim_ids(entities.get(polity, {}), prop)}


def office_ids(entities, people):
    return {qid for person in people for qid in claim_ids(entities.get(person, {}), 'P39')}


def load_entities():
    entities = {}
    for path in sorted(RAW.glob('entities-*.json')):
        if path.name.endswith('.meta.json'):
            continue
        for qid, entity in json.loads(path.read_text()).get('entities', {}).items():
            previous = entities.get(qid)
            if previous is None or entity.get('lastrevid', 0) >= previous.get('lastrevid', 0):
                entity['labels'] = {**(previous or {}).get('labels', {}), **entity.get('labels', {})}
                entities[qid] = entity
            else:
                previous['labels'] = {**entity.get('labels', {}), **previous.get('labels', {})}
    return entities


def acquire_missing(ids, entities, stage):
    pending = sorted(ids - entities.keys(), key=lambda qid: int(qid[1:]))
    print(f'{stage}: {len(ids)} targets, {len(pending)} missing', flush=True)
    batches = [pending[offset:offset + 50] for offset in range(0, len(pending), 50)]
    with ThreadPoolExecutor(max_workers=3) as executor:
        for index, _ in enumerate(executor.map(entity_batch, batches)):
            print(f'{stage}: {min((index + 1) * 50, len(pending))}/{len(pending)} acquired', flush=True)
    return load_entities() if pending else entities


def acquisition_inputs():
    paths = ['data/raw/wikidata/candidate-ids.json', 'data/raw/wikidata/eligible-ids.json',
             'public/geo/polities.json']
    return {path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in paths}


def acquire():
    RAW.mkdir(parents=True, exist_ok=True)
    marker_path = RAW / 'enrichment-acquisition.json'
    inputs = acquisition_inputs()
    entities = load_entities()
    if marker_path.exists():
        previous = json.loads(marker_path.read_text())
        if (previous.get('schemaVersion') == VERSION and previous.get('status') == 'complete'
                and previous.get('inputs') == inputs
                and all(qid in entities for qid in previous.get('requiredIds', []))):
            print(f"Enrichment complete from cache: {previous['peopleCandidates']} person candidates", flush=True)
            return
    marker_path.write_text(json.dumps({'schemaVersion': VERSION, 'status': 'acquiring', 'inputs': inputs}, indent=2))
    candidates = set(json.loads((RAW / 'candidate-ids.json').read_text()))
    event_ids = candidates & entities.keys()
    polities = json.loads((ROOT / 'public/geo/polities.json').read_text())
    polity_ids = {polity['wikidataId'] for polity in polities if polity.get('wikidataId')}
    people = event_people_ids(entities, event_ids)
    entities = acquire_missing(people, entities, 'commanders and human participants')
    entities = acquire_missing(polity_ids, entities, 'polity source identities')
    people.update(ruler_ids(entities, polity_ids))
    entities = acquire_missing(people, entities, 'sourced political office holders')
    offices = office_ids(entities, people)
    offices.update(qid for polity in polity_ids for prop in ('P1906', 'P1313')
                   for qid in claim_ids(entities.get(polity, {}), prop))
    entities = acquire_missing(offices, entities, 'offices')
    jurisdictions = {qid for office in offices for qid in claim_ids(entities.get(office, {}), 'P1001')}
    for person in people:
        for claim in statements(entities.get(person, {}), 'P39'):
            jurisdictions.update(value_ids(claim.get('qualifiers', {}).get('P1001', [])))
    entities = acquire_missing(jurisdictions, entities, 'explicit office jurisdictions')
    required = people | polity_ids | offices | jurisdictions
    multilingual = sorted(qid for qid in required
                          if 'missing' not in entities.get(qid, {})
                          and not entities.get(qid, {}).get('labels', {}).get('en')
                          and not entities.get(qid, {}).get('labels', {}).get('fr'))
    for offset in range(0, len(multilingual), 50):
        entity_batch(multilingual[offset:offset + 50], all_languages=True)
        print(f'Enrichment native labels: {min(offset + 50, len(multilingual))}/{len(multilingual)}', flush=True)
    entities = load_entities()
    unresolved = sorted(required - entities.keys())
    if unresolved:
        raise RuntimeError(f'Enrichment incomplete: {len(unresolved)} missing source entities')
    marker = {'schemaVersion': VERSION, 'status': 'complete', 'inputs': inputs,
              'peopleCandidates': len(people), 'polities': len(polity_ids), 'offices': len(offices),
              'jurisdictions': len(jurisdictions), 'requiredIds': sorted(required),
              'eventIds': sorted(event_ids), 'peopleIds': sorted(people),
              'polityIds': sorted(polity_ids), 'officeIds': sorted(offices),
              'unavailableIds': sorted(qid for qid in required if 'missing' in entities[qid]),
              'completedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    temporary = marker_path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(marker, indent=2))
    temporary.replace(marker_path)
    print(f'Enrichment complete: {len(people)} person candidates, {len(offices)} offices.', flush=True)


if __name__ == '__main__':
    acquire()
