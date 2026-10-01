#!/usr/bin/env python3
"""Generate labeled synthetic CSV workloads; never describe these as Kaggle data."""
import argparse
import csv
import json
import random
from pathlib import Path

HEADER = ["event_time", "event_type", "product_id", "category_id", "category_code",
          "brand", "price", "user_id", "user_session"]


def generate(output, rows, groups, mode, skew, purchase_rate, seed):
    if rows < 1 or groups < 1 or mode not in {"uniform", "skew", "cardinality"}:
        raise ValueError("Positive rows/groups and known mode required")
    if not 0 <= skew <= 1 or not 0 <= purchase_rate <= 1:
        raise ValueError("skew and purchase-rate must be in [0,1]")
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)
    with output.open("x", newline="") as file:
        writer = csv.writer(file, lineterminator="\n")
        writer.writerow(HEADER)
        for index in range(rows):
            event = "purchase" if rng.random() < purchase_rate else "view"
            group = index if mode == "cardinality" else rng.randrange(groups)
            if mode == "skew" and rng.random() < skew:
                group = 0
            price = rng.randrange(5001)
            writer.writerow(["2019-10-01 00:00:00 UTC", event, index % 1000, group,
                             f"synthetic.category{group}", "synthetic", f"{price // 100}.{price % 100:02}",
                             "synthetic-user", "synthetic-session"])
    return {"synthetic": True, "rows": rows, "groups": groups, "mode": mode,
            "skew": skew, "purchaseRate": purchase_rate, "seed": seed}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--rows", type=int, default=100000)
    parser.add_argument("--groups", type=int, default=100)
    parser.add_argument("--mode", choices=["uniform", "skew", "cardinality"], default="uniform")
    parser.add_argument("--skew", type=float, default=0.9)
    parser.add_argument("--purchase-rate", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=21)
    args = parser.parse_args()
    metadata = generate(args.output, args.rows, args.groups, args.mode, args.skew, args.purchase_rate, args.seed)
    Path(str(args.output) + ".workload.json").write_text(json.dumps(metadata, indent=2))
    print(args.output)


if __name__ == "__main__":
    main()
