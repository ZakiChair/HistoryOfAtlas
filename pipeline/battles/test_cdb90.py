"""Semantic regressions for the reviewed CDB90 profile adapter."""
import copy
import unittest

try:
    from pipeline.battles.cdb90 import build_profile
except ModuleNotFoundError:
    build_profile = None


COMMIT = 'e0b35ec4d798cec3bb4e6970c0f6bb7aa69e2f4c'


def fixture():
    return {
        'match': {'sourceId': 1, 'battleId': 'Q100', 'article': 'Battle_of_Example',
                  'decision': 'approved', 'note': 'Reviewed full battle and opposing forces.'},
        'battle': {'id': 'Q100', 'name': {'en': 'Example'}, 'medium': 'land',
                   'start': {'year': 1700, 'month': 6, 'day': 2}, 'participants': [],
                   'sources': [{'label': 'Wikipedia (en)', 'url': 'https://en.wikipedia.org/wiki/Battle_of_Example'}]},
        'source_battle': {'isqno': '1', 'name': 'EXAMPLE', 'parent': '',
                          'dbpedia': 'http://dbpedia.org/resource/Battle_of_Example'},
        'forces': [
            {'isqno': '1', 'attacker': '1', 'nam': 'FRENCH & BAVARIAN ARMY', 'actors': 'France & Bavaria',
             'str': '101', 'code': '1', 'intst': '101', 'rerp': '0', 'cas': '11',
             'strmi': '-3', 'strpl': '33', 'casmi': '-25', 'caspl': '20'},
            {'isqno': '1', 'attacker': '0', 'nam': 'ALLIED ARMY', 'actors': 'Austria',
             'str': '200', 'code': '1', 'intst': '200', 'rerp': '0', 'cas': '',
             'strmi': '0', 'strpl': '0', 'casmi': '0', 'caspl': '0'},
        ],
        'periods': [{'isqno': '1', 'atp_number': '1',
                     'start_time_min': '1700-06-02T00:00:00', 'start_time_max': '1700-06-03T00:00:00',
                     'end_time_min': '1700-06-02T00:00:00', 'end_time_max': '1700-06-03T00:00:00',
                     'duration_only': '0'}],
        'source_meta': {'repository': 'https://github.com/jrnold/CDB90', 'commit': COMMIT,
                        'license': 'ODC-BY-1.0', 'licenseUrl': 'https://opendatacommons.org/licenses/by/1-0/',
                        'originalDataLicense': 'Public Domain', 'attribution': 'CAA data; Jeffrey B. Arnold revision',
                        'resources': [{'path': path, 'sha256': 'a' * 64, 'bytes': 100} for path in
                                      ['data/belligerents.csv', 'data/battles.csv', 'data/active_periods.csv',
                                       'src-data/M000121/CDB90DEF.csv']]},
    }


