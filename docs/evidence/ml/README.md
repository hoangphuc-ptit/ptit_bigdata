# Bằng chứng giai đoạn 4 — K-Means và KNN (notebook Python, Spark MLlib local)

Notebook đã thực thi và **lưu kèm output** (vết toàn bộ tiến trình): `notebooks/kmeans_product.ipynb`, `notebooks/knn_product.ipynb`
(chạy bằng `jupyter nbconvert --to notebook --execute --inplace`, log `*-nbconvert.log`). Ngày 2026-10-06.
Môi trường: PySpark 4.0.4, JDK 21.0.12, Python 3.12.10, `local[2]`, driver 1 GB, HDFS trong Docker.
Đầu vào: đặc trưng A7 do job Java `ProductFeaturesJob` ghi lên HDFS, run `20261006-045824-24861e8-d2`
(D2 = mẫu 10% tháng 10/2019, seed 21; 125 128 sản phẩm, giữ 25 084 sản phẩm có views ≥ 20).

## K-Means sản phẩm — run `20261006-050144-24861e8-d2`

Quy tắc chọn K cố định trước khi chạy: silhouette trung bình (3 seed) cao nhất, bằng nhau thì K nhỏ hơn.

| K | Silhouette (TB 3 seed) | Độ lệch chuẩn | Inertia (TB) | Cụm nhỏ nhất |
|---:|---:|---:|---:|---:|
| 2 | **0.6811** | 0.0009 | 119 778 | 3 691 |
| 3 | 0.4879 | 0.0998 | 100 900 | 1 790 |
| 4 | 0.4587 | 0.0171 | 82 727 | 1 387 |
| 5 | 0.4968 | 0.0003 | 69 638 | 1 059 |
| 6 | 0.4118 | 0.0000 | 59 979 | 944 |
| 7–10 | 0.406–0.419 | — | 55 769 → 43 997 | 469 → 403 |

| So sánh (K = 2) | Silhouette |
|---|---:|
| K-Means (mô hình cuối, seed 1) | **0.6805** |
| Baseline 1: K-Means trên dữ liệu xáo độc lập từng cột | 0.1735 |
| Baseline 2: 2 nhóm theo phân vị giá | 0.1846 |

Hồ sơ cụm (`kmeans-profile.csv`): cụm 1 có 3 729 sản phẩm, views TB 628, cart_rate TB 0.0276, purchase_rate TB 0.0208, 96,1% có purchase;
cụm 0 có 21 355 sản phẩm, views TB 58, cart_rate TB 0.0028, purchase_rate TB 0.0086, 32,2% có purchase. Giá trung vị TB hai cụm gần nhau (228 so với 248).
Diễn giải: hai cụm tách theo **mức độ tương tác/chuyển đổi**, không theo giá hay danh mục. Đây là tương quan, không phải nhân quả.
Hạn chế: K = 2 là phân tách thô; silhouette có xu hướng ưu tiên K nhỏ; `log_views`, `log_distinct_users` tương quan mạnh nên trục "độ phổ biến" chiếm ưu thế;
D2 lấy mẫu theo dòng nên số đếm mỗi sản phẩm bị thu nhỏ khoảng 10 lần.
Suy luận ngoài Spark: `model.json` (thứ tự đặc trưng, mean/std của scaler, tâm cụm) cho kết quả numpy **khớp 100%** dự đoán Spark trên 25 084 sản phẩm.

### E7 — K-Means lặp có/không cache (`e7.csv`)

API RDD `pyspark.mllib` (vì `pyspark.ml.KMeans` tự persist), K = 2, seed 1, 20 vòng lặp cố định (epsilon = 0), 1 warmup + 3 lần đo.

| Chế độ | Fit median (min–max) ms | Thời gian nạp cache (`count`) ms |
|---|---|---|
| Không cache | 4 004 (3 967–5 153) | — |
| `cache()` + `count()` trước | 3 458 (3 417–4 203) | 4 099–4 826 |

Kết luận trong phạm vi đo: cache giảm thời gian fit khoảng 14% (median), nhưng chi phí nạp cache lớn hơn phần tiết kiệm ở 20 vòng lặp với dữ liệu nhỏ
(25 084 dòng × 7 cột, đã nằm trong page cache). Không suy rộng thành "Spark nhanh hơn Hadoop".

## KNN hướng B (sản phẩm tương đồng) — run `20261006-050518-24861e8-d2`

Euclidean trên đặc trưng A7 chuẩn hóa; 1 000 truy vấn (sản phẩm có `category_code`, seed 21); bootstrap 1 000 lần cho khoảng tin cậy 95%.

| Category agreement@k | k = 5 | k = 10 | k = 20 |
|---|---|---|---|
| KNN (mô hình) | 0.0556 [0.0472, 0.0646] | 0.0538 [0.0470, 0.0605] | 0.0530 [0.0467, 0.0597] |
| Baseline ngẫu nhiên | 0.0148 [0.0114, 0.0188] | 0.0129 [0.0108, 0.0152] | 0.0126 [0.0109, 0.0145] |
| Baseline phổ biến (top views) | 0.0760 [0.0600, 0.0940] | 0.0631 [0.0510, 0.0767] | 0.0696 [0.0553, 0.0854] |

**Kết quả âm một phần:** KNN cao hơn ngẫu nhiên khoảng 4 lần nhưng **không vượt** baseline "sản phẩm phổ biến".
Giải thích khả dĩ (chưa kiểm chứng): các sản phẩm phổ biến tập trung ở vài danh mục lớn nên trùng danh mục với nhiều truy vấn;
đặc trưng hành vi tổng hợp (lượt xem, tỷ lệ, giá) mang ít thông tin về danh mục.
Spark `BucketedRandomProjectionLSH` (bucketLength 1.0, 5 bảng băm): recall@10 so với KNN chính xác = 0.998 [0.994, 1.0] trên 50 truy vấn.
