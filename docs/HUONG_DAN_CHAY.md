# Hướng dẫn chạy dự án cho thành viên nhóm

Chọn mức phù hợp với việc bạn cần làm. Mức 1 đủ để xem và demo web; mức 3 mới chạy lại toàn bộ Big Data.

| Mức | Dùng khi | Cần cài | Thời gian |
|---|---|---|---|
| 1. Xem web demo | Xem kết quả, tập demo, chụp hình cho báo cáo | Git, Docker Desktop | ~5 phút lần đầu |
| 2. Sửa web (backend/frontend) | Phát triển giao diện hoặc API | JDK 21, Node 24 | ~10 phút |
| 3. Chạy lại pipeline Big Data | Tái lập kết quả, chạy thực nghiệm | Docker Desktop, JDK 21, Python 3.12, dataset Kaggle | vài giờ |

Repo đã kèm sẵn một serving run đã chốt: `serving/20261007-015257-b0376ef-d3/` (34 MB, dữ liệu cả tháng 10/2019).
Đây là kết quả của pipeline thật (HDFS → MapReduce/Spark → notebook ML → publish), không phải dữ liệu mẫu.
Mọi file trong đó có sha256 ghi trong `manifest.json`; backend kiểm từng file trước khi dùng, file sai sẽ báo lỗi chứ không hiện số.

---

## Mức 1: Xem web demo (chỉ cần Docker)

1. Cài [Docker Desktop](https://www.docker.com/products/docker-desktop/), mở và chờ đến khi Docker báo đang chạy.
2. Clone và chạy:

   ```powershell
   git clone <url-repo> ptit_bigdata
   cd ptit_bigdata
   git checkout feat/nguyennd
   docker compose --profile web up -d --build webapp
   ```

   Lần đầu Docker tải image Node, Maven, JDK và thư viện (cần internet, khoảng 1 GB, 4–6 phút). Những lần sau chỉ vài giây.
3. Mở `http://localhost:8080`. Trang Pipeline phải hiện "567/567 nhóm category_id".
4. Tắt: `docker compose --profile web down`.

Không cần HDFS, Spark hay dataset: web chỉ đọc thư mục `serving/` (mount chỉ đọc vào container).

**Trước khi demo:** mở trang K-Means và KNN một lần, chọn một sản phẩm và bấm dự đoán. Lần gọi đầu backend phải nạp và kiểm
sha256 các file CSV 11–13 MB nên mất 6–9 giây; các lần sau dưới 50 ms.

## Mức 2: Chạy web không qua Docker (để sửa code)

Cần JDK 21 (Spring Boot 3.5) và Node.js 24. Maven có sẵn trong repo ở `.tools/` sau lần chạy `mvnw` đầu tiên; có thể dùng Maven cài trên máy.

```powershell
# Frontend: build ra webapp/frontend/dist
cd webapp\frontend
npm install
npm test             # 7 test Vitest
npm run build

# Backend: build + test (gồm test đối chiếu suy luận Java với Spark/numpy trên serving thật)
cd ..\backend
$env:JAVA_HOME = "<thư mục JDK 21>"
mvn -B clean package
java -jar target\revenue-webapp.jar "--serving.dir=..\..\serving" "--spring.web.resources.static-locations=file:../frontend/dist/"
```

Mở `http://localhost:8080`. Khi sửa giao diện, chạy thêm `npm run dev` trong `webapp/frontend` (Vite ở cổng 5173, tự chuyển `/api` sang 8080).

Tài liệu API và hợp đồng file serving: `webapp/README.md`.

## Mức 3: Chạy lại pipeline Big Data từ đầu

Làm theo `docs/END_TO_END.md` (thứ tự lệnh, thời gian đo trên máy nhóm) và `docs/spark-local.md` (cài Spark local trên Windows). Tóm tắt:

1. Tải dataset Kaggle "eCommerce behavior data from multi category store" (`2019-Oct.csv`, 5,7 GB) vào `data/raw/`; đối chiếu sha256 với `docs/DATASET.md`.
2. HDFS + MapReduce chạy trong Docker: `docker compose build`, `docker compose up -d namenode datanode`, nạp file bằng `scripts/hdfs-ingest.sh`.
3. Spark chạy trên máy (JDK 21, `.venv` có PySpark 4.0.4, `config/spark-local.env` sao từ `.example`): `.\scripts\spark-pipeline.ps1 ...`.
4. Notebook K-Means, KNN; publish; `.\scripts\serving-sync.ps1 -RunId <run> -SetLatest`.

Kết quả sẽ có `run_id` mới. Số liệu tổng hợp và mô hình kỳ vọng giống run đã chốt (phép tính tất định, seed cố định) nhưng chưa
được kiểm chứng trên máy khác; thời gian chạy sẽ khác. Nếu tái lập trên máy bạn, ghi lại kết quả vào `docs/evidence/` (plan §19, mục U4).

Máy RAM 8 GB: không chạy MapReduce, Spark và notebook cùng lúc.

---

## Mở dự án trong IntelliJ IDEA

- Mở thư mục gốc repo. Bấm **Reload All Maven Projects**: profile `spark` tự bật khi IntelliJ dùng JDK ≥ 17, nên các `import org.apache.spark...` hết báo đỏ.
- Đặt Project SDK là **JDK 21**. Spark 4.0 không chạy trên JDK 23 trở lên; code Hadoop MapReduce vẫn biên dịch theo chuẩn Java 11.
- Backend web là project Maven riêng: chuột phải `webapp/backend/pom.xml` → **Add as Maven Project**.

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân và cách xử lý |
|---|---|
| Trang báo "Backend chưa có serving run nào" | Thư mục `serving/` trống hoặc sai đường dẫn. Kiểm tra `serving/_LATEST` và thư mục run có trong repo; với mức 2 kiểm tra tham số `--serving.dir` |
| API báo 503 "Checksum sai cho ..." | File serving bị sửa hoặc bị đổi xuống dòng. Chạy `git checkout -- serving` để lấy lại bản gốc. Không mở và lưu lại các file trong `serving/` |
| `docker compose` báo cổng 8080 đã dùng | Tắt chương trình đang chiếm cổng, hoặc sửa `127.0.0.1:8080:8080` trong `compose.yaml` thành cổng khác |
| Build Docker lỗi tải image/thư viện | Kiểm tra mạng, chạy lại lệnh; lỗi giữa chừng không làm hỏng gì |
| Bấm dự đoán lần đầu lâu | Bình thường (6–9 giây nạp mô hình), xem mục "Trước khi demo" |
| IntelliJ báo đỏ `org.apache.spark` | Reload Maven với Project SDK JDK 17/21 (xem trên) |

## Mỗi thành viên nên tự làm một lần

Theo plan §11.3: tự chạy mức 1 và đi hết kịch bản demo trong `docs/END_TO_END.md` §3; người phụ trách MapReduce/Spark chạy được
ít nhất mẫu D1 ở mức 3. Ghi chú lại lỗi gặp phải để bổ sung vào bảng trên.
