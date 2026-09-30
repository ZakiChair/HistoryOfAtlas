"""Religion-by-polity attribution: intervals, precedence, secular states, fail-fast."""
import json
import unittest
from pathlib import Path

from polities import build, clean_name, entity_id

ROOT = Path(__file__).resolve().parents[2]


def mapping():
    return {
        'families': [
            {'id': 'christianity', 'names': {'fr': 'Christianismes', 'en': 'Christian traditions'},
             'color': '#c084d8', 'symbol': 'cross', 'kind': 'religion'},
            {'id': 'islam', 'names': {'fr': 'Islam', 'en': 'Islam'},
             'color': '#249c66', 'symbol': 'crescent', 'kind': 'religion'},
            {'id': 'unaffiliated', 'names': {'fr': 'Sans affiliation', 'en': 'Unaffiliated'},
             'color': '#8b919a', 'symbol': 'circle', 'kind': 'unaffiliated'},
        ],
        'seshatPrevalence': {
            'v_m': {'evidence': 'majority', 'label': {'fr': 'vaste majorité', 'en': 'vast majority'}},
            'unc': {'evidence': 'predominant', 'label': {'fr': 'prévalence incertaine', 'en': 'uncertain prevalence'}},
            'null': {'evidence': 'predominant', 'label': {'fr': 'prévalence non codée', 'en': 'prevalence not coded'}},
        },
        'seshatSkippedOrder1Prevalence': ['a_m'],
        'seshat': {'Christianity': 'christianity', 'Islam': 'islam', 'Vague Belief': None},
        'seshatNotes': {},
        'wikidataGeneric': ['Q9'],
        'wikidata': {'Q1': 'christianity', 'Q2': 'islam', 'Q3': 'unaffiliated'},
        'wikidataNotes': {},
    }


def entity(name='Testia', start=100, end=300):
    return {'id': entity_id(name), 'name': name, 'wikidataId': 'Q100',
            'seshatIds': ['te_testia'], 'firstObserved': start, 'lastObserved': end,
            'records': [{'from': start, 'to': end, 'seshatIds': ['te_testia'], 'areaKm2': 10}]}


def seshat_row(rid, name='Christianity', order='1', code='v_m', yf=None, yt=None):
    return {'id': rid, 'polity': {'name': 'te_testia', 'long_name': 'Testia',
                                  'start_year': 100, 'end_year': 300},
            'year_from': yf, 'year_to': yt, 'order': order, 'degree_of_prevalence': code,
            'religion_name': name, 'is_disputed': False, 'is_uncertain': False}


def extract(**over):
    base = {'version': 1, 'acquiredAt': '2026-09-30', 'entities': [entity()],
            'seshat': [], 'wikidata': {},
            'wikidataItems': {'Q1': {'en': 'Christianity', 'fr': 'christianisme'},
                              'Q2': {'en': 'Islam', 'fr': 'islam'},
                              'Q3': {'en': 'state atheism', 'fr': "athéisme d'État"}}}
    base.update(over)
    return base


def supplement(subjects=None):
    return {'version': 1, 'reviewedAt': '2026-09-30', 'sources': [], 'subjects': subjects or []}


def spans_at(result, year):
    polity = result['polities'][0]
    return [s for s in polity['spans'] if s['from'] <= year <= s['to']]


class EntityIdentityTests(unittest.TestCase):
    def test_ids_reproduce_the_published_polity_index(self):
        index = json.loads((ROOT / 'public/geo/polities.json').read_text())
        self.assertGreater(len(index), 1000)
        for entry in index:
            with self.subTest(entry['name']):
                self.assertEqual(entity_id(clean_name(entry['name'])), entry['id'])


