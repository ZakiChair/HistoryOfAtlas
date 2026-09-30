"""Dominant religion per Cliopatria polity, from Seshat, Wikidata and an editorial supplement.

Default and --check work offline from the committed source extract plus the mapping
and supplement files. --acquire rebuilds the extract from the ignored raw caches
(Seshat Widespread Religion API pages, Wikidata entity dumps, the pinned Cliopatria
archive, the religion item labels). Undated Seshat order-1 codes are deliberately
applied to the polity's lifetime — they label the regime's observed duration, unlike
the reviewed coverage fragment which admits only explicit observation intervals.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import glob
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import zipfile

ROOT = Path(__file__).resolve().parents[2]
EXTRACT = ROOT / 'data/curated/religion-polities-source.json'
MAPPING = ROOT / 'data/curated/religion-polities-mapping.json'
SUPPLEMENT = ROOT / 'data/curated/religion-polities-supplement.json'
OUTPUT = ROOT / 'public/data/religions/polities.json'
REPORT = ROOT / 'data/reports/religion-polities.json'
ACQUIRED_AT = '2026-09-30'
CLIO_COMMIT = 'ad28a691b7c07c1fca89d0e0636d324667d2a258'
CLIO_URL = f'https://github.com/Seshat-Global-History-Databank/cliopatria/tree/{CLIO_COMMIT}'
SESHAT_PAGES = 13
SESHAT_EXPECTED = 1206
COVERAGE_YEARS = [-2500, -1500, -800, -300, 1, 200, 400, 600, 800, 1000,
                  1200, 1400, 1500, 1600, 1700, 1800, 1850, 1900, 1950]
OTHER_EVIDENCE = {'v_m': 'majority', 'o_h_p': 'majority', 'sz_m': 'substantial'}
EVIDENCE_RANK = {'majority': 2, 'predominant': 1}
BASIS_RANK = {'editorial': 3, 'seshat': 2, 'wikidata': 1}


def astro(year):
    return year + 1 if year < 0 else year


def clean_name(value):
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def entity_id(name):
    normalized = unicodedata.normalize('NFKC', name).casefold()
    return 'clio-' + hashlib.sha256(normalized.encode()).hexdigest()[:14]


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n'


def wikidata_time(statement, prop):
    """Astro year from a P580/P582 qualifier, or None."""
    qualifiers = statement.get('qualifiers') or {}
    for claim in qualifiers.get(prop, []):
        value = (claim.get('datavalue') or {}).get('value') or {}
        match = re.fullmatch(r'([+-])(\d+)-\d{2}-\d{2}T.*', str(value.get('time') or ''))
        if match:
            year = int(match.group(2)) * (-1 if match.group(1) == '-' else 1)
            return astro(year)
    return None


def acquire():
    pages = [ROOT / f'data/raw/religions/seshat-widespread-page{i}.json' for i in range(1, SESHAT_PAGES + 1)]
    records = []
    for path in pages:
        page = json.loads(path.read_text())
        if page.get('count') != SESHAT_EXPECTED:
            raise RuntimeError(f'Seshat page {path.name}: expected {SESHAT_EXPECTED} records, got {page.get("count")}')
        records += page['results']
    if len(records) != SESHAT_EXPECTED or len({r['id'] for r in records}) != SESHAT_EXPECTED:
        raise RuntimeError('Incomplete or duplicate Seshat widespread-religion acquisition')

    archive_path = ROOT / 'data/raw/geography/cliopatria.geojson.zip'
    with zipfile.ZipFile(archive_path) as archive:
        features = json.loads(archive.read('cliopatria_polities_only.geojson'))['features']
    entities = {}
    for feature in features:
        props = feature.get('properties') or {}
        if props.get('Type') != 'POLITY' or not props.get('Name'):
            continue
        name = clean_name(props['Name'])
        start, end = astro(int(props['FromYear'])), astro(int(props['ToYear']))
        seshat_ids = [s for s in str(props.get('SeshatID') or '').split(';') if s]
        qid = props.get('Wikidata', '')
        qid = qid if re.fullmatch(r'Q[1-9][0-9]*', qid or '') else None
        key = entity_id(name)
        entity = entities.setdefault(key, {
            'id': key, 'name': name, 'wikidataId': qid, 'seshatIds': set(),
            'firstObserved': start, 'lastObserved': end, 'records': [],
        })
        entity['seshatIds'].update(seshat_ids)
        entity['firstObserved'] = min(entity['firstObserved'], start)
        entity['lastObserved'] = max(entity['lastObserved'], end)
        if qid and not entity['wikidataId']:
            entity['wikidataId'] = qid
        entity['records'].append({'from': start, 'to': end, 'seshatIds': seshat_ids,
                                  'areaKm2': round(float(props['Area']))})
    for entity in entities.values():
        entity['seshatIds'] = sorted(entity['seshatIds'])
        entity['records'].sort(key=lambda r: (r['from'], r['to']))

    seshat = [{
        'id': r['id'],
        'polity': {k: r['polity'][k] for k in ('name', 'long_name', 'start_year', 'end_year')},
        'year_from': r.get('year_from'),
        'year_to': r.get('year_to'),
        'order': str(r.get('order')),
        'degree_of_prevalence': r.get('degree_of_prevalence'),
        'religion_name': (r.get('widespread_religion') or {}).get('religion_name'),
        'is_disputed': bool(r.get('is_disputed')),
        'is_uncertain': bool(r.get('is_uncertain')),
    } for r in records]

    wanted_qids = {e['wikidataId'] for e in entities.values() if e['wikidataId']}
    wikidata = {}
    items = set()
    for path in sorted(glob.glob(str(ROOT / 'data/raw/wikidata/entities-*.json'))):
        if '.meta.' in path:
            continue
        for qid, entity in json.loads(Path(path).read_text()).get('entities', {}).items():
            if qid not in wanted_qids:
                continue
            statements = []
            for claim in entity.get('claims', {}).get('P140', []):
                if claim.get('rank') == 'deprecated':
                    continue
                value = ((claim.get('mainsnak') or {}).get('datavalue') or {}).get('value') or {}
                item = value.get('id')
                if not item:
                    continue
                items.add(item)
                statements.append({'item': item,
                                   'rank': 'preferred' if claim.get('rank') == 'preferred' else 'normal',
                                   'start': wikidata_time(claim, 'P580'),
                                   'end': wikidata_time(claim, 'P582')})
            if statements:
                wikidata[qid] = statements

    labels_path = ROOT / 'data/raw/religions/wikidata-religion-items.json'
    labels = json.loads(labels_path.read_text())
    wikidata_items = {}
    for qid in sorted(items):
        entry = labels.get(qid) or {}
        wikidata_items[qid] = {'en': entry.get('en') or qid, 'fr': entry.get('fr') or entry.get('en') or qid}

    acquisition = [{'cacheFile': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                   for p in pages + [archive_path, labels_path]]
    extract = {
        'version': 1,
        'acquiredAt': ACQUIRED_AT,
        'acquisition': acquisition,
        'cliopatria': {'commit': CLIO_COMMIT},
        'entities': sorted(entities.values(), key=lambda e: e['name']),
        'seshat': seshat,
        'wikidata': wikidata,
        'wikidataItems': wikidata_items,
    }
    EXTRACT.write_text(encoded(extract))
    print(f'Acquired {len(entities)} entities, {len(seshat)} Seshat records, '
          f'{len(wikidata)} Wikidata polities ({len(wikidata_items)} items).')


def _overlap(a, b):
    return max(a['from'], b['from']), min(a['to'], b['to'])


def _unique(parts):
    seen = []
    for part in parts:
        if part and part not in seen:
            seen.append(part)
    return seen


def seshat_spans(entity, by_polity, mapping):
    """Order-1 spans per dated Cliopatria record, plus the polity's other codings."""
    spans = []
    notes = mapping.get('seshatNotes', {})
    skipped = set(mapping['seshatSkippedOrder1Prevalence'])
    unmapped = set()
    for record in entity['records']:
        candidates = []
        for seshat_id in record['seshatIds']:
            for row in by_polity.get(seshat_id, []):
                if row['order'] != '1':
                    continue
                name = row['religion_name']
                if name is None:
                    continue
                if name not in mapping['seshat']:
                    unmapped.add(name)
                    continue
                family = mapping['seshat'][name]
                if family is None:
                    continue
                code = str(row['degree_of_prevalence']) if row['degree_of_prevalence'] is not None else 'null'
                if code in skipped:
                    continue
                if code not in mapping['seshatPrevalence']:
                    raise ValueError(f'Unknown Seshat prevalence code: {code}')
                prevalence = mapping['seshatPrevalence'][code]
                polity = row['polity']
                dated = row['year_from'] is not None
                if dated:
                    start = astro(row['year_from'])
                    end = astro(row['year_to']) if row['year_to'] is not None else astro(polity['end_year'])
                else:
                    start, end = astro(polity['start_year']), astro(polity['end_year'])
                start, end = max(start, record['from']), min(end, record['to'])
                if start > end:
                    continue
                note_parts = []
                if name in notes:
                    note_parts.append(notes[name])
                if not dated:
                    note_parts.append({
                        'fr': f'Code Seshat non daté, appliqué à la durée du régime politique {polity["start_year"]}–{polity["end_year"]}.',
                        'en': f"Undated Seshat code applied to the polity's lifetime {polity['start_year']}–{polity['end_year']}.",
                    })
                candidates.append({
                    'from': start, 'to': end, 'familyId': family, 'dated': dated,
                    'evidence': prevalence['evidence'], 'basis': 'seshat',
                    'label': {'fr': f'{name} — {prevalence["label"]["fr"]}',
                              'en': f'{name} — {prevalence["label"]["en"]}'},
                    'note': note_parts,
                    'links': [{'label': f'Seshat record {row["id"]}',
                               'url': f'https://seshat-db.com/api/rt/widespread-religions/{row["id"]}/'}],
                    'sourceIds': ['seshat', 'cliopatria'],
                    'recordIds': [row['id']],
                    'seshatPolity': seshat_id,
                })
        spans.append((record, candidates))
    return spans, unmapped


