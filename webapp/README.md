# Web app: Spring Boot (suy luận online) + React (trực quan hóa)

Tầng trình bày đặt **sau** pipeline Big Data. Web app không chạy Spark/MapReduce, không đọc CSV thô, không đọc HDFS và
không huấn luyện mô hình. Nó chỉ đọc *serving artifacts* do pipeline publish, kiểm tra sha256 rồi trả dữ liệu hoặc suy luận.

```text
OFFLINE (batch)                                                     ONLINE
HDFS raw ─► Spark Java (ETL, A1–A8) ─► notebook (Spark MLlib) ─►   ./serving/<run_id>/ (chỉ đọc)
                      MR V1 (đối chứng) ┘        │                         │
                                  SparkTool publish ─► HDFS /data/ecommerce/serving/<run_id>/
                                                     └─ scripts/serving-sync.ps1 (hdfs -get + sha256) ┘
React ──► Spring Boot /api/** ──► ServingRepository (manifest + sha256) ──► KMeansModel / KnnModel (Java) ──► JSON
```

| Thành phần | Mã nguồn | Vai trò |
|---|---|---|
| `ServingRepository` | `backend/.../serving/` | Liệt kê run có `manifest.json`; chỉ đọc file có trong manifest và sha256 khớp; cache nội dung |
| `ModelRegistry` | `backend/.../ml/ModelRegistry.java` | Danh mục mô hình theo `metadata.json`; nạp `KMeansModel`/`KnnModel` một lần rồi cache |
| `KMeansModel` | `backend/.../ml/KMeansModel.java` | `(x − mean) · (1/std)` như `StandardScalerModel` của Spark, rồi tâm gần nhất (hòa → chỉ số nhỏ hơn) |
| `KnnModel` | `backend/.../ml/KnnModel.java` | Chuẩn hóa như trên, k láng giềng gần nhất trên tập train đã lưu (Euclidean², hòa → dòng train nhỏ hơn), `vote_share = số láng giềng nhãn 1 / k`, nhãn = `vote_share ≥ ngưỡng` |
| `ProductFeatures` | `backend/.../ml/ProductFeatures.java` | Tính lại đặc trưng từ số đếm thô đúng như `ProductFeaturesJob` (A7) / `ProductLabelJob` (A8); cảnh báo ngoài miền |
| React | `frontend/src/pages/` | Tổng quan, Group By, MapReduce vs Spark, `/ml/kmeans`, `/ml/knn`; không có số liệu cứng |

KNN là *lazy learner*: "huấn luyện" chỉ là lưu tập train đã chuẩn hóa (notebook làm, offline). Việc tìm láng giềng và bỏ phiếu
lúc dự đoán chính là phép suy luận của KNN, không phải huấn luyện trong HTTP request. Spark MLlib không có bộ phân loại KNN.

## Hợp đồng serving artifact (`/data/ecommerce/serving/<run_id>/`)

Tạo bởi `SparkTool publish` (`src/main/java/vn/edu/bigdata/revenue/spark/ServingPublishJob.java`), ghi một lần (thư mục mới,
không ghi đè), `manifest.json` ghi **cuối cùng**: run thiếu manifest là run hỏng và backend bỏ qua.

| File | Nguồn | Nội dung |
|---|---|---|
| `manifest.json` | publish | `schemaVersion`, `runId`, `createdAt`, `gitSha`, `dataset{tag,input}`, `sources` (run_id từng job, output MR), `files[{path, sha256, bytes, rows?}]` |
| `analytics/revenue_parity.json` | MR V1 (`part-r-*`) so với Spark A1 (Parquet) | `matched`, `mrGroups`, `sparkGroups`, `mrPurchaseCount`, `mismatchCount`, tối đa 50 nhóm lệch |
| `analytics/revenue_by_category.csv` | Spark A1 + `category_code` từ A2 | `group_key, category_code, total_revenue, purchase_count, average_revenue` |
| `analytics/funnel_by_category.csv` | Spark A2/A3 | `category_id, events, views, carts, removes, purchases, revenue_minor, category_code, distinct_codes, view_to_purchase, cart_to_purchase` |
| `analytics/funnel_by_brand.csv` | Spark A5 | như trên theo `brand` (`__UNKNOWN__` = brand rỗng) |
| `analytics/trend_by_hour.csv` | Spark A4 | `event_date, event_hour` (UTC), số sự kiện theo loại, `revenue_minor`, `distinct_users` |
| `analytics/quality.json` | ETL | `rowsIn`, `rowsValid`, `rejected`, `rowsWritten`, `quality{...}` |
| `benchmarks/<thí nghiệm>.json` | `scripts/bench_summary.py` | `experiment, title, dataset, scope, metric, unit, rows[{label, median, min, max, runs, details}], notes, source` |
| `ml/models.json` | publish | mảng `metadata.json` của các mô hình trong run |
| `ml/kmeans/{model,metrics,metadata}.json`, `sweep.csv`, `profile.csv`, `assignments.csv` | notebook K-Means | xem dưới |
| `ml/knn/{model,metrics,metadata}.json`, `train_set.csv`, `products.csv` | notebook KNN | xem dưới |