class SeshatLayerTests(unittest.TestCase):
    def test_undated_code_covers_the_polity_lifetime_with_a_note(self):
        result, _ = build(extract(seshat=[seshat_row(1, yf=None)]), mapping(), supplement())
        span = result['polities'][0]['spans'][0]
        self.assertEqual((span['from'], span['to']), (100, 300))
        self.assertEqual(span['evidence'], 'majority')
        self.assertIn('lifetime', span['note']['en'])
        self.assertEqual(span['links'][0]['url'],
                         'https://seshat-db.com/api/rt/widespread-religions/1/')

    def test_dated_code_cuts_the_undated_one(self):
        result, _ = build(extract(seshat=[seshat_row(1, 'Christianity', yf=None),
                                          seshat_row(2, 'Islam', code='v_m', yf=200, yt=250)]),
                          mapping(), supplement())
        spans = result['polities'][0]['spans']
        self.assertEqual([(s['from'], s['to'], s['familyId']) for s in spans],
                         [(100, 199, 'christianity'), (200, 250, 'islam'), (251, 300, 'christianity')])

    def test_different_families_at_equal_rank_drop_the_overlap(self):
        result, report = build(extract(seshat=[seshat_row(1, 'Christianity', yf=100, yt=220),
                                               seshat_row(2, 'Islam', code='v_m', yf=180, yt=300)]),
                               mapping(), supplement())
        spans = result['polities'][0]['spans']
        self.assertEqual([(s['from'], s['to'], s['familyId']) for s in spans],
                         [(100, 179, 'christianity'), (221, 300, 'islam')])
        self.assertEqual(len(report['conflicts']), 1)
        self.assertEqual(spans_at(result, 200), [])

    def test_same_family_records_merge_keeping_the_stronger_evidence(self):
        result, _ = build(extract(seshat=[seshat_row(1, 'Christianity', code='unc', yf=100, yt=200),
                                          seshat_row(2, 'Christianity', code='v_m', yf=150, yt=250)]),
                          mapping(), supplement())
        spans = result['polities'][0]['spans']
        self.assertEqual([(s['from'], s['to'], s['evidence']) for s in spans],
                         [(100, 250, 'majority')])
        self.assertIn(' ; ', spans[0]['label']['en'])

    def test_skipped_prevalence_and_null_family_do_not_fill(self):
        result, _ = build(extract(seshat=[seshat_row(1, 'Islam', code='a_m'),
                                          seshat_row(2, 'Vague Belief')]),
                          mapping(), supplement())
        self.assertEqual(result['polities'], [])

    def test_unmapped_religion_name_fails_the_build(self):
        with self.assertRaises(ValueError):
            build(extract(seshat=[seshat_row(1, 'Mystery Cult')]), mapping(), supplement())


class WikidataLayerTests(unittest.TestCase):
    def test_undated_statement_covers_the_entity_lifetime(self):
        source = extract(wikidata={'Q100': [{'item': 'Q1', 'rank': 'normal', 'start': None, 'end': None}]})
        result, _ = build(source, mapping(), supplement())
        span = result['polities'][0]['spans'][0]
        self.assertEqual((span['from'], span['to'], span['evidence'], span['basis']),
                         (100, 300, 'state', 'wikidata'))

    def test_dated_statement_beats_undated_and_preferred_beats_normal(self):
        source = extract(wikidata={'Q100': [
            {'item': 'Q2', 'rank': 'normal', 'start': None, 'end': None},
            {'item': 'Q1', 'rank': 'normal', 'start': 150, 'end': 200},
            {'item': 'Q2', 'rank': 'preferred', 'start': 250, 'end': 280},
        ]})
        result, _ = build(source, mapping(), supplement())
        spans = result['polities'][0]['spans']
        self.assertEqual([(s['from'], s['to'], s['familyId']) for s in spans],
                         [(100, 149, 'islam'), (150, 200, 'christianity'), (201, 300, 'islam')])

    def test_equal_standing_different_families_report_ambiguity(self):
        source = extract(wikidata={'Q100': [
            {'item': 'Q2', 'rank': 'normal', 'start': 150, 'end': 200},
            {'item': 'Q1', 'rank': 'normal', 'start': 180, 'end': 300},
        ]})
        result, report = build(source, mapping(), supplement())
        span = [s for s in result['polities'][0]['spans'] if s['from'] <= 190 <= s['to']][0]
        self.assertEqual(span['familyId'], 'islam')
        self.assertTrue(span['ambiguous'])
        self.assertEqual(span['alternatives'][0]['familyId'], 'christianity')
        self.assertEqual(len(report['wikidataAmbiguous']), 1)

    def test_unaffiliated_becomes_a_secular_note_not_a_fill(self):
        source = extract(wikidata={'Q100': [{'item': 'Q3', 'rank': 'normal', 'start': None, 'end': None}]})
        result, report = build(source, mapping(), supplement())
        polity = result['polities'][0]
        self.assertEqual(polity['spans'], [])
        self.assertEqual(polity['secular'], [{'from': 100, 'to': 300,
                                              'label': {'en': 'state atheism', 'fr': "athéisme d'État"}}])
        self.assertEqual(report['secular'][0]['entity'], 'Testia')

    def test_unmapped_item_fails_the_build(self):
        source = extract(wikidata={'Q100': [{'item': 'Q77', 'rank': 'normal', 'start': None, 'end': None}]})
        with self.assertRaises(ValueError):
            build(source, mapping(), supplement())


