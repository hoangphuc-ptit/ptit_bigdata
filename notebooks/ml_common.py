"""Tiện ích dùng chung cho notebook K-Means/KNN: SparkSession local đọc HDFS trong Docker, lưu vết lần chạy.

Phần lõi (ETL, Group By A1-A5, đặc trưng A7) là Java: package vn.edu.bigdata.revenue.spark.
Notebook chỉ đọc đặc trưng A7 đã được Java ghi lên HDFS (/data/ecommerce/features/product/run_id=...).
"""

import json
import os
import platform
import subprocess
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
LOCAL_ENV = PROJECT_ROOT / "config" / "spark-local.env"
EVIDENCE_JAVA = PROJECT_ROOT / "docs" / "evidence" / "spark-java"
RESULTS_ML = PROJECT_ROOT / "results" / "ml"
FEATURES_ROOT = "/data/ecommerce/features/product"
# Phải trùng ProductFeaturesJob.FEATURES (Java); notebook kiểm tra cột tồn tại khi đọc.
FEATURES = ["log_views", "log_carts", "log_purchases", "cart_rate", "purchase_rate", "log_median_price", "log_distinct_users"]


def load_local_env() -> None:
    """config/spark-local.env ghi đè biến môi trường (JAVA_HOME toàn máy có thể là JDK 23+, Spark 4.0 không hỗ trợ)."""
    for line in LOCAL_ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ[key.strip()] = value.strip()
    os.environ["PYSPARK_PYTHON"] = sys.executable
    os.environ["PYSPARK_DRIVER_PYTHON"] = sys.executable
    if platform.system() == "Windows" and os.environ.get("HADOOP_HOME"):
        os.environ["PATH"] = str(Path(os.environ["HADOOP_HOME"]) / "bin") + os.pathsep + os.environ["PATH"]


def hdfs(path: str) -> str:
    return os.environ.get("HDFS_URI", "hdfs://localhost:8020") + path


def session(app: str):
    load_local_env()
    from pyspark.sql import SparkSession

    spark = (
        SparkSession.builder.appName(app)
        .master(os.environ.get("SPARK_MASTER", "local[2]"))
        .config("spark.driver.memory", os.environ.get("SPARK_DRIVER_MEMORY", "1g"))
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.sql.shuffle.partitions", os.environ.get("SPARK_SHUFFLE_PARTITIONS", "8"))
        .config("spark.ui.showConsoleProgress", "false")
        .config("spark.hadoop.fs.defaultFS", hdfs(""))
        .config("spark.hadoop.dfs.client.use.datanode.hostname", "true")
        .config("spark.hadoop.dfs.replication", "1")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    return spark


def git_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=PROJECT_ROOT, text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        return "nogit"


def new_run_id(tag: str) -> str:
    return f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{git_sha()}-{tag}"


def pipeline_run_id(tag: str, job: str) -> str:
    """run_id do scripts/spark-pipeline.ps1 ghi lại (docs/evidence/spark-java/<tag>-run-ids.tsv)."""
    for line in (EVIDENCE_JAVA / f"{tag}-run-ids.tsv").read_text(encoding="utf-8-sig").splitlines():
        name, _, value = line.partition("\t")
        if name == job:
            return value.strip()
    raise KeyError(f"Không có run_id '{job}' cho {tag}")


def environment(spark) -> dict:
    jvm = spark.sparkContext._jvm
    return {
        "sparkVersion": spark.version,
        "javaVersion": jvm.System.getProperty("java.version"),
        "hadoopClientVersion": jvm.org.apache.hadoop.util.VersionInfo.getVersion(),
        "pythonVersion": platform.python_version(),
        "master": spark.sparkContext.master,
        "driverMemory": spark.conf.get("spark.driver.memory"),
        "gitSha": git_sha(),
    }


def write_hdfs_json(spark, path: str, value) -> None:
    """Ghi JSON nhỏ lên HDFS, create-only (overwrite=false)."""
    jvm = spark.sparkContext._jvm
    target = jvm.org.apache.hadoop.fs.Path(hdfs(path))
    fs = target.getFileSystem(spark.sparkContext._jsc.hadoopConfiguration())
    stream = fs.create(target, False)
    try:
        stream.write(bytearray(json.dumps(value, indent=2, default=str).encode("utf-8")))
    finally:
        stream.close()


class Trace:
    """Lưu vết thời gian từng bước; in ra ngay để output notebook giữ lại tiến trình."""

    def __init__(self, job: str, run_id: str, params: dict):
        self.started = time.perf_counter()
        self.record = {"job": job, "runId": run_id, "params": params, "startedAt": datetime.now(timezone.utc).isoformat(), "stages": [], "metrics": {}}

    @contextmanager
    def stage(self, name: str):
        t0 = time.perf_counter()
        print(f"[{datetime.now():%H:%M:%S}] bắt đầu: {name}")
        yield
        ms = round((time.perf_counter() - t0) * 1000)
        self.record["stages"].append({"name": name, "elapsedMillis": ms})
        print(f"[{datetime.now():%H:%M:%S}] xong: {name} ({ms} ms)")

    def finish(self, local_dir: Path) -> dict:
        self.record["endToEndMillis"] = round((time.perf_counter() - self.started) * 1000)
        local_dir.mkdir(parents=True, exist_ok=True)
        (local_dir / f"{self.record['job']}-run.json").write_text(json.dumps(self.record, indent=2, default=str), encoding="utf-8")
        return self.record