def resolve_seshat(entity, seshat_record_spans, by_polity, mapping):
    """Per dated record: dated codes override undated ones; equal-rank conflicts drop the overlap."""
    spans, conflicts = [], []
    for record, candidates in seshat_record_spans:
        if not candidates:
            continue
        boundary = sorted({n for c in candidates for n in (c['from'], c['to'] + 1)})
        run = None
        for start, stop in zip(boundary, boundary[1:]):
            end = stop - 1
            covering = [c for c in candidates if c['from'] <= start and c['to'] >= end]
            dated = [c for c in covering if c['dated']]
            pool = dated or covering
            families = {c['familyId'] for c in pool}
            key = None
            if len(families) == 1:
                key = families.pop()
            if run and run['familyId'] == key and run['to'] == start - 1:
                run['to'] = end
                run['members'] |= {c['recordIds'][0] for c in pool}
                continue
            if run:
                spans.append(run)
            run = {'from': start, 'to': end, 'familyId': key, 'members': {c['recordIds'][0] for c in pool}} if key else None
            if len(families) > 1:
                conflicts.append({'entity': entity['name'], 'record': f"{record['from']}–{record['to']}",
                                  'years': f'{start}–{end}', 'families': sorted(families),
                                  'records': sorted({c['recordIds'][0] for c in pool})})
        if run:
            spans.append(run)
    merged = []
    for run in spans:
        members = [c for record, candidates in seshat_record_spans for c in candidates
                   if c['recordIds'][0] in run['members']]
        evidence = max(members, key=lambda c: EVIDENCE_RANK[c['evidence']])['evidence']
        span = {
            'from': run['from'], 'to': run['to'], 'familyId': run['familyId'],
            'evidence': evidence, 'basis': 'seshat',
            'label': {'fr': ' ; '.join(_unique(c['label']['fr'] for c in members)),
                      'en': ' ; '.join(_unique(c['label']['en'] for c in members))},
            'links': [json.loads(link) for link in _unique(
                json.dumps(link, sort_keys=True) for c in members for link in c['links'])],
            'sourceIds': ['seshat', 'cliopatria'],
            'seshatPolities': sorted({c['seshatPolity'] for c in members}),
        }
        notes = [part for c in members for part in c['note']]
        if notes:
            span['note'] = {'fr': ' '.join(_unique(p['fr'] for p in notes)),
                            'en': ' '.join(_unique(p['en'] for p in notes))}
        merged.append(span)
    # Other codings of the same Seshat polities, attached for context.
    for span in merged:
        others = []
        for seshat_id in span['seshatPolities']:
            for row in by_polity.get(seshat_id, []):
                name = row['religion_name']
                if name is None or name not in mapping['seshat']:
                    continue
                family = mapping['seshat'][name]
                if family is None or family == span['familyId']:
                    continue
                code = str(row['degree_of_prevalence']) if row['degree_of_prevalence'] is not None else 'null'
                others.append({'familyId': family,
                               'label': {'fr': name, 'en': name},
                               'evidence': OTHER_EVIDENCE.get(code, 'presence'),
                               '_name': name})
        seen = set()
        ordered = sorted(others, key=lambda o: -{'majority': 2, 'substantial': 1, 'presence': 0}[o['evidence']])
        span['others'] = []
        for other in ordered:
            key = (other['familyId'], other['label']['en'])
            if key in seen:
                continue
            seen.add(key)
            other.pop('_name')
            span['others'].append(other)
            if len(span['others']) == 6:
                break
        if not span['others']:
            span.pop('others')
        span.pop('seshatPolities')
    return merged, conflicts


