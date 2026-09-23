import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('occurrences', Path(__file__).with_name('mineral-occurrences-build.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class OccurrenceRules(unittest.TestCase):
    def test_catalogue_attestation_is_not_discovery_or_operation(self):
        item = m.usgs_occurrence({'id': '1', 'name': 'Untapped', 'country': 'Chile',
                                 'longitude': -70, 'latitude': -24, 'commodities': ['Cu', 'Cr', 'V', 'fluorite', 'B', 'silica sand']})
        self.assertEqual(item['periods'], [])
        self.assertEqual(item['knowledge'][0]['kind'], 'attestation')
        self.assertEqual(item['knowledge'][0]['fromYear'], 2009)
        self.assertEqual(set(item['categories']), {'copper', 'chromium', 'vanadium', 'fluorite', 'boron', 'silicon'})

    def test_processing_only_and_unreliable_identities_are_not_deposits(self):
        row = {'ICMMID': '1', 'Mine Name': 'Plant', 'Country': 'Chile', 'Longitude': '-70',
               'Latitude': '-24', 'Primary Commodity': 'copper', 'Asset Type': 'Smelter', 'Confidence Factor': 'High'}
        self.assertIsNone(m.icmm_occurrence(row))
        self.assertIsNone(m.icmm_occurrence({**row, 'Asset Type': 'Mine', 'Confidence Factor': 'Very Low'}))
        self.assertIsNone(m.icmm_occurrence({**row, 'Asset Type': 'Mine; Plant'}))
        item = m.icmm_occurrence({**row, 'Asset Type': 'Mine'})
        self.assertEqual(item['periods'], [])
        self.assertEqual(item['knowledge'][0]['fromYear'], 2026)

    def test_nearby_different_pits_are_not_merged(self):
        sites = [{'id': 'pit-a', 'name': 'Copper North Pit', 'country': 'Chile', 'coordinates': [-70, -24]}]
        index = m.site_index(sites)
        self.assertIsNone(m.exact_match({'name': 'Copper South Pit', 'country': 'Chile', 'coordinates': [-70, -24]}, index))
        self.assertEqual(m.exact_match({'name': 'Copper North Pit Mine', 'country': 'Chile', 'coordinates': [-70.001, -24]}, index)['id'], 'pit-a')
        self.assertIsNone(m.exact_match({'name': 'Copper North Pit', 'country': 'Peru', 'coordinates': [-70, -24]}, index))

    def test_ambiguous_exact_names_are_not_automatically_joined(self):
        sites = [{'id': str(i), 'name': 'North', 'country': 'Chile', 'coordinates': [-70+i/100, -24]} for i in range(2)]
        self.assertIsNone(m.exact_match(sites[0], m.site_index(sites)))

    def test_non_latin_names_do_not_collapse_to_the_same_empty_key(self):
        north = {'id': 'n', 'name': '北矿', 'country': 'China', 'coordinates': [110, 35]}
        south = {'id': 's', 'name': '南矿', 'country': 'China', 'coordinates': [110, 35]}
        self.assertIsNone(m.exact_match(south, m.site_index([north])))

    def test_geometry_check_rejects_wrong_country_but_allows_coarse_boundaries(self):
        shapes = [{'properties': {'NAME_EN': 'Chile'}, 'geometry': {'type': 'Polygon', 'coordinates': [[[-71,-25],[-69,-25],[-69,-23],[-71,-23],[-71,-25]]]}}]
        geography = m.CountryGeometry(shapes)
        self.assertTrue(geography.accepts([-70,-24], 'Chile'))
        self.assertTrue(geography.accepts([-71.1,-24], 'Chile'))
        self.assertFalse(geography.accepts([119,50], 'Chile'))

    def test_invalid_coordinates_are_omitted(self):
        self.assertIsNone(m.position(0, 0))
        self.assertIsNone(m.position(200, 20))
        self.assertIsNone(m.position('NaN', 20))


if __name__ == '__main__':
    unittest.main()
