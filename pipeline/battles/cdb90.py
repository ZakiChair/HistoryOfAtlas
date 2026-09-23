"""Pure, fail-closed conversion of reviewed CDB90 rows to battle profiles.

Acquisition and SHA-256 verification belong to the caller. This module never
fetches, matches names approximately, divides coalition totals, or infers deaths.
"""
from copy import deepcopy
from datetime import date, datetime, time, timedelta
import re
from urllib.parse import unquote, urlsplit


MAX_SAFE_INTEGER = 9_007_199_254_740_991
STRENGTH_CODES = {'1': 'initial personnel strength', '3': 'total personnel engaged'}


def _integer(value, field, *, unknown=False, positive=False):
    if value is None or (isinstance(value, str) and value.strip() in ('', '-1')):
        if unknown:
            return None
        raise ValueError(f'{field}: missing required count')
    if isinstance(value, bool) or not re.fullmatch(r'-?\d+', str(value)):
        raise ValueError(f'{field}: expected an integer')
    number = int(value)
    if number < (1 if positive else 0) or number > MAX_SAFE_INTEGER:
        raise ValueError(f'{field}: count outside safe nonnegative range')
    return number


def _percentage(value, field, *, minus):
    if value is None or value == '':
        return None
    if isinstance(value, bool) or not re.fullmatch(r'-?\d+', str(value)):
        raise ValueError(f'{field}: invalid deviation percentage')
    number = int(value)
    if (minus and not -100 <= number <= 0) or (not minus and not 0 <= number <= MAX_SAFE_INTEGER):
        raise ValueError(f'{field}: deviation percentage has invalid sign or extent')
    # CDB90DEF note 11: zero generally means unknown deviation, not zero error.
    return number if number else None


def _day(value, field):
    if not isinstance(value, dict) or any(type(value.get(k)) is not int for k in ('year', 'month', 'day')):
        raise ValueError(f'{field}: exact year, month and day required')
    try:
        return date(value['year'], value['month'], value['day'])
    except ValueError as error:
        raise ValueError(f'{field}: invalid date') from error


