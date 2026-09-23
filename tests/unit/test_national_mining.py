"""Protect the extraction/status boundary in the national mine registers."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('national_mining', ROOT / 'pipeline/resources/national-mining-build.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class NationalMiningTests(unittest.TestCase):
    def test_processing_is_not_extraction(self):
        self.assertEqual(MODULE.canadian_categories({'facilities_code_en_spelt': 'Concentrator', 'product_en_spelt': 'Gold'}), [])
        self.assertEqual(MODULE.canadian_categories({'facilities_code_en_spelt': 'Underground, concentrator', 'product_en_spelt': 'Gold, Platinum group metals, Selenium (by-product)'}), ['gold', 'platinum-group', 'selenium'])

    def test_group_legend_does_not_invent_coproducts(self):
        self.assertEqual(MODULE.australian_categories({'status': 'Operating mine', 'commodity_group': 'Battery/alloy metals - Li, Ta'}), ['lithium'])
        self.assertEqual(MODULE.australian_categories({'status': 'Operating mine', 'commodity_group': 'Tin, Tungsten'}), [])

    def test_unopened_and_suspended_sites_are_excluded(self):
        for status in ['Developing mine', 'Care and maintenance', 'Proposed']:
            self.assertEqual(MODULE.australian_categories({'status': status, 'commodity_group': 'Uranium'}), [])

    def test_snapshot_does_not_invent_historical_lifetime(self):
        result = MODULE.build()
        for site in result['sites']:
            for period in site['periods']:
                self.assertEqual(period['toYear'], 2026)
                self.assertGreaterEqual(period['fromYear'], 2025)
                self.assertTrue(period['approximate'])
        audit = {item['registryId']: item for item in result['audit']}
        for identifier in ['ga-operating:580', 'ga-operating:815', 'ga-operating:718', 'ga-operating:1016']:
            self.assertNotIn(identifier, audit)
        abra = next(site for site in result['sites'] if site['id'] == 'ga-operating:528')
        self.assertEqual(abra['categories'], ['lead', 'silver'])


if __name__ == '__main__':
    unittest.main()
