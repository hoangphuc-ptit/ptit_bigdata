# Bài 21 — Group By Aggregation bằng MapReduce

Project Java **đã triển khai** tổng/trung bình giá trị mua hàng theo danh mục với 5 phương án Hadoop MapReduce: trực tiếp, combiner, bounded in-mapper aggregation, dense aggregation bằng mảng primitive và packed batch theo reducer.

> **Thành viên mới bắt đầu ở [`docs/HUONG_DAN_CHAY.md`](docs/HUONG_DAN_CHAY.md).** Repo kèm sẵn serving run đã chốt
> (`serving/20261007-015257-b0376ef-d3/`, cả tháng 10/2019): chỉ cần Docker là xem được web demo
> (`docker compose --profile web up -d --build webapp` → `http://localhost:8080`). Chạy lại toàn bộ HDFS → MapReduce/Spark → ML:
> [`docs/END_TO_END.md`](docs/END_TO_END.md). Kiến trúc hiện tại và trạng thái: `docs/PROJECT_AUDIT_AND_IMPLEMENTATION_PLAN.md`.

## Chạy nhanh

Yêu cầu JDK 11 và Python ≥3.9 cho benchmark. Maven wrapper tải Maven 3.9.11 nếu chưa có. Workspace hiện tại đã có JDK/Maven dưới `.tools/`; máy khác cần `JAVA_HOME` cho JDK 11.

```bash
./mvnw -Pintegration verify
python3 -m unittest discover -s scripts -p 'test_*.py'
./scripts/demo.sh results/my-demo
```

Demo chạy preflight/profile, đủ V1–V5, so sánh và export CSV. Output phải là thư mục mới; bỏ đối số dùng `results/optimization-demo`. JAR ở `target/revenue-aggregation.jar`.

Đọc [runbook](docs/runbook.md) để chạy trên CSV thật/HDFS và [báo cáo kiểm chứng](docs/benchmark-report.md) để xem evidence/giới hạn.

## Chạy bằng Docker

```bash
mkdir -p data/raw data/samples results
docker compose build
docker compose run --rm bigdata
```

Xem [hướng dẫn Docker](docs/docker.md) để chạy test, CSV thật và benchmark.

## Đọc theo thứ tự

- [Chi tiết từng thuật toán và độ phức tạp](docs/algorithms.md): pseudocode, map/reduce, RAM, shuffle và điều kiện có lợi.

1. [Thiết kế và thuật toán](docs/design.md): phạm vi, hợp đồng dữ liệu, 5 phương án MapReduce, phân tích chi phí, benchmark.
2. [Cấu trúc và trách nhiệm từng file](docs/project-structure.md): cây project dự kiến, lớp, hàm và quan hệ phụ thuộc.
3. [Kế hoạch triển khai](docs/implementation-plan.md): task theo thứ tự, đầu vào, đầu ra và điều kiện nghiệm thu.

## Quyết định chính

- Hadoop MapReduce Java API 3.4.2; Java 11; Maven 3.9.11; Commons CSV 1.14.1; JUnit 5.12.2. Cụm dùng bản khác cần build lại với `-Dhadoop.version=...` và kiểm thử trên cụm đó.
- Chỉ cộng `price` của `event_type=purchase`; mặc định group theo `category_id`.
- Dataset không có chi nhánh, số lượng sản phẩm hay mã đơn hàng. Kết quả là giá trị ghi nhận từ các sự kiện mua hàng, với giả định một dòng tương ứng một đơn vị mua.
- Cả SUM và AVG dùng trạng thái `(sum_minor, purchase_count)`; chỉ chia và làm tròn ở đầu ra.
- Cùng một bài toán và một job cho cả 5 variant; tối ưu dần số emit, shuffle/sort và allocation. Không thể giảm chi phí đọc dữ liệu dưới Ω(N); tốc độ thực tế được đo với cùng cấu hình.
- Có formatter tự động, Java version gate, unit/integration tests. Hadoop dependencies là `provided`; runtime CSV/JSON được relocate để tránh xung đột trên cụm.
- Cây tài liệu đã cập nhật theo source code; template Python của IDE đã được loại bỏ.
- Đã kiểm chứng Hadoop LocalJobRunner trên fixture tổng hợp; chưa có dataset Kaggle thật/cụm YARN trong workspace nên chưa có kết luận hiệu năng phân tán.

## Nguồn

[Dataset Kaggle](https://www.kaggle.com/datasets/mkechinov/ecommerce-behavior-data-from-multi-category-store), [REES46](https://rees46.com), [Apache MapReduce Tutorial](https://hadoop.apache.org/docs/stable/hadoop-mapreduce-client/hadoop-mapreduce-client-core/MapReduceTutorial.html).
