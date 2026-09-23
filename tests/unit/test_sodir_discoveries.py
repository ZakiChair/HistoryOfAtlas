import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('sodir_discoveries', ROOT / 'pipeline/resources/sodir-discoveries-build.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class DiscoveryTests(unittest.TestCase):
    def test_condensate_is_not_crude_oil(self):
        self.assertEqual(MODULE.fuels('GAS/CONDENSATE'), ['gas'])
        self.assertEqual(MODULE.fuels('OIL/GAS'), ['oil', 'gas'])
        self.assertEqual(MODULE.fuels('CONDENSATE'), [])

    def test_planned_dates_do_not_establish_discovery(self):
        for year in [None, 2030, '1980']:
            self.assertIsNone(MODULE.evidence({'dscDiscoveryYear': year, 'dscHcType': 'GAS'}, 'dsc'))

    def test_discovery_registry_does_not_create_production(self):
        result = MODULE.build()
        self.assertGreater(len(result['sites']), 250)
        self.assertTrue(all(not site['periods'] and site['knowledge'] for site in result['sites']))
        self.assertEqual(len(result['knowledgeGroups'][0]['updates']), 128)
        yme = next(u for u in result['knowledgeGroups'][0]['updates'] if u['siteId'] == 'sodir:43807')
        self.assertEqual(min(k['fromYear'] for k in yme['knowledge']), 1987)


if __name__ == '__main__':
    unittest.main()
