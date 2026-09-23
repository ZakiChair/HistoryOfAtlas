"""Catch temporal extrapolation and false mineral attribution in satellite imports."""

import copy
import importlib.util
from pathlib import Path
import unittest

PATH = Path(__file__).resolve().parents[2] / "pipeline/resources/current-rare-earths-build.py"
SPEC = importlib.util.spec_from_file_location("current_rare_earths", PATH)
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


def row(**overrides):
    result = dict(objectid=20, globalid="{test-id}", name=None,
                  metal="Rare Earth", method="In-situ Leaching", year="2023",
                  imgyear="2026", last_updated=1787270400000, status=None,
                  latitude=25.1, longitude=98.2, country="Myanmar", adm1="Kachin",
                  subbasin="Chi Pwi Hka (Myanmar)", source="Stimson Center/Planet Labs")
    result.update(overrides)
    return result


class CurrentRareEarthsTests(unittest.TestCase):
    def test_metadata_and_newer_imagery_do_not_extend_operation(self):
        sites, audit = BUILDER.normalize_stimson([row()])
        self.assertEqual(len(sites), 1)
        self.assertEqual([(p["fromYear"], p["toYear"]) for p in sites[0]["periods"]], [(2023, 2023)])
        self.assertEqual(audit[0]["imageYear"], "2026")

    def test_2026_mining_observation_keeps_category_and_position(self):
        original = [row(year="2026")]
        before = copy.deepcopy(original)
        sites, _ = BUILDER.normalize_stimson(original)
        self.assertEqual(len(sites), 1)
        self.assertEqual(sites[0]["coordinates"], [98.2, 25.1])
        self.assertEqual(sites[0]["periods"][0]["categories"], ["rare-earths"])
        self.assertEqual(sites[0]["periods"][0]["toYear"], 2026)
        self.assertTrue(sites[0]["periods"][0]["approximate"])
        self.assertEqual(original, before)

    def test_unbounded_older_year_future_year_and_other_minerals_excluded(self):
        sites, audit = BUILDER.normalize_stimson([
            row(year="2015 or Older"), row(objectid=21, year="2027"),
            row(objectid=22, metal="Gold"), row(objectid=23, latitude=999),
        ])
        self.assertEqual(sites, [])
        self.assertEqual(len(audit), 4)
        self.assertTrue(all(r["excludedReason"] for r in audit))

    def test_identifiers_deduplicate_without_merging_nearby_mines(self):
        sites, _ = BUILDER.normalize_stimson([row(), row(), row(objectid=21, globalid="{other-id}")])
        self.assertEqual(len(sites), 2)
        self.assertEqual(len({s["id"] for s in sites}), 2)


if __name__ == "__main__":
    unittest.main()