class SupplementAndMergeTests(unittest.TestCase):
    def test_editorial_overrides_seshat_and_wikidata(self):
        source = extract(seshat=[seshat_row(1, 'Christianity', yf=None)],
                         wikidata={'Q100': [{'item': 'Q1', 'rank': 'normal', 'start': None, 'end': None}]})
        supp = supplement([{'name': 'Testia', 'spans': [
            {'from': 150, 'to': 200, 'familyId': 'islam', 'evidence': 'majority',
             'sourceIds': ['wikipedia-testia']}]}])
        supp['sources'] = [{'id': 'wikipedia-testia', 'title': 'Notice', 'url': 'https://en.wikipedia.org/wiki/Testia'}]
        result, report = build(source, mapping(), supp)
        spans = result['polities'][0]['spans']
        self.assertEqual([(s['from'], s['to'], s['basis']) for s in spans],
                         [(100, 149, 'seshat'), (150, 200, 'editorial'), (201, 300, 'seshat')])
        self.assertEqual(report['supplementOverrides'], ['Testia'])

    def test_state_comes_from_the_supplement_not_wikidata(self):
        supp = supplement([{'name': 'Testia', 'spans': [
            {'familyId': 'islam', 'evidence': 'predominant', 'state': 'christianity',
             'sourceIds': ['x']}]}])
        supp['sources'] = [{'id': 'x', 'title': 'Notice', 'url': 'https://example.org/x'}]
        result, _ = build(extract(), mapping(), supp)
        span = result['polities'][0]['spans'][0]
        self.assertEqual(span['state'], {'familyId': 'christianity',
                                         'label': {'fr': 'Christianismes', 'en': 'Christian traditions'}})

    def test_unknown_subject_fails(self):
        with self.assertRaises(ValueError):
            build(extract(), mapping(),
                  supplement([{'name': 'Nowhere', 'spans': [
                      {'familyId': 'islam', 'evidence': 'state', 'sourceIds': ['x']}]}]))

    def test_adjacent_identical_spans_coalesce(self):
        ent = entity()
        ent['records'] = [{'from': 100, 'to': 200, 'seshatIds': ['te_testia'], 'areaKm2': 5},
                          {'from': 201, 'to': 300, 'seshatIds': ['te_testia'], 'areaKm2': 5}]
        result, _ = build(extract(entities=[ent], seshat=[seshat_row(1, yf=None)]),
                          mapping(), supplement())
        self.assertEqual([(s['from'], s['to']) for s in result['polities'][0]['spans']],
                         [(100, 300)])


if __name__ == '__main__':
    unittest.main()


