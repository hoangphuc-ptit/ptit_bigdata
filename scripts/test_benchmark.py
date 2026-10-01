import unittest
from benchmark import summarize, profile_cost


class BenchmarkTest(unittest.TestCase):
    def test_profile_cost_requires_matching_provenance(self):
        manifest = {"inputFingerprint": "input", "policyHash": "policy", "groupMode": "CATEGORY_ID"}
        profile = {**manifest, "schemaVersion": 1, "elapsedMillis": 27}
        self.assertEqual(27, profile_cost(profile, manifest))
        self.assertIsNone(profile_cost(None, manifest))
        with self.assertRaises(ValueError):
            profile_cost({**profile, "inputFingerprint": "stale"}, manifest)

    def test_missing_profile_measurement_is_not_reported_as_zero(self):
        records = [{"variant": "v5", "success": True, "warmup": False,
                    "jobMillis": 10, "endToEndMillis": 20, "profileMillis": None,
                    "shuffleBytes": 100, "effectiveVariant": "v5"}] * 3
        self.assertIsNone(summarize(records, ["v5"], 3)[0]["endToEndWithProfileMedianMillis"])

    def test_medians_and_speedup_use_complete_runs(self):
        records = []
        for variant, times in {"v1": [9, 10, 11], "v3": [4, 5, 6]}.items():
            for value in times:
                records.append({"variant": variant, "success": True, "warmup": False,
                                "jobMillis": value, "endToEndMillis": value + 1,
                                "profileMillis": 0, "shuffleBytes": 100,
                                "effectiveVariant": variant})
        rows = summarize(records, ["v1", "v3"], 3)
        self.assertEqual(10, rows[0]["jobMedianMillis"])
        self.assertEqual(5, rows[1]["jobMedianMillis"])
        self.assertEqual(2, rows[1]["speedupVsV1"])

    def test_failed_and_warmup_runs_never_improve_speedup(self):
        records = [{"variant": "v1", "success": False, "warmup": False, "jobMillis": 1},
                   {"variant": "v1", "success": True, "warmup": True, "jobMillis": 1}]
        with self.assertRaises(ValueError):
            summarize(records, ["v1"], 3)


if __name__ == "__main__":
    unittest.main()