`cart_to_purchase` = purchases / carts có thể > 1 vì dữ liệu có purchase không đi qua sự kiện cart; đây là tỷ số, không phải xác suất chuyển đổi.

**`metadata.json` (mọi mô hình):** `model_type`, `algorithm`, `run_id`, `training_time`, `dataset` (tag, run_id đặc trưng/nhãn, tham số),
`features`, `feature_preprocessing`, `hyperparameters`, `metrics`, `model_path` (thư mục trên HDFS, chứa cả model Spark MLlib đã `save`), `status`.

**`ml/kmeans/model.json`:** `type=kmeans`, `runId`, `featuresRunId`, `k`, `seed`, `features` (đúng thứ tự `VectorAssembler`),
`scalerMean`, `scalerStd` (StandardScaler `withMean=true, withStd=true`), `centers` (không gian đã chuẩn hóa).
`assignments.csv`: mỗi sản phẩm của tập huấn luyện với `cluster` do **Spark** gán, đặc trưng và số đếm thô.

**`ml/knn/model.json`:** `type=knn-classifier`, `runId`, `labelsRunId`, `k`, `threshold`, `features`, `scalerMean`, `scalerStd`,
`distance`, `tieBreak`, `score`, `trainRows`. `train_set.csv`: `row, product_id, label, z_<feature>...` (đã chuẩn hóa).
`products.csv`: sản phẩm của ảnh chụp **test** với nhãn thật, `vote_share`/`prediction` của notebook, số đếm thô và đặc trưng.

## API

Lỗi trả theo RFC 9457 (`application/problem+json`): 404 không có run/mô hình/sản phẩm, 422 đầu vào sai, 503 artifact hỏng
(checksum sai, model.json không nhất quán), 400 body không hợp lệ (ví dụ số âm).

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/health` | `servingDir`, số run, run mặc định (`_LATEST`), `UP`/`NO_DATA` |
| GET | `/api/runs`, `/api/runs/{runId}` | danh sách run; manifest |
| GET | `/api/analytics/{runId}/tables/{name}?sort=&order=&q=&limit=&offset=` | `revenue_by_category`, `funnel_by_category`, `funnel_by_brand`, `trend_by_hour` |
| GET | `/api/analytics/{runId}/parity`, `/quality` | đối chiếu MR/Spark; chất lượng dữ liệu |
| GET | `/api/analytics/{runId}/benchmarks`, `/benchmarks/{name}` | danh sách và bảng E2–E7 |
| GET | `/api/ml/{kmeans\|knn}/models` | mô hình đã publish (run huấn luyện, run serving, metadata) |
| GET | `/api/ml/{kmeans\|knn}/{runId}`, `/{runId}/metrics` | metadata + metrics |
| GET | `/api/ml/kmeans/{runId}/clusters` | K, tâm cụm, kích thước, hồ sơ cụm |
| GET | `/api/ml/{kmeans\|knn}/{runId}/products?q=&limit=` | tìm sản phẩm thật theo id/brand/category để demo |
| POST | `/api/ml/kmeans/predict` | body `{runId?, productId}` hoặc `{runId?, raw:{views, carts, purchases, medianPrice, distinctUsers}}` → `cluster`, `squaredDistances`, `standardizedFeatures`, `outOfDomain`, `warnings`; theo productId thì thêm `sparkCluster`, `matchesSpark` |
| POST | `/api/ml/knn/predict` | như trên, `raw` cần thêm `recentViews` → `label`, `voteShare` (không phải xác suất), `k`, `threshold`, `neighbours[]`; theo productId thêm `actualLabel`, `notebookVoteShare` |

`runId` bỏ trống = mô hình trong serving run mặc định. Không có endpoint huấn luyện (training API là P2, chưa làm).

## Chạy

Yêu cầu: JDK 21, Maven (dùng `..\.tools\apache-maven-3.9.11` của repo), Node 24 (chỉ để build frontend), một serving run đã sync.

```powershell
# 1. Publish + sync (HDFS phải chạy; xem docs/END_TO_END.md)
.\scripts\serving-sync.ps1 -RunId <serving_run_id> -SetLatest
# 2. Build frontend và backend; ServingParityTest đối chiếu Java với Spark/numpy trên ./serving
cd webapp\frontend; npm install; npm run build; cd ..\backend
$env:JAVA_HOME = "C:\Users\Hi\.jdks\ms-21.0.12"   # JDK 21 của máy
..\..\.tools\apache-maven-3.9.11\bin\mvn.cmd -B clean package
# 3. Chạy (không cần HDFS/Spark)
java -Xmx512m -jar target\revenue-webapp.jar "--serving.dir=..\..\serving" "--spring.web.resources.static-locations=file:../frontend/dist/"
# http://localhost:8080
```

Docker (một image gồm React build + Spring Boot): `docker compose --profile web up -d --build webapp` → `http://localhost:8080`,
mount `./serving` chỉ đọc. Kết quả xác minh thật nằm ở `docs/evidence/webapp/README.md`.
