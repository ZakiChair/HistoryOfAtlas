"""Provenance and whole-battle safeguards for the pinned corpus importer."""
import copy
import hashlib
import tempfile
import unittest
from pathlib import Path
from pipeline.battles.import_cdb90 import acquire, validate_manifest, validate_matches, validate_review_source, verify_resource
import json


class IntakeTests(unittest.TestCase):
    def test_historical_review_cannot_be_reused_for_a_different_source_revision(self):
        manifest = {'repository': 'https://github.com/jrnold/CDB90', 'commit': 'a' * 40, 'license': 'ODC-BY-1.0'}
        validate_review_source({'source': manifest.copy()}, manifest)
        for field, value in [('repository', 'https://example.org'), ('commit', 'b' * 40), ('license', 'CC0')]:
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'pinned source revision'):
                validate_review_source({'source': {**manifest, field: value}}, manifest)

    def test_pinned_resource_rejects_corruption_even_at_the_same_length(self):
        resource = {'path': 'data.csv', 'bytes': 3, 'sha256': hashlib.sha256(b'abc').hexdigest()}
        verify_resource(resource, b'abc')
        for payload in [b'abd', b'abcd', b'']:
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                verify_resource(resource, payload)

    def test_manifest_requires_original_definitions_and_immutable_revision(self):
        source = json.loads((Path(__file__).resolve().parents[2] / 'data/curated/battle-cdb90-source.json').read_text())
        validate_manifest(source)
        for change in [{'commit': 'main'}, {'resources': source['resources'][:-1]}, {'attribution': ''}]:
            with self.assertRaises(ValueError):
                validate_manifest({**source, **change})
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaisesRegex(ValueError, 'rerun with --fetch'):
                acquire(source, Path(temporary))

    def test_multiple_engagements_cannot_silently_overwrite_one_battle(self):
        review = {'version': 1, 'reviewedAt': '2026-09-21', 'records': [
            {'sourceId': 1, 'battleId': 'Q100', 'article': 'Battle', 'decision': 'approved', 'note': 'Scope reviewed'},
            {'sourceId': 2, 'battleId': 'Q100', 'article': 'Battle', 'decision': 'approved', 'note': 'Second sector'},
        ]}
        with self.assertRaisesRegex(ValueError, 'Multiple source engagements'):
            validate_matches(review, {'1', '2'})
        review['records'][1]['decision'] = 'rejected'
        self.assertEqual(len(validate_matches(review, {'1', '2'})), 2)
        duplicate = copy.deepcopy(review)
        duplicate['records'][1]['sourceId'] = 1
        with self.assertRaisesRegex(ValueError, 'duplicate reviewed source'):
            validate_matches(duplicate, {'1', '2'})


if __name__ == '__main__':
    unittest.main()