def bridge_seshat_gaps(spans):
    """Extend the earlier of two consecutive same-family Seshat spans over a ≤10-year gap."""
    bridged = []
    for span in sorted(spans, key=lambda s: s['from']):
        previous = bridged[-1] if bridged else None
        gap = span['from'] - previous['to'] - 1 if previous else None
        if previous and previous['familyId'] == span['familyId'] and 1 <= gap <= 10:
            bridge = {k: v for k, v in previous.items()}
            bridge['from'], bridge['to'] = previous['to'] + 1, span['from'] - 1
            bridge['evidence'] = min(previous['evidence'], span['evidence'],
                                     key=lambda e: EVIDENCE_RANK[e])
            gap_note = {
                'fr': f'Lacune de {gap} an(s) entre deux régimes codés par Seshat, comblée.',
                'en': f'Gap of {gap} year(s) between two Seshat-coded polities, bridged.',
            }
            bridge['note'] = ({'fr': previous['note']['fr'] + ' ' + gap_note['fr'],
                               'en': previous['note']['en'] + ' ' + gap_note['en']}
                              if previous.get('note') else gap_note)
            bridged.append(bridge)
        bridged.append(span)
    return bridged


def wikidata_spans(entity, statements, mapping, items):
    """P140 statements resolved by rank (preferred > normal) then dates (dated > undated).

    Each statement is first clipped to the family/item minimum year so an undated
    claim never paints a denomination before it existed. The returned `info` list
    keeps every usable statement, clipped, in claim order — display only.
    """
    spans, secular, ambiguous, unmapped, info = [], [], [], set(), []
    notes = mapping.get('wikidataNotes', {})
    family_min = {f['id']: f.get('minYear') for f in mapping['families']}
    item_min = mapping.get('wikidataItemMinYear', {})
    usable = []
    for index, statement in enumerate(statements):
        item = statement['item']
        if item in mapping['wikidataGeneric']:
            continue
        if item not in mapping['wikidata']:
            unmapped.add(item)
            continue
        family = mapping['wikidata'][item]
        label = items.get(item) or {'en': item, 'fr': item}
        minimum = max((v for v in (family_min.get(family), item_min.get(item)) if v is not None),
                      default=None)
        start = statement['start'] if statement['start'] is not None else entity['firstObserved']
        end = statement['end'] if statement['end'] is not None else entity['lastObserved']
        if minimum is not None:
            start = max(start, minimum)
        info.append({'item': item, 'label': label, 'familyId': family,
                     **({'from': start} if start != entity['firstObserved'] else {}),
                     **({'to': end} if end != entity['lastObserved'] else {})})
        usable.append({**statement, 'index': index, 'familyId': family, 'label': label,
                       'dated': statement['start'] is not None or statement['end'] is not None,
                       'from': start, 'to': end})
    usable = [s for s in usable if s['from'] <= s['to']]
    boundary = sorted({entity['firstObserved'], entity['lastObserved'] + 1} |
                      {n for s in usable for n in (s['from'], s['to'] + 1)})
    for start, stop in zip(boundary, boundary[1:]):
        end = stop - 1
        covering = [s for s in usable if s['from'] <= start and s['to'] >= end]
        if not covering:
            continue
        best_rank = max(s['rank'] == 'preferred' for s in covering)
        pool = [s for s in covering if (s['rank'] == 'preferred') == best_rank]
        dated = [s for s in pool if s['dated']]
        if dated:
            pool = dated
        winner = min(pool, key=lambda s: s['index'])
        rivals = [s for s in pool if s is not winner and s['familyId'] != winner['familyId']]
        family = winner['familyId']
        kind = next((f['kind'] for f in mapping['families'] if f['id'] == family), 'religion')
        if kind == 'unaffiliated':
            secular.append({'from': start, 'to': end, 'label': winner['label']})
            continue
        span = {'from': start, 'to': end, 'familyId': family, 'evidence': 'state', 'basis': 'wikidata',
                'label': winner['label'],
                'links': [{'label': winner['item'], 'url': f'https://www.wikidata.org/wiki/{winner["item"]}'}],
                'sourceIds': ['wikidata', 'cliopatria']}
        if winner['item'] in notes:
            span['note'] = notes[winner['item']]
        if rivals:
            span['ambiguous'] = True
            span['alternatives'] = [{'familyId': s['familyId'], 'label': s['label']} for s in rivals]
            ambiguous.append({'entity': entity['name'], 'wikidataId': entity['wikidataId'],
                              'years': f'{start}–{end}', 'chosen': winner['item'],
                              'alternatives': [s['item'] for s in rivals]})
        spans.append(span)
    return spans, secular, ambiguous, unmapped, info


