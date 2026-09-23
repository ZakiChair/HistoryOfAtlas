import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('battle_acquire', Path(__file__).with_name('acquire.py'))
acquire = importlib.util.module_from_spec(spec)
spec.loader.exec_module(acquire)


class SupplementalLanguagesTests(unittest.TestCase):
    def test_includes_reviewed_omissions_without_rewriting_discovery(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            discovery = root / 'candidate-ids.json'
            reviews = root / 'battle-inclusions.json'
            discovery.write_text(json.dumps(['Q1', 'Q2']))
            reviews.write_text(json.dumps({'records': {'Q2': {}, 'Q208127': {}}}))
            self.assertEqual(acquire.candidate_ids(discovery, reviews), {'Q1', 'Q2', 'Q208127'})
            self.assertEqual(json.loads(discovery.read_text()), ['Q1', 'Q2'])

    def test_reviews_offshore_rejections_and_recovered_records_but_skips_completed_downloads(self):
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory)
            candidates = raw / 'candidates.json'
            candidates.write_text(json.dumps({'candidates': [
                {'id': 'Q2', 'classification': 'unmapped-battle', 'reasons': ['land-event-in-open-ocean']},
                {'id': 'Q3', 'classification': 'unmapped-battle', 'reasons': ['missing-coordinates']},
                {'id': 'Q4', 'classification': 'additional-mappable-battle'},
            ]}))
            (raw / 'entities-all-languages-complete.meta.json').write_text(json.dumps({'ids': ['Q2']}))
            self.assertEqual(acquire.language_review_candidates(raw, candidates, ['Q1']), ['Q1', 'Q4'])

    def test_first_acquisition_does_not_require_a_published_catalog(self):
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory)
            self.assertEqual(acquire.language_review_candidates(raw, raw / 'absent.json', ['Q10', 'Q2']), ['Q2', 'Q10'])


if __name__ == '__main__':
    unittest.main()
