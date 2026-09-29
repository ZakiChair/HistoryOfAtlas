"""Historical religious prevalence must not acquire invented dates or shares."""
import copy
import unittest
from seshat import build_fragment


def fixture():
    return {
        'records': [{'id': 1, 'polity': {'name': 'test_polity', 'long_name': 'Test polity',
                                      'start_year': 100, 'end_year': 300},
                     'year_from': 120, 'year_to': 160, 'degree_of_prevalence': 'o_h_p',
                     'is_disputed': False, 'is_uncertain': False, 'tag': 'TRS',
                     'widespread_religion': {'religion_name': 'Christianity'}}],
        'reviews': {'1': {'traditionId': 'christianity', 'name': {'fr': 'État test', 'en': 'Test polity'},
                          'note': {'fr': 'Codage qualitatif.', 'en': 'Qualitative coding.'}}},
        'features': [{'id': 10, 'properties': {'SeshatID': 'test_polity', 'Name': 'Test polity',
                                             'FromYear': 140, 'ToYear': 180, 'Type': 'POLITY'},
                      'geometry': {'type': 'Polygon', 'coordinates': [[[0, 0], [1, 0], [1, 1], [0, 0]]]}}],
        'sources': [{'id': 'seshat', 'title': 'Seshat', 'url': 'https://seshat-db.com/', 'license': 'CC-BY-SA-4.0'},
                    {'id': 'cliopatria', 'title': 'Cliopatria', 'url': 'https://example.org/cliopatria', 'license': 'CC-BY-4.0'}],
        'extraTraditions': [],
    }


BASE = [{'id': 'christianity', 'names': {'fr': 'Christianismes', 'en': 'Christian traditions'},
         'color': '#c084d8', 'symbol': 'cross'},
        {'id': 'islam', 'names': {'fr': 'Islam', 'en': 'Islam'}, 'color': '#249c66', 'symbol': 'crescent'}]


class SeshatCoverageTests(unittest.TestCase):
    def test_intersects_observation_and_historical_geometry_without_invented_percentage(self):
        result, report = build_fragment(fixture(), BASE)
        observation = result['observations'][0]
        self.assertEqual(observation['time'], {'kind': 'interval', 'fromYear': 140, 'toYear': 160})
        self.assertEqual(observation['shares'][0]['prevalence'], 'majority')
        self.assertNotIn('share', observation['shares'][0])
        self.assertEqual(report['acceptedSourceRecords'], [1])

    def test_rank_and_polity_duration_cannot_replace_missing_prevalence_or_dates(self):
        for field, value in [('year_from', None), ('year_to', None), ('degree_of_prevalence', 'unc')]:
            with self.subTest(field=field):
                source = fixture()
                source['records'][0][field] = value
                source['records'][0]['order'] = '1'
                result, report = build_fragment(source, BASE)
                self.assertEqual(result['observations'], [])
                self.assertEqual(len(report['rejected']), 1)

    def test_substantial_minority_is_qualitative_and_not_twenty_percent(self):
        source = fixture()
        source['records'][0]['degree_of_prevalence'] = 'sz_m'
        result, _ = build_fragment(source, BASE)
        self.assertEqual(result['observations'][0]['shares'][0]['prevalence'], 'substantial')
        self.assertNotIn('share', result['observations'][0]['shares'][0])

    def test_different_majorities_are_rejected_instead_of_choosing_one(self):
        source = fixture()
        second = copy.deepcopy(source['records'][0])
        second['id'] = 2
        second['widespread_religion']['religion_name'] = 'Islam'
        source['records'].append(second)
        source['reviews']['2'] = dict(source['reviews']['1'], traditionId='islam')
        result, report = build_fragment(source, BASE)
        self.assertEqual(result['observations'], [])
        self.assertEqual(report['conflicts'][0]['recordIds'], [1, 2])

    def test_same_family_is_not_double_counted_and_sources_are_retained(self):
        source = fixture()
        second = copy.deepcopy(source['records'][0])
        second.update(id=2, degree_of_prevalence='sz_m')
        second['widespread_religion']['religion_name'] = 'Roman Catholic Christianity'
        source['records'].append(second)
        source['reviews']['2'] = source['reviews']['1']
        result, _ = build_fragment(source, BASE)
        self.assertEqual(len(result['observations'][0]['shares']), 1)
        self.assertEqual(result['observations'][0]['shares'][0]['prevalence'], 'majority')
        self.assertEqual(len(result['observations'][0]['shares'][0]['sourceIds']), 2)

    def test_no_temporal_overlap_produces_no_geometry_or_observation(self):
        source = fixture()
        source['records'][0].update(year_from=100, year_to=110)
        result, report = build_fragment(source, BASE)
        self.assertEqual(result['observations'], [])
        self.assertEqual(result['geometries'], [])
        self.assertEqual(report['rejected'][0]['reason'], 'no-matching-dated-geometry')

    def test_unreviewed_or_disputed_source_records_are_not_published(self):
        source = fixture()
        source['records'][0]['is_disputed'] = True
        result, _ = build_fragment(source, BASE)
        self.assertEqual(result['observations'], [])
        source['records'][0]['is_disputed'] = False
        source['reviews'] = {}
        result, _ = build_fragment(source, BASE)
        self.assertEqual(result['observations'], [])

    def test_bad_geometry_fails_loudly_before_publication(self):
        source = fixture()
        source['features'][0]['geometry']['coordinates'][0][-1] = [2, 2]
        with self.assertRaisesRegex(ValueError, 'closed'):
            build_fragment(source, BASE)


if __name__ == '__main__':
    unittest.main()