def _period_day(period, boundary):
    values = []
    for suffix in ('min', 'max'):
        text = period.get(f'{boundary}_time_{suffix}', '')
        if not isinstance(text, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', text):
            raise ValueError(f'period {boundary}: missing or malformed timestamp')
        try:
            values.append(datetime.fromisoformat(text))
        except ValueError as error:
            raise ValueError(f'period {boundary}: invalid timestamp') from error
    low, high = values
    # The revised CSV expands an unknown hour to [day midnight, next midnight].
    # That is uncertainty within one source day, not a two-day battle.
    next_midnight = datetime.combine(low.date() + timedelta(days=1), time())
    if high < low or high > next_midnight:
        raise ValueError(f'period {boundary}: date is less precise than one day')
    return low.date()


def _article(value, *, dbpedia=False):
    if not isinstance(value, str) or not value:
        raise ValueError('Missing reviewed article identity')
    if '://' in value:
        parsed = urlsplit(value)
        host, prefix = ('dbpedia.org', '/resource/') if dbpedia else ('en.wikipedia.org', '/wiki/')
        if parsed.scheme not in ('http', 'https') or parsed.hostname != host or not parsed.path.startswith(prefix) or parsed.query or parsed.fragment:
            raise ValueError('Unexpected article identity URL')
        value = parsed.path[len(prefix):]
    elif dbpedia:
        raise ValueError('Expected explicit DBpedia resource URL')
    title = unquote(value).replace(' ', '_')
    if not title or '/' in title or title.startswith(('Category:', 'List_of_')):
        raise ValueError('Unexpected battle article identity')
    return title


def _article_alias_review(match, battle_id, article, published_articles):
    """Validate a curated equivalence claim, never discover or follow redirects."""
    if 'articleAliasReview' not in match:
        return None
    review = match['articleAliasReview']
    fields = {'sourceArticle', 'targetArticle', 'battleId', 'reviewedAt', 'note', 'sources'}
    if not isinstance(review, dict) or set(review) != fields:
        raise ValueError('Article alias requires a complete explicit review')
    source, target = _article(review['sourceArticle']), _article(review['targetArticle'])
    if source != article or target == source or target not in published_articles or review['battleId'] != battle_id:
        raise ValueError('Article alias does not bind the source title to this published battle')
    reviewed_at = review['reviewedAt']
    if not isinstance(reviewed_at, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', reviewed_at):
        raise ValueError('Article alias requires an ISO review date')
    date.fromisoformat(reviewed_at)
    if not isinstance(review['note'], str) or not review['note'].strip():
        raise ValueError('Article alias requires an explanation')
    if not isinstance(review['sources'], list) or not review['sources']:
        raise ValueError('Article alias requires reviewed source evidence')
    for evidence in review['sources']:
        if (not isinstance(evidence, dict) or not {'label', 'url'}.issubset(evidence) or
                not set(evidence).issubset({'label', 'url', 'license'}) or
                any(not isinstance(value, str) or not value.strip() for value in evidence.values())):
            raise ValueError('Invalid article alias source')
        parsed = urlsplit(evidence['url'])
        if parsed.scheme not in ('https', 'http') or not parsed.hostname:
            raise ValueError('Article alias source must be an HTTP(S) URL')
    return {**deepcopy(review), 'sourceArticle': source, 'targetArticle': target}


def _metadata(source_meta):
    if source_meta.get('repository') != 'https://github.com/jrnold/CDB90':
        raise ValueError('Unrecognized CDB90 repository')
    commit = source_meta.get('commit', '')
    if not isinstance(commit, str) or not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('A full immutable CDB90 commit is required')
    if source_meta.get('license') != 'ODC-BY-1.0' or not source_meta.get('attribution'):
        raise ValueError('Missing CDB90 licence or attribution')
    resources = {item.get('path'): item for item in source_meta.get('resources', [])}
    paths = ('data/battles.csv', 'data/belligerents.csv', 'data/active_periods.csv', 'src-data/M000121/CDB90DEF.csv')
    for path in paths:
        digest = resources.get(path, {}).get('sha256', '')
        if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest):
            raise ValueError(f'Missing pinned SHA-256 for {path}')
    return commit, resources


def _source(source_meta, path, label):
    return {'label': label,
            'url': f"{source_meta['repository']}/blob/{source_meta['commit']}/{path}",
            'license': 'Public Domain' if path.startswith('src-data/M000121/') else source_meta['license']}


def _identity_review(entry):
    review = entry.get('identityReview')
    if review is None:
        return None
    if entry.get('participantId') is not None:
        raise ValueError('A local force name review cannot rename a reused participant identity')
    if not isinstance(review, dict) or set(review) != {'name', 'note', 'sources'}:
        raise ValueError('Force identity review requires only name, note and sources')
    name = review['name']
    if (not isinstance(name, dict) or 'en' not in name or
            not set(name).issubset({'en', 'fr', 'de', 'es', 'zh', 'ru'}) or
            any(not isinstance(value, str) or not value.strip() for value in name.values())):
        raise ValueError('Force identity review requires a nonempty localized name')
    if not isinstance(review['note'], str) or not review['note'].strip():
        raise ValueError('Force identity review requires an explanation')
    if not isinstance(review['sources'], list) or not review['sources']:
        raise ValueError('Force identity review requires historical source evidence')
    for source in review['sources']:
        if (not isinstance(source, dict) or not {'label', 'url'}.issubset(source) or
                not set(source).issubset({'label', 'url', 'license'}) or
                any(not isinstance(value, str) or not value.strip() for value in source.values())):
            raise ValueError('Invalid force identity source')
        parsed = urlsplit(source['url'])
        if parsed.scheme not in ('https', 'http') or not parsed.hostname:
            raise ValueError('Force identity source must be an HTTP(S) URL')
    return deepcopy(review)


def _quantity(force, field, source_meta, resources, source_id, *, strength):
    value = _integer(force.get(field), field, unknown=field == 'cas', positive=field == 'str')
    low_pct = _percentage(force.get(field + 'mi'), field + 'mi', minus=True)
    high_pct = _percentage(force.get(field + 'pl'), field + 'pl', minus=False)
    if value is None:
        return None
    side = 'attacker' if force['attacker'] == '1' else 'defender'
    code = str(force['code'])
    description = STRENGTH_CODES[code] if field == 'str' else 'personnel battle casualties; not a count of deaths'
    note = f"CDB90 row {source_id}, {side}: {force['nam']}. {description.capitalize()}. "
    note += f'Tabulated estimate: {value} personnel. '
    note += 'Source estimates; nonzero error percentages are adjudged possible deviations, not confidence intervals. Zero or absent error percentages mean unknown bounds.'
    renderable = field == 'str' or value <= strength
    if not renderable:
        note += ' Casualties exceed the tabulated personnel strength; retained as source evidence without animated depletion. Reinforcements and time scope are not reconstructed.'
    quantity = {
        'value': value, 'counts': 'soldiers', 'scope': 'participant', 'approximate': True,
        'renderable': renderable,
        'statementId': f"CDB90:{source_meta['commit']}:{source_id}:{side}:{field}",
        'property': f'CDB90:{field}', 'rawUnit': 'personnel',
        'qualifiers': {'cdb90': {'sourceId': source_id, 'side': side, 'originalForceName': force['nam'],
                                'actors': force.get('actors', ''), 'strengthCode': code,
                                'strengthInterpretation': STRENGTH_CODES[code],
                                'minusPercent': force.get(field + 'mi', ''),
                                'plusPercent': force.get(field + 'pl', ''),
                                'sourceSha256': resources['data/belligerents.csv']['sha256']}},
        'note': note,
        'sources': [_source(source_meta, 'data/belligerents.csv', f'CDB90 · row {source_id} · {side} · {field}'),
                    _source(source_meta, 'src-data/M000121/CDB90DEF.csv', 'CDB90 original definitions · personnel counts and note 11')],
    }
    if low_pct is not None:
        quantity['min'] = value * (100 + low_pct) // 100
    if high_pct is not None:
        quantity['max'] = (value * (100 + high_pct) + 99) // 100
        if quantity['max'] > MAX_SAFE_INTEGER:
            raise ValueError(f'{field}: upper bound exceeds safe integer range')
    return quantity


def build_profile(*, match, battle, source_battle, forces, periods, source_meta):
    """Return an evidence-preserving curated profile, or ValueError to quarantine.

    Inputs are dictionaries from the reviewed mapping, published record, and
    pinned CSVs. This validates semantic compatibility; it does not verify bytes.
    """
    commit, resources = _metadata(source_meta)
    source_id = _integer(match.get('sourceId'), 'sourceId', positive=True)
    if match.get('decision') != 'approved':
        raise ValueError('Only explicitly approved matches may create profiles')
    if not re.fullmatch(r'Q[1-9]\d*', str(battle.get('id', ''))) or match.get('battleId') != battle['id']:
        raise ValueError('Reviewed battle QID does not match the published record')
    if _integer(source_battle.get('isqno'), 'battle isqno', positive=True) != source_id:
        raise ValueError('Source battle row does not match reviewed sourceId')
    if source_battle.get('parent') not in (None, ''):
        raise ValueError('Parent-linked subengagement cannot replace a full battle')
    if battle.get('medium') != 'land':
        raise ValueError('CDB90 personnel adapter requires a land battle')
    article = _article(match.get('article'))
    if _article(source_battle.get('dbpedia'), dbpedia=True) != article:
        raise ValueError('DBpedia article differs from reviewed exact match')
    published_articles = []
    for source in battle.get('sources', []):
        try:
            published_articles.append(_article(source.get('url', '')))
        except ValueError:
            pass
    alias_review = _article_alias_review(match, battle['id'], article, published_articles)
    if article not in published_articles and alias_review is None:
        raise ValueError('Reviewed English article is absent from published battle sources')
    start = _day(battle.get('start'), 'battle start')
    end = _day(battle.get('end', battle.get('start')), 'battle end')
    if end < start or not periods:
        raise ValueError('Missing or reversed battle period')
    period_numbers, starts, ends = [], [], []
    for period in periods:
        if _integer(period.get('isqno'), 'period isqno', positive=True) != source_id:
            raise ValueError('Active period belongs to a different source battle')
        period_numbers.append(_integer(period.get('atp_number'), 'active period number', positive=True))
        first, last = _period_day(period, 'start'), _period_day(period, 'end')
        if last < first:
            raise ValueError('Active period ends before it begins')
        starts.append(first)
        ends.append(last)
    if sorted(period_numbers) != list(range(1, len(periods) + 1)):
        raise ValueError('Duplicated or missing active periods')
    if min(starts) != start or max(ends) != end:
        raise ValueError('Full source period dates do not equal published battle dates')
    if len(forces) != 2 or {row.get('attacker') for row in forces} != {'0', '1'}:
        raise ValueError('Exactly one attacker and one defender row are required')
    by_side = {row['attacker']: row for row in forces}
    for row in forces:
        if _integer(row.get('isqno'), 'force isqno', positive=True) != source_id:
            raise ValueError('Force belongs to a different source battle')
        if not isinstance(row.get('nam'), str) or row['nam'].strip() in ('', '?'):
            raise ValueError('Original force designation is missing')
        if row.get('code') not in STRENGTH_CODES:
            raise ValueError('Average or unknown personnel strength scope cannot scale armies')
        total = _integer(row.get('str'), 'str', positive=True)
        initial = _integer(row.get('intst'), 'intst', unknown=True)
        _integer(row.get('rerp'), 'rerp', unknown=True)
        if row['code'] == '1' and initial is not None and initial != total:
            raise ValueError('Initial-strength code contradicts the initial personnel count')
    if len({row['code'] for row in forces}) > 1:
        for row in forces:
            initial = _integer(row.get('intst'), 'intst', unknown=True)
            reinforcement = _integer(row.get('rerp'), 'rerp', unknown=True)
            if initial is None or reinforcement is None or initial + reinforcement != int(row['str']):
                raise ValueError('Opposing initial and total-engaged strengths have incompatible scope')
    reviewed = {}
    for entry in match.get('participants', []):
        if not isinstance(entry, dict) or not set(entry).issubset({'side', 'participantId', 'identityReview'}):
            raise ValueError('Unexpected reviewed participant fields')
        side = entry.get('side')
        if side not in ('attacker', 'defender') or side in reviewed:
            raise ValueError('Invalid or duplicate reviewed participant side')
        reviewed[side] = {'participantId': entry.get('participantId'), 'identityReview': _identity_review(entry)}
    participants = []
    identity_notes = []
    for side, marker in (('attacker', '1'), ('defender', '0')):
        row = by_side[marker]
        participant = {'id': f"{battle['id']}:cdb90:{source_id}:{side}", 'name': {'en': row['nam']},
                       'kind': 'military-unit', 'medium': 'land', 'sideId': side}
        old_sources = []
        assignment = reviewed.get(side, {})
        participant_id = assignment.get('participantId')
        if participant_id is not None:
            candidates = [p for p in battle.get('participants', []) if p.get('id') == participant_id]
            if len(candidates) != 1 or candidates[0].get('kind') not in ('polity', 'military-unit'):
                raise ValueError('Reviewed participant must identify an existing military force')
            original = candidates[0]
            if original.get('medium', 'land') != 'land':
                raise ValueError('Reviewed participant is not a land force')
            for key in ('id', 'name', 'kind'):
                if key in original:
                    participant[key] = deepcopy(original[key])
            # Equipment is reapplied by its own pipeline. Only the participant's
            # direct item citation establishes stable identity here; copying event
            # or equipment sources would feed later enrichment back into this import.
            identity_url = f'https://www.wikidata.org/wiki/{participant_id}'
            old_sources = [deepcopy(source) for source in original.get('sources', [])
                           if source.get('url') == identity_url]
        identity_review = assignment.get('identityReview')
        if identity_review:
            participant['name'] = identity_review['name']
            old_sources.extend(identity_review['sources'])
            identity_notes.append(f"Identity review ({side}; original CDB90 name {row['nam']}): {identity_review['note']}")
        if alias_review:
            old_sources.extend(deepcopy(alias_review['sources']))
        strength = _quantity(row, 'str', source_meta, resources, source_id, strength=None)
        casualty = _quantity(row, 'cas', source_meta, resources, source_id, strength=strength['value'])
        sources = []
        seen_urls = set()
        for source in old_sources + [_source(source_meta, 'data/belligerents.csv', f'CDB90 · {source_id} · {side}'),
                                     _source(source_meta, 'data/battles.csv', f'CDB90 · battle {source_id}')]:
            if source['url'] not in seen_urls:
                sources.append(source)
                seen_urls.add(source['url'])
        participant.update(strength=[strength], casualties=[] if casualty is None else [casualty], deaths=[],
                           sources=sources)
        participants.append(participant)
    if participants[0]['id'] == participants[1]['id']:
        raise ValueError('Opposing forces cannot share one participant identity')
    note = (f"Reviewed CDB90 match {source_id}, pinned revision {commit}. {source_meta['attribution']} "
            'Original force designations and strength interpretations are retained with each quantity. '
            'Each side is one aggregate force, including any coalition; its total is not allocated among members. '
            'Personnel casualties are not deaths. Source estimates and adjudged error margins are not statistical confidence intervals. '
            'Equipment and tactical movements are not established by this dataset.')
    if match.get('note'):
        note += ' Match review: ' + str(match['note'])
    if alias_review:
        note += (f" Article alias review ({alias_review['reviewedAt']}; {battle['id']}; "
                 f"{alias_review['sourceArticle']} -> {alias_review['targetArticle']}): {alias_review['note']}")
    if identity_notes:
        note += ' ' + ' '.join(identity_notes)
    return {'participants': participants, 'note': note}
