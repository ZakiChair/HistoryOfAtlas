"""Complete the existing candidate cache without changing the published atlas."""
from pathlib import Path
import importlib.util
import json
import hashlib
import time
from concurrent.futures import ThreadPoolExecutor
from functools import partial

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('atlas_wikidata', ROOT / 'pipeline/fetch/wikidata.py')
wikidata = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wikidata)


def candidate_ids(discovery_path, inclusion_path):
    """Keep discovery reproducible while acquiring individually reviewed omissions."""
    discovered = json.loads(discovery_path.read_text())
    included = json.loads(inclusion_path.read_text())['records']
    return set(discovered) | set(included)


def language_review_candidates(raw, published_candidates, unlabeled):
    """Descriptions outside EN/FR can explicitly identify sea and air engagements."""
    requested = set(unlabeled)
    if published_candidates.exists():
        for candidate in json.loads(published_candidates.read_text()).get('candidates', []):
            if ('land-event-in-open-ocean' in candidate.get('reasons', []) or
                    candidate.get('classification') == 'additional-mappable-battle'):
                requested.add(candidate['id'])
    completed = set()
    for path in raw.glob('entities-all-languages-*.meta.json'):
        # Metadata only marks completed responses, written after atomic publication.
        completed.update(json.loads(path.read_text()).get('ids', []))
    return sorted(requested - completed, key=lambda qid: int(qid[1:]))


def main():
    raw = ROOT / 'data/raw/wikidata'
    candidates = candidate_ids(raw / 'candidate-ids.json', ROOT / 'data/curated/battle-inclusions.json')
    present = set()
    for path in raw.glob('entities-*.json'):
        if not path.name.endswith('.meta.json'):
            present.update(json.loads(path.read_text()).get('entities', {}))
    missing = sorted(candidates - present, key=lambda qid: int(qid[1:]))
    print(f'Candidate audit: {len(missing)} uncached of {len(candidates)} candidates', flush=True)
    batches = [missing[index:index + 50] for index in range(0, len(missing), 50)]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for index, _ in enumerate(pool.map(partial(wikidata.entity_batch, all_languages=True), batches)):
            print(f'Candidate audit: {min((index + 1) * 50, len(missing))}/{len(missing)} downloaded', flush=True)
    # Resolve only explicitly linked places/participants; never infer a battlefield
    # from a country's capital or a participant's headquarters.
    linked = set()
    present = set()
    event_labels = {}
    for path in raw.glob('entities-*.json'):
        if path.name.endswith('.meta.json'):
            continue
        for qid, entity in json.loads(path.read_text()).get('entities', {}).items():
            present.add(qid)
            if qid not in candidates:
                continue
            event_labels[qid] = {**event_labels.get(qid, {}), **entity.get('labels', {})}
            for prop in ('P276', 'P710'):
                for claim in entity.get('claims', {}).get(prop, []):
                    if claim.get('rank') == 'deprecated':
                        continue
                    value = claim.get('mainsnak', {}).get('datavalue', {}).get('value')
                    if isinstance(value, dict) and value.get('id'):
                        linked.add(value['id'])
    linked_missing = sorted(linked - present, key=lambda qid: int(qid[1:]))
    batches = [linked_missing[index:index + 50] for index in range(0, len(linked_missing), 50)]
    print(f'Candidate audit: {len(linked_missing)} linked places and participants missing', flush=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        for index, _ in enumerate(pool.map(wikidata.entity_batch, batches)):
            print(f'Candidate linked audit: {min((index + 1) * 50, len(linked_missing))}/{len(linked_missing)} downloaded', flush=True)
    unlabeled = sorted(qid for qid in candidates if not event_labels.get(qid, {}).get('en') and not event_labels.get(qid, {}).get('fr'))
    language_review = language_review_candidates(raw, ROOT / 'public/data/battles/candidates.json', unlabeled)
    for offset in range(0, len(language_review), 50):
        wikidata.entity_batch(language_review[offset:offset + 50], all_languages=True)
        print(f'Candidate original-language labels and descriptions: {min(offset + 50, len(language_review))}/{len(language_review)}', flush=True)
    report = {'version': 1, 'status': 'complete', 'candidates': len(candidates), 'linked': len(linked), 'candidateIdsSha256': hashlib.sha256((raw / 'candidate-ids.json').read_bytes()).hexdigest(), 'completedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    (raw / 'battle-acquisition.json').write_text(json.dumps(report, indent=2) + '\n')
    print('Candidate audit acquisition complete', flush=True)


if __name__ == '__main__':
    main()