class RefinementTests(unittest.TestCase):
    def test_min_year_clips_a_statement_before_the_denomination_existed(self):
        m = mapping()
        m['families'][0]['minYear'] = 30
        m['wikidataItemMinYear'] = {'Q2': 150}
        source = extract(wikidata={'Q100': [
            {'item': 'Q2', 'rank': 'normal', 'start': None, 'end': None},
            {'item': 'Q1', 'rank': 'normal', 'start': 120, 'end': 140},
        ]})
        result, _ = build(source, m, supplement())
        spans = result['polities'][0]['spans']
        # Islam (item minYear 150) cannot paint before 150; dated Christianity wins 120–140.
        self.assertEqual([(s['from'], s['to'], s['familyId']) for s in spans],
                         [(120, 140, 'christianity'), (150, 300, 'islam')])
        info = result['polities'][0]['wikidata']
        self.assertEqual([(i['item'], i.get('from')) for i in info],
                         [('Q2', 150), ('Q1', 120)])

    def test_seshat_gap_of_ten_years_or_less_is_bridged(self):
        ent = entity()
        ent['records'] = [{'from': 100, 'to': 160, 'seshatIds': ['te_testia'], 'areaKm2': 5},
                          {'from': 170, 'to': 300, 'seshatIds': ['te_testia'], 'areaKm2': 5}]
        result, _ = build(extract(entities=[ent], seshat=[seshat_row(1, yf=None)]),
                          mapping(), supplement())
        spans = result['polities'][0]['spans']
        self.assertEqual([(s['from'], s['to']) for s in spans], [(100, 160), (161, 169), (170, 300)])
        self.assertIn('bridged', spans[1]['note']['en'])
        self.assertEqual(spans[1]['evidence'], 'majority')

    def test_gap_over_ten_years_stays_open(self):
        ent = entity()
        ent['records'] = [{'from': 100, 'to': 160, 'seshatIds': ['te_testia'], 'areaKm2': 5},
                          {'from': 180, 'to': 300, 'seshatIds': ['te_testia'], 'areaKm2': 5}]
        result, _ = build(extract(entities=[ent], seshat=[seshat_row(1, yf=None)]),
                          mapping(), supplement())
        self.assertEqual([(s['from'], s['to']) for s in result['polities'][0]['spans']],
                         [(100, 160), (180, 300)])

    def test_fallback_supplement_fills_only_seshat_gaps(self):
        supp = supplement([{'name': 'Testia', 'spans': [
            {'familyId': 'islam', 'evidence': 'majority', 'priority': 'fallback',
             'sourceIds': ['x']}]}])
        supp['sources'] = [{'id': 'x', 'title': 'Notice', 'url': 'https://example.org/x'}]
        source = extract(seshat=[seshat_row(1, 'Christianity', yf=100, yt=200)],
                         wikidata={'Q100': [{'item': 'Q2', 'rank': 'normal', 'start': None, 'end': None}]})
        result, report = build(source, mapping(), supp)
        spans = result['polities'][0]['spans']
        self.assertEqual([(s['from'], s['to'], s['basis']) for s in spans],
                         [(100, 200, 'seshat'), (201, 300, 'editorial')])
        self.assertEqual(report['supplementOverrides'], [])

    def test_no_state_from_wikidata_without_supplement(self):
        source = extract(seshat=[seshat_row(1, 'Christianity', yf=None)],
                         wikidata={'Q100': [{'item': 'Q2', 'rank': 'normal', 'start': None, 'end': None}]})
        result, _ = build(source, mapping(), supplement())
        span = result['polities'][0]['spans'][0]
        self.assertNotIn('state', span)
        self.assertEqual(result['polities'][0]['wikidata'][0]['item'], 'Q2')

    def test_wikidata_sliver_between_other_bases_is_dropped(self):
        source = extract(seshat=[seshat_row(1, 'Christianity', yf=100, yt=190),
                                 seshat_row(2, 'Christianity', yf=205, yt=300)],
                         wikidata={'Q100': [{'item': 'Q2', 'rank': 'normal',
                                             'start': 200, 'end': 201}]})
        result, _ = build(source, mapping(), supplement())
        self.assertEqual([(s['from'], s['to'], s['basis']) for s in result['polities'][0]['spans']],
                         [(100, 190, 'seshat'), (205, 300, 'seshat')])

    def test_excluded_subject_emits_no_spans_and_the_reason(self):
        supp = supplement([{'name': 'Testia', 'exclude': {'fr': 'Agrégat colonial', 'en': 'Colonial aggregate'}}])
        source = extract(seshat=[seshat_row(1, 'Christianity', yf=None)],
                         wikidata={'Q100': [{'item': 'Q2', 'rank': 'normal', 'start': None, 'end': None}]})
        result, report = build(source, mapping(), supp)
        polity = result['polities'][0]
        self.assertEqual(polity['spans'], [])
        self.assertEqual(polity['excluded']['en'], 'Colonial aggregate')
        self.assertEqual(report['excluded'], ['Testia'])