def merge_layers(entity, layers):
    """Rasterize precedence: editorial > seshat > editorial-fallback > wikidata."""
    def rank(span):
        if span['basis'] == 'editorial':
            return 3 if span.get('_priority') != 'fallback' else 1.5
        return BASIS_RANK[span['basis']]

    spans = []
    ranked = sorted([s for basis in ('editorial', 'seshat', 'wikidata') for s in layers.get(basis, [])],
                    key=lambda s: -rank(s))
    boundary = sorted({entity['firstObserved'], entity['lastObserved'] + 1} |
                      {n for s in ranked for n in (s['from'], s['to'] + 1)})
    run = None
    for start, stop in zip(boundary, boundary[1:]):
        end = stop - 1
        covering = [s for s in ranked if s['from'] <= start and s['to'] >= end]
        winner = covering[0] if covering else None
        if winner is None:
            if run:
                spans.append(run)
                run = None
            continue
        state = winner.get('state')
        signature = (id(winner), json.dumps(state, sort_keys=True))
        if run and run['signature'] == signature and run['to'] == start - 1:
            run['to'] = end
            continue
        if run:
            spans.append(run)
        run = {**{k: v for k, v in winner.items() if k != 'dated'},
               'from': start, 'to': end, 'signature': signature}
        if state:
            run['state'] = state
    if run:
        spans.append(run)
    for span in spans:
        span.pop('signature', None)
    return spans


