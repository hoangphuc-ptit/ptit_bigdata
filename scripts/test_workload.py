import csv
import tempfile
import unittest
from pathlib import Path
from generate_workload import generate


class WorkloadTest(unittest.TestCase):
    def test_skew_and_cardinality_are_explicit_and_deterministic(self):
        with tempfile.TemporaryDirectory() as directory:
            a, b = Path(directory) / "a.csv", Path(directory) / "b.csv"
            generate(a, rows=10, groups=3, mode="skew", skew=1, purchase_rate=1, seed=21)
            generate(b, rows=10, groups=3, mode="skew", skew=1, purchase_rate=1, seed=21)
            self.assertEqual(a.read_text(), b.read_text())
            with a.open() as file:
                data = list(csv.DictReader(file))
            self.assertEqual(10, len(data))
            self.assertEqual({"0"}, {row["category_id"] for row in data})
            c = Path(directory) / "c.csv"
            generate(c, rows=10, groups=3, mode="cardinality", skew=0, purchase_rate=1, seed=21)
            with c.open() as file:
                self.assertEqual(10, len({row["category_id"] for row in csv.DictReader(file)}))


if __name__ == "__main__":
    unittest.main()
