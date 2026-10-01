#!/usr/bin/env python3
"""Run Hadoop CLI variants fairly; retain every command, log and manifest."""
import argparse
import csv
import json
import random
import statistics
import subprocess
import time
import uuid
from pathlib import Path


def profile_cost(profile, manifest):
    if profile is None:
        return None
    if profile.get("schemaVersion") != 1 or any(
            profile.get(key) != manifest.get(key)
            for key in ("inputFingerprint", "policyHash", "groupMode")):
        raise ValueError("Profile artifact does not match benchmark run")
    elapsed = profile.get("elapsedMillis")
    if not isinstance(elapsed, int) or elapsed < 0:
        raise ValueError("Profile cost must be a measured nonnegative elapsedMillis")
    return elapsed


def summarize(records, variants, repeats):
    selected = [r for r in records if r.get("success") and not r.get("warmup")]
    medians = {}
    for variant in variants:
        runs = [r for r in selected if r["variant"] == variant]
        if len(runs) < repeats:
            raise ValueError(f"{variant}: only {len(runs)} valid measured runs; need {repeats}")
        medians[variant] = statistics.median(r["jobMillis"] for r in runs)
    rows = []
    for variant in variants:
        runs = [r for r in selected if r["variant"] == variant]
        durations = [r["jobMillis"] for r in runs]
        rows.append({
            "variant": variant, "effectiveVariant": ",".join(sorted({r["effectiveVariant"] for r in runs})),
            "runs": len(runs), "jobMedianMillis": medians[variant],
            "jobMinMillis": min(durations), "jobMaxMillis": max(durations),
            "endToEndMedianMillis": statistics.median(r["endToEndMillis"] for r in runs),
            "endToEndWithProfileMedianMillis": statistics.median(r["endToEndMillis"] + r["profileMillis"] for r in runs)
            if all(r["profileMillis"] is not None for r in runs) else None,
            "shuffleMedianBytes": statistics.median(r["shuffleBytes"] for r in runs),
            "mapOutputMedianRecords": statistics.median(r["mapOutputRecords"] for r in runs) if all("mapOutputRecords" in r for r in runs) else None,
            "reduceInputMedianRecords": statistics.median(r["reduceInputRecords"] for r in runs) if all("reduceInputRecords" in r for r in runs) else None,
            "speedupVsV1": medians.get("v1", 0) / medians[variant] if medians[variant] else None,
        })
    return rows


def read_json(config, uri):
    if "manifestReader" in config:
        result = subprocess.run(config["manifestReader"] + [uri], check=True, capture_output=True, text=True)
        return json.loads(result.stdout)
    return json.loads(Path(uri).read_text())


def read_manifest(config, output):
    return read_json(config, output.rstrip("/") + "/run-manifest.json")


def run_case(config, variant, output, log_path, warmup):
    command = list(config["launcher"]) + [
        "--variant", variant, "--manifest", config["manifest"], "--preflight", config["preflight"],
        "--output", output,
        "--group-by", config.get("groupBy", "category_id"),
        "--reducers", str(config.get("reducers", 2)),
        "--max-keys", str(config.get("maxKeys", 10000)),
        "--compress", str(config.get("compress", False)).lower(),
    ]
    if variant in {"v4", "v5"}:
        command += ["--dictionary", config["dictionary"]]
    record = {"variant": variant, "output": output, "warmup": warmup, "success": False, "command": command}
    start = time.perf_counter()
    try:
        with log_path.open("w") as log:
            completed = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
        record["clientWallMillis"] = round((time.perf_counter() - start) * 1000)
        if completed.returncode:
            raise ValueError(f"CLI exited {completed.returncode}; see {log_path}")
        manifest = read_manifest(config, output)
        if manifest["validationStatus"] != "valid" or not all(s["success"] for s in manifest["stages"]):
            raise ValueError("Run manifest failed validation")
        record.update({
            "manifest": manifest, "effectiveVariant": manifest["effectiveVariant"],
            "jobMillis": sum(s["elapsedMillis"] for s in manifest["stages"]),
            "endToEndMillis": manifest["endToEndMillis"],
            "profileMillis": profile_cost(config.get("measuredProfile"), manifest) if variant in {"v4", "v5"} else 0,
            "shuffleBytes": sum(s["counters"].get("org.apache.hadoop.mapreduce.TaskCounter.REDUCE_SHUFFLE_BYTES", 0) for s in manifest["stages"]),
            "mapOutputRecords": manifest["stages"][0]["counters"].get("org.apache.hadoop.mapreduce.TaskCounter.MAP_OUTPUT_RECORDS", 0),
            "reduceInputRecords": manifest["stages"][0]["counters"].get("org.apache.hadoop.mapreduce.TaskCounter.REDUCE_INPUT_RECORDS", 0),
            "success": True,
        })
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        record["error"] = str(error)
    return record


def validate_runs(config, records, report_dir):
    successes = [r for r in records if r["success"]]
    reference = next((r for r in successes if r["variant"] == "v1"), None)
    if reference is None:
        raise ValueError("No valid V1 reference")
    fingerprint = reference["manifest"]["inputFingerprint"]
    for index, record in enumerate(successes):
        if record["manifest"]["inputFingerprint"] != fingerprint:
            record.update(success=False, error="Input fingerprint changed between runs")
            continue
        if record is reference:
            continue
        command = list(config["datasetLauncher"]) + ["compare", "--left", reference["output"], "--right", record["output"]]
        with (report_dir / f"compare-{index}.log").open("w") as log:
            result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
        if result.returncode:
            record.update(success=False, error="Cross-variant output comparison failed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--matrix", default="config/benchmark-matrix.json")
    args = parser.parse_args()
    config = json.loads(Path(args.matrix).read_text())
    if "profileMillis" in config:
        parser.error("Use profileReport artifact instead of manual/unmeasured profileMillis")
    if "profileReport" in config:
        config["measuredProfile"] = read_json(config, config["profileReport"])
    if config.get("repeats", 3) < 3 or config.get("warmups", 1) < 1:
        parser.error("Require >=3 repeats and >=1 warmup")
    variants = config["variants"]
    if "v1" not in variants or len(set(variants)) != len(variants) or not set(variants) <= {"v1", "v2", "v3", "v4", "v5"}:
        parser.error("Unique variants v1..v5 including v1 required")
    session = uuid.uuid4().hex[:12]
    report_dir = Path(config.get("reportRoot", "results/benchmark-reports")) / session
    report_dir.mkdir(parents=True)
    (report_dir / "matrix.json").write_text(json.dumps(config, indent=2))
    rng = random.Random(config.get("seed", 21))
    records = []
    rounds = config.get("warmups", 1) + config.get("repeats", 3)
    for round_id in range(rounds):
        order = list(variants)
        rng.shuffle(order)
        for variant in order:
            output = f'{config["outputRoot"].rstrip("/")}/{session}-{round_id}-{variant}'
            print(f"Round {round_id}: {variant}", flush=True)
            record = run_case(config, variant, output, report_dir / f"{round_id}-{variant}.log", round_id < config.get("warmups", 1))
            records.append(record)
            (report_dir / "runs.json").write_text(json.dumps(records, indent=2))
    try:
        validate_runs(config, records, report_dir)
        (report_dir / "runs.json").write_text(json.dumps(records, indent=2))
        rows = summarize(records, variants, config.get("repeats", 3))
    except ValueError as error:
        print(f"Incomplete benchmark: {error}; raw records: {report_dir}")
        return 1
    with (report_dir / "summary.csv").open("w", newline="") as out:
        writer = csv.DictWriter(out, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Report: {report_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
