# Trạng thái tạm — tiếp tục ở phiên sau

## CẬP NHẬT 2026-10-07 sáng — commit `5ab0f9b` (chưa push)

Đã xong và commit: benchmark E4/E5 + tổng hợp, serving cuối `20261007-015257-b0376ef-d3`, web (Vitest 6/6, Docker image,
p95 API < 40 ms), profile `spark` tự bật trên JDK >= 17. **Việc còn lại: plan §19 (U1–U28).** Container `webapp` đang chạy, HDFS đã dừng.

## CẬP NHẬT 2026-10-07 ~00:40 (lịch sử)

Đã chạy thật trong phiên 2026-10-06 tối → 10-07:
- Sửa lỗi: `SparkSupport.finish` (TimeoutException chưa bắt → không compile), `AnalyticsController.sortKey` (generic không compile),
  notebook K-Means (chuỗi `"\n"` bị ghi thành xuống dòng thật → SyntaxError), notebook KNN (`spark.read.text` bỏ qua `_run.json` → thêm `mc.read_hdfs_text`).
- Build Spark `-Pspark`: 25/25 test. Pipeline D3 (`d3-run-ids.tsv`): A1 `20261006-223434`, ETL `224118`, A2–A5 `230505`, A7 `231209`, A8 `233917` (hậu tố `-b0376ef-d3`).
- Parity D3: Spark A1 = baseline = MR V1 (567 nhóm, 742 849). K-Means D3 `20261006-235739-b0376ef-d3`; KNN `20261007-000421-b0376ef-d3`.
- Serving run tạm `20261007-002341-b0376ef-d3` (đã sync, `_LATEST`), có benchmark MR nhưng CHƯA có Spark; trong `benchmarks/` lỡ có `datasets.json` (đã sửa script).
- Backend: `mvn clean package` + 7 test (parity thật K-Means 92 592/92 592, KNN 64 254/64 254); chạy `java -jar` và curl mọi endpoint OK.
- Frontend: `npm install` + `npm run build` OK; CHƯA xem trên trình duyệt.
- Tài liệu mới: `docs/ML.md`, `docs/END_TO_END.md`, `webapp/README.md`; evidence D3 trong `docs/evidence/{spark-java,ml}/README.md`; script `scripts/bench_summary.py`, `scripts/spark-bench-all.ps1`.

Đang chạy / còn lại:
1. `.\scripts\spark-bench-all.ps1` (E4/E5, log `docs/evidence/bench/spark-bench-all.log`); ô đã xong có `docs/evidence/bench/spark/<label>/summary.csv`, chạy lại sẽ bỏ qua ô đã có.
2. Sau đó: `py -3 scripts\bench_summary.py` → publish lần cuối (cùng run_id nguồn như trên, `--benchmarks-dir docs\evidence\bench\serving`) → sync `-SetLatest`.
3. Kiểm tra UI trên trình duyệt; build image `docker compose --profile web build webapp`; điền §12.4 + §10/§18.9 của plan; commit (không gồm CLAUDE.md, PDF, img, temp.md, serving/).

> Cập nhật 2026-10-06 (khoảng 05:30, trước khi người dùng tắt máy). Kế hoạch đầy đủ: `docs/PROJECT_AUDIT_AND_IMPLEMENTATION_PLAN.md`.
> File này là ghi chú làm việc, **không commit**.

## Chỉ đạo của người dùng (2026-10-06)

- Được phép chạy tới hết giai đoạn 4 với giải pháp có lợi; **ưu tiên cài/chạy local** trên máy.
- Dataset đã có sẵn trong `data/raw/` (`2019-Oct.csv`, `2019-Nov.csv`) — **không tự tải**.
- **Code lõi viết bằng Java** trong package `vn.edu.bigdata.revenue` (đã làm: `vn.edu.bigdata.revenue.spark`).
  **Chỉ K-Means/KNN là Python**, dạng **notebook** lưu vết tiến trình (đã làm: `notebooks/`).
