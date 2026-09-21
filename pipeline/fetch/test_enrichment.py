"""Offline regression tests for the enrichment acquisition boundary."""
import unittest
from enrichment import event_people_ids, ruler_ids, office_ids


def statement(qid, rank='normal', qualifiers=None):
    return {'rank': rank, 'mainsnak': {'datavalue': {'value': {'id': qid}}},
            'qualifiers': qualifiers or {}}


class EnrichmentDiscoveryTests(unittest.TestCase):
    def test_commanders_include_participant_qualifiers_without_deprecated_claims(self):
        entities = {'Q1': {'claims': {'P710': [statement('Q2', qualifiers={
            'P4791': [{'datavalue': {'value': {'id': 'Q3'}}}]
        })], 'P4791': [statement('Q4'), statement('Q5', 'deprecated')]}},
                    'Q2': {'claims': {'P31': [statement('Q5')]}}}
        self.assertEqual(event_people_ids(entities, {'Q1'}), {'Q2', 'Q3', 'Q4'})

    def test_historical_rulers_and_offices_survive_preferred_current_claim(self):
        entities = {'Q1': {'claims': {'P35': [statement('Q2'), statement('Q3', 'preferred'), statement('Q4', 'deprecated')]}},
                    'Q2': {'claims': {'P39': [statement('Q6'), statement('Q7', 'preferred')]}}}
        self.assertEqual(ruler_ids(entities, {'Q1'}), {'Q2', 'Q3'})
        self.assertEqual(office_ids(entities, {'Q2'}), {'Q6', 'Q7'})


if __name__ == '__main__':
    unittest.main()
