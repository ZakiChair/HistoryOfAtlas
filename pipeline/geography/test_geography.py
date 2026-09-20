"""Date conventions, geospatial measures and generated artifact invariants."""
import json
import unittest
from pathlib import Path
from build import astro_year, entity_id, geometry_area, label_point, point_in_ring, PUBLIC

class GeographyUnits(unittest.TestCase):
    def test_bce_year_conversion_keeps_no_historical_year_zero(self):
        self.assertEqual(astro_year(-1), 0)
        self.assertEqual(astro_year(-323), -322)
        self.assertEqual(astro_year(1), 1)
        self.assertEqual(astro_year(2024), 2024)

    def test_entity_id_unicode_and_case_stability(self):
        self.assertEqual(entity_id('Élam'),entity_id('E\u0301LAM'))
        self.assertNotEqual(entity_id('Northern Song'),entity_id('Southern Song'))

    def test_spherical_area_and_hole_subtraction(self):
        outer = [[0,0],[1,0],[1,1],[0,1],[0,0]]
        hole = [[.25,.25],[.75,.25],[.75,.75],[.25,.75],[.25,.25]]
        full = geometry_area({'type':'Polygon','coordinates':[outer]})
        hollow = geometry_area({'type':'Polygon','coordinates':[outer,hole]})
        self.assertGreater(full,12300)
        self.assertLess(full,12400)
        self.assertAlmostEqual(hollow/full,.75,places=3)

    def test_label_point_avoids_holes(self):
        rings = [[[0,0],[10,0],[10,10],[0,10],[0,0]],
                 [[4,4],[6,4],[6,6],[4,6],[4,4]]]
        x,y = label_point({'type':'Polygon','coordinates':rings})
        self.assertTrue(point_in_ring(x,y,rings[0]))
        self.assertFalse(point_in_ring(x,y,rings[1]))

    def test_derived_artifacts_are_tiled_and_shards_are_contiguous(self):
        manifest_path = PUBLIC/'manifest.json'
        if not manifest_path.exists():
            self.skipTest('Run geography build for artifact validation')
        manifest = json.loads(manifest_path.read_text())
        temporal = manifest['temporal']
        self.assertGreaterEqual(len(manifest['snapshots']),50)
        self.assertGreater(temporal['records'],13000)
        self.assertEqual(temporal['range'],[-3399,2024])
        urls = [x['url'] for x in manifest['snapshots']] + [x['url'] for x in temporal['shards']] + [manifest['basemap']['url']]
        for url in urls:
            path = PUBLIC.parent / url.lstrip('/')
            with path.open('rb') as handle:
                self.assertEqual(handle.read(8), b'PMTiles\x03')
        for before,after in zip(temporal['shards'],temporal['shards'][1:]):
            self.assertEqual(before['end']+1, after['start'])
        changes = json.loads((PUBLIC/'territorial-changes.json').read_text())
        self.assertTrue(all(x['source'].startswith('https://') and x['eventIds']==[] for x in changes))
        for item in json.loads((PUBLIC/'polities.json').read_text()):
            detail = json.loads((PUBLIC.parent/item['detailsUrl'].lstrip('/')).read_text())
            self.assertTrue(all(x['fromYear']<=x['toYear'] and x['areaKm2']>=0 for x in detail['observations']))

if __name__ == '__main__':
    unittest.main()