- Commit lên nhánh `feat/nguyennd`, tác giả `nguyennd <nguyendinhnguyen2903@gmail.com>`, dòng `Co-Authored-By: Claude Opus 5.5`.
  Không gộp file người dùng staged (`CLAUDE.md`, 3 PDF, `img_1.png`) và `temp.md`.

## Commit đã có trên `feat/nguyennd`

| Commit | Nội dung |
|---|---|
| `2d44be7` | Giai đoạn 0 (EOL, Docker build/test) + giai đoạn 1 (HDFS, ingest, mẫu D1/D2, MR V1–V5 trên HDFS) |
| `24861e8` | Bit thực thi cho `scripts/hdfs-*.sh` |
| `b0376ef` | Giai đoạn 2 (Spark Java: A1 RDD, ETL, A2–A5, A7) + giai đoạn 4 (notebook K-Means/KNN, E7) + E1 + tài liệu |

Chưa push lên remote.

## Kết quả chính (đã kiểm chứng)

- `2019-Oct.csv` trên HDFS: 43 block, HEALTHY, SHA-256 qua HDFS trùng file gốc; 742 849 purchase hợp lệ (MR preflight = baseline Python cả tháng).
- A1 khớp tuyệt đối 3 chiều (MR V1 = Spark Java = Python stdlib): D1 308 nhóm, D2 495 nhóm.
- ETL bảo toàn số dòng (D2: 4 246 194 = 4 246 193 + 1 header); A1 = A2 (D2: 74 120).
- K-Means (D2, 25 084 sản phẩm): K = 2, silhouette 0.68 vs baseline 0.17/0.18; parity numpy 100%.
- KNN: agreement@10 = 0.054 > ngẫu nhiên 0.013 nhưng **không vượt** baseline phổ biến 0.063 → kết quả âm một phần. LSH recall@10 = 0.998.
- E7: cache giảm fit ~14% nhưng chi phí nạp cache lớn hơn phần tiết kiệm ở quy mô này.
- Bằng chứng: `docs/evidence/{windows-docker,hdfs,spark-java,ml}/README.md`.

## Đang chờ người dùng quyết định

1. **`CLAUDE.md` trong index:** khi commit `b0376ef` tôi đã `git reset` toàn bộ index rồi add lại → bản staged của `CLAUDE.md`
   bị thay bằng nội dung working tree (file trên đĩa không mất gì). Bản staged gốc nhiều khả năng là file rỗng (blob `e69de29`).
   Lệnh khôi phục đã bị hệ thống quyền chặn; người dùng tự chạy nếu muốn:
   `git update-index --cacheinfo 100644,e69de29bb2d1d6434b8b29ae775ad8c2e48c5391,CLAUDE.md`
   **Bài học:** khi commit bằng index tạm, chỉ `git reset -q -- <các path của mình>`, không reset toàn bộ index.
2. **Giai đoạn 3:** chạy D3 (cả tháng 10) cho MR và Spark; benchmark có lặp E2–E6 (mỗi lần quét cả tháng: vài phút đến vài chục phút).
3. `scripts/baseline_revenue.py`, `scripts/compare_revenue.py` giữ Python (công cụ kiểm tra độc lập) hay chuyển sang Java.
4. Có xóa `img.png` (untracked) / unstage `img_1.png` (ảnh đen) không; có commit 3 PDF (có bản quyền) không.

## Việc còn lại theo plan (chưa làm)

- Giai đoạn 3: D3, E2–E6 (E1, E7 đã xong).
- T1.7 YARN (P2, tùy chọn); KNN hướng A (tùy chọn).
- Giai đoạn 5 (tài liệu/báo cáo/demo), giai đoạn 6 (web app FastAPI + React, D10/D11).

## Khởi động lại sau khi bật máy

1. Mở Docker Desktop: `C:\Users\Hi\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe` (không ở `Program Files`), chờ `docker info` chạy được.
2. `docker compose up -d namenode datanode` → kiểm tra `docker compose exec namenode hdfs dfsadmin -report` có "Live datanodes (1)".
   Dữ liệu HDFS nằm trong named volume nên còn nguyên (đã kiểm chứng sau một lần restart WSL).