class ProfileTests(unittest.TestCase):
    def call(self, data=None):
        self.assertTrue(callable(build_profile), 'CDB90 pure profile adapter is not implemented')
        return build_profile(**(data or fixture()))

    def alias_fixture(self):
        data = fixture()
        data['battle']['sources'][0]['url'] = 'https://en.wikipedia.org/wiki/Battle_of_Renamed_Example'
        data['match']['articleAliasReview'] = {
            'sourceArticle': 'Battle of Example', 'targetArticle': 'Battle of Renamed Example',
            'battleId': 'Q100', 'reviewedAt': '2026-09-22',
            'note': 'The source title redirects to this exact event, independently reviewed.',
            'sources': [{'label': 'Reviewed redirect revision',
                         'url': 'https://en.wikipedia.org/w/index.php?title=Battle_of_Example&oldid=123',
                         'license': 'CC-BY-SA-4.0'}],
        }
        return data

    def test_reviewed_article_alias_keeps_counts_original_names_and_separate_evidence(self):
        baseline = self.call()
        data = self.alias_fixture()
        before = copy.deepcopy(data)
        profile = self.call(data)
        self.assertEqual(data, before)
        evidence = data['match']['articleAliasReview']['sources'][0]
        for old, new in zip(baseline['participants'], profile['participants']):
            for field in ('id', 'name', 'strength', 'deaths', 'casualties'):
                self.assertEqual(new[field], old[field], field)
            self.assertIn(evidence, new['sources'])
            self.assertNotIn(evidence, new['strength'][0]['sources'])
        self.assertIn('Battle_of_Example -> Battle_of_Renamed_Example', profile['note'])
        self.assertIn('2026-09-22', profile['note'])
        self.assertIn('independently reviewed', profile['note'])

    def test_article_alias_requires_explicit_complete_bound_review(self):
        invalid = [None, {}, {'sourceArticle': 'Wrong'}, {'targetArticle': 'Wrong'},
                   {'targetArticle': 'Battle of Example'}, {'battleId': 'Q999'},
                   {'reviewedAt': '2026-02-30'}, {'reviewedAt': '20260922'}, {'note': ' '},
                   {'sources': []}, {'sources': [{'label': 'Proof', 'url': 'file:///tmp/proof'}]},
                   {'sources': [{'label': '', 'url': 'https://example.org'}]}, {'extra': True}]
        for change in invalid:
            with self.subTest(change=change):
                data = self.alias_fixture()
                data['match']['articleAliasReview'] = (
                    change if change is None or change == {} else {**data['match']['articleAliasReview'], **change})
                with self.assertRaises(ValueError): self.call(data)
        data = self.alias_fixture()
        del data['match']['articleAliasReview']
        with self.assertRaises(ValueError): self.call(data)

    def test_article_alias_does_not_bypass_other_identity_date_or_force_guards(self):
        for section, field, value in [
            ('match', 'battleId', 'Q999'), ('match', 'sourceId', 2),
            ('source_battle', 'dbpedia', 'http://dbpedia.org/resource/Wrong'),
            ('source_battle', 'parent', '2'), ('battle', 'medium', 'naval'),
            ('battle', 'start', {'year': 1700, 'month': 6, 'day': 1}),
            ('battle', 'sources', []), ('forces', 1, fixture()['forces'][0]),
        ]:
            with self.subTest(section=section, field=field):
                data = self.alias_fixture()
                data[section][field] = value
                with self.assertRaises(ValueError): self.call(data)

    def test_malformed_alias_is_rejected_even_when_original_article_is_present(self):
        data = fixture()
        data['match']['articleAliasReview'] = {'targetArticle': 'Battle of Example'}
        with self.assertRaises(ValueError): self.call(data)

    def test_reviewed_local_force_name_preserves_original_estimates_and_separate_provenance(self):
        data = fixture()
        baseline = self.call(data)['participants'][0]
        evidence = {'label': 'Battlefield archive', 'url': 'https://example.org/army-identity'}
        data['match']['participants'] = [{'side': 'attacker', 'identityReview': {
            'name': {'en': 'Reviewed combined field army', 'fr': 'Armée de campagne réunie'},
            'note': 'The archive identifies this combined force at the engagement.',
            'sources': [evidence],
        }}]
        before = copy.deepcopy(data)
        profile = self.call(data)
        army = profile['participants'][0]
        self.assertEqual(data, before)
        self.assertEqual(army['name']['en'], 'Reviewed combined field army')
        for field in ('id', 'kind', 'sideId', 'medium', 'strength', 'deaths', 'casualties'):
            self.assertEqual(army[field], baseline[field], field)
        self.assertIn(evidence, army['sources'])
        self.assertNotIn(evidence, army['strength'][0]['sources'])
        self.assertEqual(army['strength'][0]['qualifiers']['cdb90']['originalForceName'], 'FRENCH & BAVARIAN ARMY')
        self.assertIn('The archive identifies this combined force', profile['note'])
        self.assertEqual(profile['participants'][1]['name']['en'], 'ALLIED ARMY')

    def test_local_name_review_requires_evidence_and_cannot_rename_a_reused_identity(self):
        valid = {'name': {'en': 'Reviewed field army'}, 'note': 'Archive identity review.',
                 'sources': [{'label': 'Archive', 'url': 'https://example.org/archive'}]}
        for change in ({'sources': []}, {'note': ''}, {'name': {'en': ''}},
                       {'sources': [{'label': 'Archive', 'url': 'javascript:alert(1)'}]},
                       {'strength': 5000}, {'name': {'xx': 'Unreviewed language'}}):
            with self.subTest(change=change):
                data = fixture()
                data['match']['participants'] = [{'side': 'attacker', 'identityReview': {**valid, **change}}]
                with self.assertRaises(ValueError): self.call(data)
        data = fixture()
        data['battle']['participants'] = [{'id': 'Q200', 'name': {'en': 'Existing polity'}, 'kind': 'polity'}]
        data['match']['participants'] = [{'side': 'attacker', 'participantId': 'Q200', 'identityReview': valid}]
        with self.assertRaises(ValueError): self.call(data)

    def test_coalition_remains_one_force_and_source_estimates_keep_signed_bounds(self):
        data = fixture()
        before = copy.deepcopy(data)
        profile = self.call(data)
        self.assertEqual(data, before)
        self.assertEqual(len(profile['participants']), 2)
        attacker = profile['participants'][0]
        self.assertEqual(attacker['name']['en'], 'FRENCH & BAVARIAN ARMY')
        self.assertEqual(attacker['kind'], 'military-unit')
        self.assertEqual(attacker['sideId'], 'attacker')
        self.assertNotIn('profileId', attacker)
        strength = attacker['strength'][0]
        self.assertEqual((strength['value'], strength['min'], strength['max']), (101, 97, 135))
        self.assertEqual(strength['counts'], 'soldiers')
        self.assertIn('Tabulated estimate: 101 personnel', strength['note'])
        self.assertTrue(strength['approximate'])
        self.assertEqual(strength['scope'], 'participant')
        self.assertIn('-3', str(strength['qualifiers']))
        self.assertEqual(attacker['deaths'], [])
        self.assertEqual(attacker['casualties'][0]['min'], 8)
        self.assertEqual(attacker['casualties'][0]['max'], 14)
        self.assertIn(COMMIT, strength['statementId'])
        self.assertTrue(any('/blob/' + COMMIT + '/data/belligerents.csv' in s['url'] for s in strength['sources']))
        self.assertTrue(any(s.get('license') == 'ODC-BY-1.0' for s in strength['sources']))

    def test_unknown_casualties_and_unknown_deviation_are_not_zero(self):
        profile = self.call()
        defender = profile['participants'][1]
        self.assertEqual(defender['casualties'], [])
        self.assertNotIn('min', defender['strength'][0])
        self.assertNotIn('max', defender['strength'][0])
        data = fixture()
        data['forces'][1]['cas'] = '-1'
        self.assertEqual(self.call(data)['participants'][1]['casualties'], [])

    def test_zero_casualties_are_explicit_and_one_unknown_bound_stays_absent(self):
        data = fixture()
        data['forces'][0].update(cas='0', strmi='0', strpl='186')
        participant = self.call(data)['participants'][0]
        self.assertEqual(participant['casualties'][0]['value'], 0)
        self.assertTrue(participant['casualties'][0]['renderable'])
        self.assertNotIn('min', participant['strength'][0])
        self.assertEqual(participant['strength'][0]['max'], 289)

    def test_casualties_above_initial_strength_are_preserved_without_depletion(self):
        data = fixture()
        data['forces'][0]['cas'] = '150'
        quantity = self.call(data)['participants'][0]['casualties'][0]
        self.assertEqual(quantity['value'], 150)
        self.assertFalse(quantity['renderable'])
        self.assertIn('exceed', quantity['note'].lower())

    def test_reviewed_existing_identity_keeps_original_nam_without_equipment(self):
        data = fixture()
        data['battle']['participants'] = [{'id': 'Q200', 'name': {'en': 'Reviewed coalition'},
                                          'kind': 'military-unit', 'profileId': 'flintlock-infantry', 'sources': []}]
        data['match']['participants'] = [{'side': 'attacker', 'participantId': 'Q200'}]
        participant = self.call(data)['participants'][0]
        self.assertEqual(participant['id'], 'Q200')
        self.assertEqual(participant['name']['en'], 'Reviewed coalition')
        self.assertNotIn('profileId', participant)
        self.assertIn('FRENCH & BAVARIAN ARMY', str(participant['strength'][0]))
        for kind in ('person', 'unknown'):
            with self.subTest(kind=kind):
                data['battle']['participants'][0]['kind'] = kind
                with self.assertRaises(ValueError):
                    self.call(data)

    def test_quarantines_unapproved_misidentified_nonland_and_duplicate_events(self):
        cases = [
            ('match', 'decision', 'candidate'), ('match', 'battleId', 'Q999'),
            ('match', 'sourceId', 2), ('match', 'article', 'Other_battle'),
            ('source_battle', 'dbpedia', 'http://dbpedia.org/resource/Other_battle'),
            ('source_battle', 'parent', '2'), ('battle', 'medium', 'naval'),
            ('battle', 'sources', []), ('source_meta', 'commit', 'main'),
        ]
        for section, field, value in cases:
            with self.subTest(section=section, field=field):
                data = fixture()
                data[section][field] = value
                with self.assertRaises(ValueError):
                    self.call(data)

    def test_quarantines_partial_mismatched_and_corrupt_period_dates(self):
        data = fixture()
        data['battle']['start'] = {'year': 1700, 'month': 6}
        with self.assertRaises(ValueError): self.call(data)
        data = fixture()
        data['periods'][0]['start_time_max'] = '1700-07-01T00:00:00'
        with self.assertRaises(ValueError): self.call(data)
        data = fixture()
        data['battle']['end'] = {'year': 1700, 'month': 6, 'day': 3}
        with self.assertRaises(ValueError): self.call(data)
        data = fixture()
        data['periods'][0]['start_time_min'] = '1700-02-30T00:00:00'
        with self.assertRaises(ValueError): self.call(data)
        data = fixture()
        data['periods'].append(copy.deepcopy(data['periods'][0]))
        with self.assertRaises(ValueError): self.call(data)

    def test_all_active_periods_define_full_battle_extent_without_repeating_forces(self):
        data = fixture()
        data['battle']['end'] = {'year': 1700, 'month': 6, 'day': 4}
        data['periods'].append({'isqno': '1', 'atp_number': '2', 'start_time_min': '1700-06-04T09:00:00',
                                'start_time_max': '1700-06-04T09:00:00', 'end_time_min': '1700-06-04T15:00:00',
                                'end_time_max': '1700-06-04T15:00:00', 'duration_only': '0'})
        profile = self.call(data)
        self.assertEqual(len(profile['participants']), 2)
        self.assertEqual(profile['participants'][0]['strength'][0]['value'], 101)

    def test_quarantines_average_unknown_or_incompatible_strength_scope(self):
        for code in ('2', '', '9'):
            with self.subTest(code=code):
                data = fixture()
                data['forces'][0]['code'] = code
                with self.assertRaises(ValueError): self.call(data)
        data = fixture()
        data['forces'][0].update(code='3', intst='90', rerp='10')
        with self.assertRaises(ValueError): self.call(data)
        data = fixture()
        data['forces'][0]['intst'] = '100'
        with self.assertRaises(ValueError): self.call(data)

    def test_mixed_codes_require_complete_reinforcement_accounting_on_both_sides(self):
        data = fixture()
        data['forces'][0].update(code='3', intst='90', rerp='11')
        self.assertEqual(self.call(data)['participants'][0]['strength'][0]['value'], 101)
        data['forces'][1]['rerp'] = ''
        with self.assertRaises(ValueError): self.call(data)

    def test_reapplying_profile_does_not_duplicate_existing_sources(self):
        data = fixture()
        data['battle']['participants'] = [{'id': 'Q200', 'name': {'en': 'Reviewed coalition'},
                                          'kind': 'military-unit', 'profileId': 'flintlock-infantry',
                                          'sources': [{'label': 'Original identity', 'url': 'https://example.org/source'}]}]
        data['match']['participants'] = [{'side': 'attacker', 'participantId': 'Q200'}]
        first = self.call(data)
        data['battle']['participants'] = first['participants']
        second = self.call(data)
        self.assertEqual(first, second)

    def test_equipment_enrichment_cannot_change_numeric_import_on_rebuild(self):
        data = fixture()
        identity = {'label': 'Wikidata identity', 'url': 'https://www.wikidata.org/wiki/Q200', 'license': 'CC0-1.0'}
        data['battle']['participants'] = [{'id': 'Q200', 'name': {'en': 'Reviewed coalition'},
                                          'kind': 'military-unit', 'sources': [identity]}]
        data['match']['participants'] = [{'side': 'attacker', 'participantId': 'Q200'}]
        first = self.call(data)
        self.assertIn(identity, first['participants'][0]['sources'])
        enriched = copy.deepcopy(first['participants'])
        enriched[0]['profileId'] = 'flintlock-infantry'
        enriched[0]['sources'].extend([
            {'label': 'Musket museum source', 'url': 'https://example.org/equipment'},
            {'label': 'Musket item', 'url': 'https://www.wikidata.org/wiki/Q999'},
            {'label': 'Event equipment claim', 'url': 'https://www.wikidata.org/wiki/Q100#equipment'},
        ])
        data['battle']['participants'] = enriched
        self.assertEqual(self.call(data), first)

    def test_quarantines_numerical_corruption_wrong_sign_and_force_row_mismatch(self):
        for field, value in [('str', '0'), ('str', '-1'), ('str', '100.5'), ('str', 'NaN'),
                             ('str', '9007199254740992'), ('cas', '-2'), ('strmi', '3'),
                             ('strmi', '-101'), ('strpl', '-1'), ('caspl', 'nan'),
                             ('isqno', '2'), ('attacker', '9'), ('nam', '?')]:
            with self.subTest(field=field, value=value):
                data = fixture()
                data['forces'][0][field] = value
                with self.assertRaises(ValueError): self.call(data)
        data = fixture()
        data['forces'][1]['attacker'] = '1'
        with self.assertRaises(ValueError): self.call(data)


if __name__ == '__main__':
    unittest.main()
