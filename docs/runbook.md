# Chạy và đo cùng một bài toán

Yêu cầu JDK 11, Python ≥3.9. Wrapper ưu tiên JDK/Maven trong .tools; máy khác đặt JAVA_HOME cho JDK11.

```bash
./mvnw -Pintegration verify
python3 -m unittest discover -s scripts -p 'test_*.py'
./scripts/demo.sh results/my-demo
```

## CSV thật hoặc synthetic

Tải CSV Kaggle riêng, không cần credentials trong source. Dataset không có branch; chọn category_id. Ví dụ synthetic để benchmark:

```bash
python3 scripts/generate_workload.py --output data/samples/optimization-200k.csv --rows 200000 --groups 32 --purchase-rate 1 --seed 21
./scripts/prepare-input.sh data/samples/optimization-200k.csv results/optimization-meta
./scripts/run-local.sh --tool DatasetTool profile --manifest results/optimization-meta/input.json --output results/optimization-meta/profile.json --dictionary results/optimization-meta/groups.json
python3 scripts/benchmark.py --matrix config/benchmark-matrix.json
```

Mọi đường dẫn output/metadata phải mới. Benchmark 1 warmup +3 repeats mỗi variant, randomized order, cùng reducers=2, maxKeys=10000 và client completion poll=100ms (local). Hadoop mặc định5000ms có thể che chênh lệch trên job nhỏ; không đổi polling riêng từng variant. Profile cost riêng và cộng vào V4/V5 CLI + profile scan timing. Logs/manifest/raw/summary lưu ở outputRoot.

## Chạy từng variant

```bash
./scripts/run-local.sh --variant v5 --manifest results/optimization-meta/input.json --preflight results/optimization-meta/preflight.json --dictionary results/optimization-meta/groups.json --output results/my-v5 --group-by category_id --reducers 2 --max-keys 10000
```

V1–V3 không cần dictionary; V4–V5 bắt buộc dictionary cùng input fingerprint, policy, group mode. Cả năm chỉ một job. K>100000 chọn bounded V3; không tự đổi thuật toán giữa benchmark.

Cluster dùng scripts/run-cluster.sh và cùng CLI; chỉnh config/cluster.properties theo cụm, upload CSV trước preflight để manifest giữ đúng URI/checksum. Dictionary được localized qua Distributed Cache. Hadoop dependencies provided; build lại với -Dhadoop.version nếu cụm khác3.4.2 và kiểm thử trên cụm.

Exit 0: job và validation valid; 1: job/validation failure; 2: CLI/artifact/input lỗi. Không coi riêng _SUCCESS là đủ: malformed runtime input có thể làm manifest failed sau khi job hoàn tất. Xem counters MAP_OUTPUT_RECORDS, REDUCE_INPUT_RECORDS, MAP_OUTPUT_BYTES, shuffle/spill và elapsed trong run.json. Không so thời gian có profile của variant này với thời gian bỏ profile của variant khác.
