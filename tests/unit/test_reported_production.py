"""Evidence-level guards for the offline quarterly production importer."""
import importlib.util
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    'reported_production', ROOT / 'pipeline/resources/reported-production-build.py'
)
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


class ReportedProductionTests(unittest.TestCase):
    def setUp(self):
        self.match = {'aliases': ['Cannington']}
        self.row = {
            'metric': 'production', 'value_normalized': 11.4, 'confidence': 1.0,
            'period_type': 'quarterly', 'calendar_period': 'Q2 2026',
            'time_period': 'Q4 FY2026', 'source_url': 'https://example.org/report.pdf',
            'source_section': 'OPERATING PERFORMANCE',
            'source_table': 'Cannington (100% share)',
            'source_row': 'Payable zinc production (kt)', 'source_column': '4Q26',
            'product_form': None,
        }

    def test_fiscal_quarter_uses_explicit_calendar_conversion(self):
        self.assertEqual(BUILDER.observation_year(self.row), 2026)
        for period in ['Q3 2026', 'Q4 2026', 'Q1 2027', 'FY2026', 'H1 2026']:
            self.assertIsNone(BUILDER.observation_year({**self.row, 'calendar_period': period}))

    def test_positive_mine_production_and_payable_output_are_accepted(self):
        self.assertIsNone(BUILDER.rejection_reason(self.row, self.match))

    def test_equivalent_output_does_not_prove_its_reference_metal(self):
        for label in ['Payable zinc equivalent production (kt)3', 'Zinc Equivalent12',
                      'CuEq production', 'Gold-equivalent ounces']:
            self.assertEqual(BUILDER.rejection_reason({**self.row, 'source_row': label}, self.match),
                             'metal_equivalent')
        self.assertEqual(BUILDER.rejection_reason(
            {**self.row, 'product_form': 'zinc equivalent'}, self.match), 'metal_equivalent')

    def test_mine_name_requires_word_boundaries(self):
        self.assertEqual(BUILDER.rejection_reason(
            {**self.row, 'source_table': 'Quarterly data rates'}, {'aliases': ['Tara']}),
            'no_mine_specific_report_locator')
        self.assertIsNone(BUILDER.rejection_reason(
            {**self.row, 'source_table': 'Neves-Corvo mine'}, {'aliases': ['Neves Corvo']}))

    def test_company_total_without_named_mine_is_rejected(self):
        row = {**self.row, 'source_table': 'Group production', 'source_row': 'Total zinc'}
        self.assertEqual(BUILDER.rejection_reason(row, self.match),
                         'no_mine_specific_report_locator')

    def test_forecast_columns_and_reprocessing_forms_are_rejected(self):
        for change in [{'source_column': 'Q2 2026 guidance'}, {'product_form': 'stockpile recovery'},
                       {'source_table': 'Cannington tailings reprocessing'}]:
            self.assertEqual(BUILDER.rejection_reason({**self.row, **change}, self.match),
                             'forecast_or_reprocessing')

    def test_sales_and_nonproduction_values_cannot_establish_presence(self):
        for change in [{'metric': 'sales'}, {'value_normalized': 0}, {'value_normalized': -1},
                       {'value_normalized': float('nan')}, {'period_type': 'aggregate'}]:
            self.assertIsNotNone(BUILDER.rejection_reason({**self.row, **change}, self.match))
        self.assertEqual(BUILDER.rejection_reason(
            {**self.row, 'source_row': 'Payable zinc sales (kt)'}, self.match), 'sales_or_grade')

    def test_pinned_snapshot_contains_no_equivalent_evidence(self):
        result = BUILDER.build()
        self.assertGreaterEqual(len(result['updates']), 50)
        self.assertFalse(any('equivalent' in str(a.get('row')).lower() for a in result['audit']))
        self.assertFalse(any(a['year'] > 2026 for a in result['audit']))


if __name__ == '__main__':
    unittest.main()