3. Spark local (PowerShell): `.\scripts\spark-local.ps1 build|submit ...`, `.\scripts\spark-pipeline.ps1 -InputPath ... -Tag ...`.
   Notebook: `cd notebooks; ..\.venv\Scripts\jupyter-nbconvert.exe --to notebook --execute --inplace <file>.ipynb`.

## Lưu ý môi trường

- `config/spark-local.env` (không commit): JDK 21 `C:\Users\Hi\.jdks\ms-21.0.12`, `HADOOP_HOME=E:\Library\hadoop-3.4.2` (winutils), `HADOOP_USER_NAME=hadoop`, `HDFS_URI=hdfs://localhost:8020`. Giá trị trong file ghi đè biến môi trường (JAVA_HOME máy là JDK 26, Spark 4.0 không chạy).
- Dùng PowerShell cho `.cmd`/spark-submit (Git Bash hỏng với đường dẫn có dấu cách và đổi `/data/...` thành đường dẫn Windows; nếu dùng Git Bash cho `docker compose exec` thì thêm `MSYS_NO_PATHCONV=1`).
- Script `.ps1` phải lưu UTF-8 **có BOM** (PowerShell 5.1); trong `.ps1` dùng `${var}:` thay cho `$var:`.
- Host: `python3` là alias Microsoft Store → dùng `py -3` hoặc `.venv\Scripts\python`.
- `~/.wslconfig` đã thêm `[experimental] autoMemoryReclaim=dropCache` (sao lưu `~/.wslconfig.bak-20261006`). RAM máy 7,9 GB: không chạy MR, Spark và notebook nặng đồng thời; Spark driver 1 GB.
- Image Docker `bigdata` chứa bản sao `scripts/` và `src/`: sửa thì `docker compose build bigdata` (kiểm tra exit code, đừng pipe qua `tail`).
- Client ghi HDFS phải đặt `dfs.replication=1` (đã có trong script và `SparkSupport`).
- HDFS hiện có: `/data/ecommerce/{raw, raw/sample, mr, fixtures, tmp/determinism, curated/events, agg/*, features/product, ml/{kmeans,knn}}`.
- `results/` (không commit) giữ bản cục bộ: `results/mr`, `results/spark`, `results/ml`, `results/baseline`, `results/samples` (bản sao D1, D2).

## Cập nhật 2026-10-06 chiều — giai đoạn 3 đang chạy

- Plan đã sửa các dòng lỗi thời (header, §2.1/§2.2, bảng #1/#3/#9/#15/#16/#19/#20, T0.x, T2.1/T2.6, D6, D10).
- Code mới (chưa commit): `RevenueJob --mode rdd-raw|df-raw|df-curated`, listener task metrics trong `SparkSupport`,
  test `revenueDataFrameOnCsvAndParquetMatchesOracle` (24/24 pass), `scripts/hdfs-fs.sh`, `scripts/spark-bench.ps1`,
  `config/bench/mr-*.json`; `spark-local.ps1` cho phép SPARK_MASTER/PARTITIONS/DRIVER_MEMORY của phiên ghi đè file env.
  Jar Spark trên host đã build lại SAU sửa RevenueJob nhưng TRƯỚC sửa SparkSupport/spark-local.ps1 → cần build lại trước khi đo Spark.
- E2-D1 MR xong: `results/benchmark-reports/4a650d42c2ab`. Chuỗi nền: E2-D2 → E3 maps2/4 → profile D3 → E2-D3 (log `docs/evidence/bench/mr-*.log`).
- Sau MR: build Spark; pipeline D3 (`spark-pipeline.ps1 -InputPath /data/ecommerce/raw/2019-Oct.csv -Tag d3`); E4 (3 mode × D1/D2/D3, ref = MR/baseline revenue.csv;
  cores 1/2/4 rdd-raw D2; partitions 8/64/200 df-raw D2); E5 (rdd-raw local[1] D2/D3); tổng hợp `docs/evidence/bench/README.md` + §12.
- REQUIRMENT.md (yêu cầu ML/web từ ChatGPT) đã phân tích + quyết định ở cuối file: KNN phân loại sản phẩm, backend Spring Boot, notebook giữ, làm sau GĐ3.
