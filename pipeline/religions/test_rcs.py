import unittest

from rcs import build, matching_mapping, reviewed_geometry, shares_from_row


class RcsNormalizationTests(unittest.TestCase):
    def test_unknown_stays_unknown_and_families_are_not_double_counted(self):
        shares = shares_from_row({'CHRPC': 60, 'PRTPC': 30, 'MUSPC': None, 'NREPC': 25})
        self.assertEqual(shares, [{'traditionId': 'christianity', 'share': .6}, {'traditionId': 'unaffiliated', 'share': .25}])

    def test_rejects_negative_residual_and_excess_without_renormalizing(self):
        for row in [{'CHRPC': 60, 'OREPC': -.1}, {'CHRPC': 60, 'MUSPC': 45}, {'CHRPC': float('nan')}, {'CHRPC': True}]:
            with self.subTest(row=row), self.assertRaises(ValueError):
                shares_from_row(row)

    def test_threshold_boundary_keeps_source_precision(self):
        self.assertEqual(shares_from_row({'CHRPC': 50})[0]['share'], .5)
        self.assertGreater(shares_from_row({'CHRPC': 50.000001})[0]['share'], .5)

    def test_unknown_population_is_not_converted_to_a_religion(self):
        self.assertEqual(shares_from_row({'CHRPC': 40, 'UNKPC': 60}), [{'traditionId': 'christianity', 'share': .4}])
        for row in [{'CHRPC': 0, 'UNKPC': 100}, {'CHRPC': 40, 'UNKPC': -1}, {'CHRPC': 60, 'UNKPC': 45}]:
            with self.subTest(row=row), self.assertRaises(ValueError):
                shares_from_row(row)

    def test_geography_selects_reviewed_parts_without_spreading_a_population_to_dependencies(self):
        mainland = [[[0, 0], [1, 0], [1, 1], [0, 0]]]
        overseas = [[[10, 10], [11, 10], [11, 11], [10, 10]]]
        features = {'FRA': {'geometry': {'type': 'MultiPolygon', 'coordinates': [mainland, overseas]}}}
        selected = reviewed_geometry({'geometryParts': [{'adm0A3': 'FRA', 'polygonIndices': [0]}]}, features)
        self.assertEqual(selected['coordinates'], [mainland])
        excluded = reviewed_geometry({'geometryParts': [{'adm0A3': 'FRA', 'excludePolygonIndices': [1]}]}, features)
        self.assertEqual(excluded['coordinates'], [mainland])
        with self.assertRaises(ValueError):
            reviewed_geometry({'geometryParts': [{'adm0A3': 'FRA', 'polygonIndices': [2]}]}, features)

    def test_mapping_requires_country_identity_and_reviewed_time_window(self):
        mapping = {'ccode': '20', 'sourceAbbrev': 'CAN', 'sourceIso3': 'CAN', 'fromYear': 1700, 'toYear': 2015}
        row = {'CCODE': 20, 'ABBREV': 'CAN', 'ISO3': 'CAN', 'YEAR': 1700}
        self.assertEqual(matching_mapping(row, [mapping]), mapping)
        for change in [{'YEAR': 1699}, {'YEAR': 2016}, {'ABBREV': 'CNA'}, {'ISO3': 'FRA'}, {'CCODE': 21}]:
            self.assertIsNone(matching_mapping({**row, **change}, [mapping]))
        with self.assertRaisesRegex(ValueError, 'Overlapping'):
            matching_mapping(row, [mapping, mapping])

    def test_incoherent_snapshot_is_omitted_and_geometry_is_deduplicated(self):
        mapping = {'ccode': '20', 'sourceAbbrev': 'CAN', 'sourceIso3': 'CAN', 'fromYear': 2000, 'toYear': 2015, 'geometryAdm0A3': 'CAN', 'populationScope': {'fr': 'Périmètre revu', 'en': 'Reviewed scope'}}
        extract = {'columns': ['CCODE', 'ABBREV', 'ISO3', 'YEAR', 'CHRPC', 'OREPC'],
                   'rows': [[20, 'CAN', 'CAN', 2000, 60, 0], [20, 'CAN', 'CAN', 2001, 59, 0], [20, 'CAN', 'CAN', 2002, 58, -1]],
                   'source': {'license': 'ARDA data use terms', 'citation': 'Brown and James'},
                   'geometries': [{'adm0A3': 'CAN', 'name': {'fr': 'Canada', 'en': 'Canada'}, 'geometry': {'type': 'Polygon', 'coordinates': [[[0, 0], [1, 0], [1, 1], [0, 0]]]}}]}
        result, rejected = build(extract, [mapping])
        self.assertEqual(len(result['geometries']), 1)
        self.assertEqual([row['time']['year'] for row in result['observations']], [2000, 2001])
        self.assertEqual(result['observations'][0]['regionId'], 'rcs-20')
        self.assertEqual(rejected[0]['year'], 2002)
        self.assertEqual(result['snapshotMaxAge'], 15)


if __name__ == '__main__':
    unittest.main()