def build(extract, mapping, supplement):
    families = {f['id']: f for f in mapping['families']}
    by_polity = defaultdict(list)
    for row in extract['seshat']:
        by_polity[row['polity']['name']].append(row)
    items = extract['wikidataItems']
    unmapped_seshat, unmapped_wikidata = set(), set()
    conflicts, ambiguous, secular_list, overrides = [], [], [], set()
    excluded_list = []
    polities = []
    subjects = {s['name']: s for s in supplement['subjects']}
    unknown_subjects = [name for name in subjects if name not in {e['name'] for e in extract['entities']}]
    if unknown_subjects:
        raise ValueError(f'Supplement subjects without a Cliopatria entity: {sorted(unknown_subjects)}')

    for entity in extract['entities']:
        layers = {'seshat': [], 'wikidata': [], 'editorial': []}
        entity_secular = []
        entity_wikidata = []
        record_spans, unknown = seshat_spans(entity, by_polity, mapping)
        unmapped_seshat |= unknown
        layers['seshat'], entity_conflicts = resolve_seshat(entity, record_spans, by_polity, mapping)
        layers['seshat'] = bridge_seshat_gaps(layers['seshat'])
        conflicts += entity_conflicts
        qid = entity['wikidataId']
        if qid and qid in extract['wikidata']:
            wd_spans, secular, amb, unknown_wd, info = wikidata_spans(
                entity, extract['wikidata'][qid], mapping, items)
            layers['wikidata'] = wd_spans
            ambiguous += amb
            unmapped_wikidata |= unknown_wd
            entity_secular = secular
            entity_wikidata = info
            if secular:
                secular_list.append({'entity': entity['name'], 'wikidataId': qid, 'periods': secular})
        subject = subjects.get(entity['name'])
        excluded = subject.get('exclude') if subject else None
        if subject and not excluded:
            for span in subject['spans']:
                state = None
                if span.get('state'):
                    state = {'familyId': span['state'], 'label': families[span['state']]['names']}
                editorial = {
                    'from': span.get('from', entity['firstObserved']),
                    'to': span.get('to', entity['lastObserved']),
                    'familyId': span['familyId'], 'evidence': span['evidence'], 'basis': 'editorial',
                    'label': families[span['familyId']]['names'],
                    'note': span.get('note'), 'sourceIds': list(span['sourceIds']),
                    'links': [], 'state': state,
                }
                if span.get('priority') == 'fallback':
                    editorial['_priority'] = 'fallback'
                layers['editorial'].append(editorial)
                if (span.get('priority') != 'fallback'
                        and any(s['from'] <= editorial['to'] and s['to'] >= editorial['from']
                                for s in layers['seshat'] + layers['wikidata'])):
                    overrides.add(entity['name'])
        merged = [] if excluded else merge_layers(entity, layers)
        # Post-merge: a ≤2-year Wikidata sliver between spans of other bases is an artefact.
        merged = [s for i, s in enumerate(merged)
                  if not (s['basis'] == 'wikidata' and s['to'] - s['from'] <= 1
                          and i > 0 and i < len(merged) - 1
                          and merged[i - 1]['basis'] != 'wikidata'
                          and merged[i + 1]['basis'] != 'wikidata')]
        # Coalesce adjacent identical spans.
        coalesced = []
        for span in merged:
            span.pop('_priority', None)
            span = {k: v for k, v in span.items() if v not in (None, [])}
            if (coalesced and coalesced[-1]['to'] == span['from'] - 1
                    and all(coalesced[-1].get(k) == span.get(k)
                            for k in ('familyId', 'evidence', 'basis', 'label', 'note', 'state',
                                      'ambiguous', 'alternatives'))):
                coalesced[-1]['to'] = span['to']
                continue
            coalesced.append(span)
        entity_secular = [{k: v for k, v in s.items() if v is not None} for s in entity_secular]
        if not coalesced and not entity_secular and not excluded:
            continue
        polity = {'entityId': entity['id'], 'name': entity['name'],
                  'spans': sorted(coalesced, key=lambda s: s['from'])}
        if excluded:
            polity['excluded'] = excluded
            excluded_list.append(entity['name'])
        if qid:
            polity['wikidataId'] = qid
        if entity_secular:
            polity['secular'] = entity_secular
        if entity_wikidata:
            polity['wikidata'] = entity_wikidata
        polities.append(polity)
    if unmapped_seshat:
        raise ValueError(f'Unmapped Seshat religion names: {sorted(unmapped_seshat)}')
    if unmapped_wikidata:
        raise ValueError(f'Unmapped Wikidata P140 items: {sorted(unmapped_wikidata)}')

    polities.sort(key=lambda p: p['name'])
    sources = [
        {'id': 'seshat', 'title': 'Seshat Global History Databank — Widespread Religion',
         'url': 'https://seshat-db.com/rt/widespread_religions_all/', 'license': 'CC-BY-SA-4.0',
         'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/'},
        {'id': 'wikidata', 'title': 'Wikidata — religion or worldview (P140) of the polity items',
         'url': 'https://www.wikidata.org/wiki/Property:P140', 'license': 'CC0-1.0',
         'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/'},
        {'id': 'cliopatria', 'title': 'Cliopatria · Seshat Global History Databank — polity identity and dated outlines',
         'url': CLIO_URL, 'license': 'CC-BY-4.0',
         'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/'},
    ]
    for source in supplement['sources']:
        entry = dict(source)
        if source['id'].startswith('wikipedia-'):
            entry['license'] = 'CC BY-SA 4.0 (text) — encyclopaedic notice'
            entry['licenseUrl'] = 'https://creativecommons.org/licenses/by-sa/4.0/'
        sources.append(entry)
    output = {
        'version': 1,
        'acquiredAt': extract['acquiredAt'],
        'reviewedAt': supplement['reviewedAt'],
        'families': mapping['families'],
        'evidence': {
            'majority': {'fr': 'Majorité documentée dans la population', 'en': 'Documented population majority'},
            'predominant': {'fr': 'Religion la plus répandue (sans majorité mesurée)',
                            'en': 'Most widespread religion (no measured majority)'},
            'state': {'fr': 'Religion d’État ou officielle seulement', 'en': 'State or official religion only'},
        },
        'sources': sources,
        'polities': polities,
    }

    alive_at = {y: [e for e in extract['entities'] if e['firstObserved'] <= y <= e['lastObserved']]
                for y in COVERAGE_YEARS}
    span_index = {p['entityId']: p['spans'] for p in polities}
    coverage = []
    for year in COVERAGE_YEARS:
        alive = alive_at[year]
        area = 0
        attributed_area = Counter()
        attributed = 0
        by_evidence = Counter()
        for entity in alive:
            record_area = sum(r['areaKm2'] for r in entity['records'] if r['from'] <= year <= r['to'])
            area += record_area
            covering = [s for s in span_index.get(entity['id'], []) if s['from'] <= year <= s['to']]
            if covering:
                attributed += 1
                by_evidence[covering[0]['evidence']] += 1
                attributed_area[covering[0]['evidence']] += record_area
        coverage.append({'year': year, 'alive': len(alive), 'attributed': attributed,
                         'areaKm2': area,
                         'byEvidence': {e: {'polities': by_evidence[e],
                                            'areaKm2': attributed_area[e],
                                            'areaShare': round(attributed_area[e] / area, 4) if area else 0}
                                        for e in ('majority', 'predominant', 'state')}})
    report = {
        'entities': len(extract['entities']),
        'entitiesWithSpans': len(polities),
        'spansByBasis': dict(Counter(s['basis'] for p in polities for s in p['spans'])),
        'spansByEvidence': dict(Counter(s['evidence'] for p in polities for s in p['spans'])),
        'politiesByBasis': dict(Counter(b for p in polities for b in {s['basis'] for s in p['spans']})),
        'conflicts': conflicts,
        'wikidataAmbiguous': ambiguous,
        'secular': secular_list,
        'supplementOverrides': sorted(overrides),
        'excluded': excluded_list,
        'unmappedSeshatNames': sorted(unmapped_seshat),
        'unmappedWikidataItems': sorted(unmapped_wikidata),
        'coverageByYear': coverage,
    }
    return output, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--acquire', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.acquire and args.check:
        parser.error('--acquire cannot be combined with --check')
    if args.acquire:
        acquire()
    extract = json.loads(EXTRACT.read_text())
    mapping = json.loads(MAPPING.read_text())
    supplement = json.loads(SUPPLEMENT.read_text())
    output, report = build(extract, mapping, supplement)
    for path, value in ((OUTPUT, output), (REPORT, report)):
        expected = encoded(value)
        if args.check:
            if not path.exists() or path.read_text() != expected:
                raise RuntimeError(f'Stale religion-polities output: {path.relative_to(ROOT)}')
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(expected)
    print(f'Religion polities: {report["entitiesWithSpans"]}/{report["entities"]} entities; '
          f'{sum(report["spansByBasis"].values())} spans; {len(report["conflicts"])} conflicts; '
          f'{len(report["wikidataAmbiguous"])} ambiguous.')


if __name__ == '__main__':
    main()
