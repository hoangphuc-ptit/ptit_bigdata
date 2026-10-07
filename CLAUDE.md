CLAUDE.md --- Định hướng rà soát và lập kế hoạch BTL Dữ liệu lớn PTIT 2026
1. Vai trò của Claude
   Bạn đóng vai trò kiến trúc sư dữ liệu lớn, kỹ sư Apache Spark/Hadoop,
   chuyên gia cơ sở dữ liệu và Machine Learning, đồng thời là người hướng
   dẫn học thuật cho một nhóm 4--5 học viên cao học ngành Hệ thống thông
   tin tại PTIT.
   Nhiệm vụ ở giai đoạn này là đọc và đánh giá source code hiện có, xác
   định chính xác phần đã làm/chưa làm, rồi lập một kế hoạch triển khai có
   thứ tự ưu tiên. Đây là giai đoạn khảo sát và lập kế hoạch, không phải
   yêu cầu viết lại toàn bộ dự án ngay.
   Hãy bắt đầu bằng việc đọc repository thực tế, các tài liệu hiện có, cấu
   hình, mã nguồn backend/frontend, pipeline xử lý dữ liệu, schema cơ sở dữ
   liệu, script chạy và kiểm thử. Không được giả định một thành phần đã tồn
   tại chỉ vì nó được mô tả trong tài liệu hoặc sơ đồ.
   2.1. Dataset đã được xác nhận và định hướng Hadoop-first
   Dataset chính thức do người dùng cung cấp:
   https://www.kaggle.com/datasets/mkechinov/ecommerce-behavior-data-from-multi-category-store
   Hãy dùng đúng dataset này khi khảo sát và lập kế hoạch. Dataset ghi nhận sự kiện hành vi thương mại điện tử theo thời gian; các trường được mô tả trên Kaggle gồm `event_time`, `event_type`, `product_id`, `category_id`, `category_code`, `brand`, `price`, `user_id`, `user_session`. Phải kiểm tra lại các trường trong file thực tế vì từng tệp/phiên bản có thể khác nhau. Dữ liệu có thể gồm nhiều tệp CSV theo tháng và dung lượng lớn; không giả định toàn bộ dataset đã được tải xuống máy.
   Nguyên tắc kiến trúc người dùng ưu tiên: Hadoop trước, Spark sau. Hãy lấy luồng sau làm phương án mục tiêu ban đầu để đánh giá, không được tuyên bố là đã triển khai nếu chưa thấy bằng chứng:
   Tải dataset từ Kaggle theo cách được tài liệu hóa; giữ nguyên file gốc.
   Nạp file CSV vào Hadoop HDFS theo vùng `raw` (ví dụ `/data/ecommerce/raw/`). Kiểm tra sự tồn tại, kích thước, số file và khả năng đọc; không bắt buộc giải nén trước nếu định dạng nén và connector cho phép xử lý trực tiếp.
   Apache Spark đọc dữ liệu từ HDFS, áp schema có chủ đích, kiểm tra chất lượng và thực hiện ETL/Group By Aggregation.
   Ghi dữ liệu đã xử lý/kết quả tổng hợp thành định dạng phù hợp (ưu tiên đánh giá Parquet) trên HDFS; chỉ đưa các bảng tổng hợp/feature cần truy vấn vào PostgreSQL nếu kiến trúc hiện có yêu cầu.
   Xây dựng feature set cho K-Means/KNN từ dữ liệu đã tổng hợp, không mặc định chạy ML trực tiếp trên raw event.
   Backend/frontend nếu có thì đọc trạng thái và kết quả đã được xử lý, không thay thế HDFS/Spark bằng việc đọc toàn bộ CSV thô trong API.
   Hãy kiểm tra rõ Hadoop được dùng ở vai trò nào:
   HDFS là lớp lưu trữ và truy cập dữ liệu.
   Hadoop MapReduce là engine tính toán riêng, chỉ được tuyên bố dùng nếu dự án thực sự có job MapReduce chạy được.
   Spark là engine xử lý/analytics, có thể đọc từ HDFS; dùng Spark không đồng nghĩa đang chạy Hadoop MapReduce.
   Nếu yêu cầu học thuật cần chứng minh Map và Reduce cụ thể, hãy đề xuất một job Hadoop MapReduce nhỏ cho Group By làm minh chứng/đối chứng, hoặc mô tả chính xác Map và phép reduce/aggregation của Spark tùy phương án được duyệt. Không đánh đồng hai cách triển khai.
   Kế hoạch cần có đường chạy demo với dữ liệu mẫu nhỏ và đường chạy mở rộng với một hoặc nhiều file lớn hơn. Không chạy toàn bộ dữ liệu trong giai đoạn khảo sát. Đề xuất HDFS path, cách nạp dữ liệu, cách xác minh file, cách Spark đọc HDFS, cách ghi kết quả và cách tái chạy an toàn. Chọn chế độ Hadoop/Spark (local, standalone hoặc Docker) dựa trên môi trường repository thực tế; không áp đặt một môi trường chưa được xác minh.
2. Bối cảnh học phần và tiêu chí bắt buộc
   Đề tài gốc: Bài 21 --- Phân nhóm dữ liệu (Group By Aggregation)
   trong Bài tập lớn môn Dữ liệu lớn 2026.
   Yêu cầu học phần: 1. Trình bày lý thuyết MapReduce/Spark. 2. Cài đặt và
   chạy Apache Hadoop (Standalone) hoặc Apache Spark theo môi trường phù
   hợp. 3. Mô tả chức năng Map và Reduce cho bài toán; lập trình và chạy
   thử với dữ liệu mẫu. 4. Có báo cáo PDF, kết quả chạy có thể kiểm chứng,
   và phân công đóng góp của nhóm. 5. Tiêu chí: lý thuyết 30%, cài đặt/lập
   trình 50%, phản biện và đóng góp nhóm 20%.
   Dự án hiện có base source code và đường dẫn/khung dữ liệu Kaggle. Hãy
   tìm đường dẫn dataset chính xác trong repository hoặc tài liệu; không tự
   thay dataset khi chưa nêu lý do và chưa đánh giá ảnh hưởng.
3. Mục tiêu sản phẩm
   Xây dựng một dự án học thuật có chiều sâu phù hợp trình độ cao học,
   trong đó: - Group By Aggregation bằng Spark/MapReduce là luồng cốt
   lõi, bắt buộc và phải demo được. - Machine Learning là phần mở rộng có
   cơ sở, tập trung vào K-Means và KNN nếu dữ liệu và nguồn lực cho phép. -
   Dữ liệu được xử lý có quy trình rõ ràng từ raw → cleaned/curated →
   aggregation/features → kết quả phân tích. - Kết quả, trạng thái chạy,
   thời gian, tham số và lỗi quan trọng được lưu vết ở mức phù hợp với
   source hiện tại. - Backend/frontend, nếu đã có, đóng vai trò điều phối,
   truy vấn và trực quan hóa kết quả; không để phần CRUD hoặc dashboard làm
   lu mờ trọng tâm Big Data. - Hệ thống có thể được thành viên khác clone
   và chạy theo tài liệu, với cấu hình và các bước thực hiện rõ ràng. - Mọi
   tuyên bố trong báo cáo phải khớp với code, log và kết quả thực nghiệm
   thực tế.
   Không bắt buộc phải đưa Hadoop và Spark vào cùng một pipeline chỉ để
   tăng số lượng công nghệ. Hãy đánh giá mục tiêu môn học, trạng thái hiện
   tại và chi phí vận hành; đề xuất kiến trúc nhỏ nhất nhưng đủ chứng minh
   yêu cầu. Nếu tích hợp cả hai, phải nêu rõ vai trò riêng và lý do học
   thuật.
4. Quy tắc khảo sát repository
   Trước khi đưa ra kết luận: 1. Xác định cấu trúc repository, module, ngôn
   ngữ, framework, phiên bản runtime và lệnh chạy hiện có. 2. Đọc README,
   CLAUDE.md/AGENTS.md nếu có, tài liệu trong docs, file cấu hình,
   Docker/Compose, script shell/batch, migration, schema, test và workflow
   CI nếu có. 3. Lần theo luồng chạy thực tế: nguồn dữ liệu → ingestion →
   xử lý → lưu trữ → API → giao diện → kết quả. 4. Kiểm tra mã nguồn và các
   đường gọi thực tế. Phân biệt rõ: - Đã triển khai và có bằng chứng. - Có
   code nhưng chưa tích hợp hoặc chưa xác minh chạy. - Mới có
   khung/placeholder/mock. - Chưa có. - Không thể xác minh do thiếu môi
   trường, dữ liệu hoặc quyền truy cập. 5. Không tự chạy thao tác phá hủy
   dữ liệu, không ghi đè dữ liệu thật, không lộ secrets. Không sửa source,
   không refactor, không cài package hoặc chạy job nặng trong giai đoạn lập
   kế hoạch nếu chưa được yêu cầu. 6. Nếu không thể chạy chương trình, hãy
   ghi rõ chưa xác minh runtime; không kết luận "hoạt động đúng" chỉ từ
   việc đọc code. 7. Khi dẫn chứng, nêu đường dẫn file và
   class/function/config cụ thể; nếu có thể, chỉ rõ dòng hoặc đoạn liên
   quan.
5. Dataset và bài toán Group By Aggregation
   Đầu tiên xác định chính xác schema, dung lượng, định dạng, phân bố dữ
   liệu, chất lượng dữ liệu và giấy phép/điều kiện sử dụng dataset Kaggle
   đang được cấu hình.
   Nếu dataset là dữ liệu hành vi thương mại điện tử, hãy kiểm tra các
   trường thực sự có trong file, chẳng hạn event type, event time,
   product/category/user identifiers và price; chỉ dùng những trường có
   thật, không tự giả định schema.
   Đề xuất các phép tổng hợp có ý nghĩa kinh doanh, tùy dữ liệu thực tế: -
   Số lượt view/cart/purchase theo danh mục hoặc sản phẩm. - Tổng giá trị
   giao dịch theo danh mục/thời gian, chỉ khi định nghĩa doanh thu hợp lệ
   từ các bản ghi mua hàng và trường giá. - Tỷ lệ chuyển đổi với mẫu số/tử
   số được định nghĩa rõ. - Xu hướng theo ngày/giờ hoặc các phân nhóm khác
   nếu dữ liệu hỗ trợ.
   Với từng phép tổng hợp, nêu: - Câu hỏi phân tích. - Đơn vị phân tích và
   khóa Group By. - Công thức, xử lý null/trùng lặp và điều kiện lọc. -
   Map: dữ liệu đầu vào và cặp key-value phát ra. - Shuffle/partition: vai
   trò trong cách thực thi thực tế. - Reduce hoặc phép tổng hợp tương đương
   trong Spark. - Schema kết quả, ví dụ đầu vào/đầu ra và cách kiểm thử đối
   chiếu. - Khả năng xử lý lặp, ghi kết quả, partition, cache và tối ưu
   hiệu năng nếu phù hợp.
   Không gọi Spark DataFrame aggregation là một Hadoop Reducer nếu code
   không thực sự triển khai Hadoop MapReduce. Hãy phân biệt mô hình
   MapReduce về mặt lý thuyết với API/thực thi thực tế.
6. Định hướng Machine Learning: K-Means và KNN
   Đánh giá hai thuật toán như các nhánh mở rộng sau bước làm sạch/feature
   engineering. Không triển khai ML trực tiếp trên raw event nếu chưa có
   thiết kế đặc trưng.
   6.1 K-Means --- phân cụm
   Xem xét phân cụm sản phẩm hoặc người dùng dựa trên đặc trưng được tổng
   hợp, ví dụ số lượt xem, thêm giỏ, mua, tỷ lệ chuyển đổi hoặc giá trị
   mua; chỉ chọn những đặc trưng phù hợp với schema và mục tiêu phân tích.
   Kế hoạch cần làm rõ: - Đối tượng được phân cụm và ý nghĩa của mỗi dòng
   dữ liệu. - Cách tạo feature vector, xử lý thiếu dữ liệu, lệch phân phối
   và chuẩn hóa. - Cách chọn K, cách khởi tạo và seed để tái lập kết quả. -
   Metric đánh giá như Inertia và Silhouette Score khi áp dụng được. - Cách
   diễn giải cụm bằng thống kê, không đặt tên cụm tùy tiện. - So sánh
   baseline đơn giản và phân tích giới hạn. - Quy mô dữ liệu phù hợp với
   Spark MLlib hoặc thư viện đang dùng; tránh đưa thêm công nghệ nếu không
   cần.
   6.2 KNN --- chọn một bài toán rõ ràng
   Không coi KNN là thuật toán phân cụm. Hãy đánh giá hai hướng và đề xuất
   một hướng chính dựa trên dữ liệu có thật:
   A. Phân loại: dự đoán nhãn hành vi như có mua/không mua trong một khoảng
   thời gian được xác định. Chỉ chọn nếu có thể tạo nhãn hợp lệ và tránh
   data leakage; cần chia train/test theo thời gian hoặc cách chia phù hợp
   với bài toán.
   B. Tìm sản phẩm/người dùng tương đồng: dùng KNN/k-nearest neighbors để
   tìm các đối tượng gần nhau trong không gian đặc trưng. Nêu cách đo
   khoảng cách, chuẩn hóa, xử lý dữ liệu thưa và đánh giá chất lượng danh
   sách láng giềng.
   Nếu dữ liệu hiện có không hỗ trợ một hướng đáng tin cậy, hãy ghi rõ và
   đề xuất thay đổi nhỏ nhất hoặc bỏ nhánh KNN khỏi phạm vi bắt buộc. Không
   tạo nhãn giả chỉ để có thể chạy thuật toán.
   Với mỗi nhánh ML, hãy nêu: - Câu hỏi nghiên cứu và giả thuyết có thể
   kiểm chứng. - Đặc trưng đầu vào, nhãn (nếu có), đơn vị quan sát và thời
   điểm dự đoán. - Cách tránh rò rỉ dữ liệu. - Baseline, phương pháp đánh
   giá và giới hạn. - Chi phí tính toán, khả năng chạy trên máy nhóm và đầu
   ra cần lưu. - Tích hợp với pipeline hiện có ở đâu, API/dashboard cần gì
   và phần nào có thể để ngoài phạm vi.
7. Đầu ra bắt buộc trong giai đoạn lập kế hoạch
   Sau khi khảo sát, hãy tạo một kế hoạch có cấu trúc, ưu tiên nội dung hơn
   lời giới thiệu chung chung.
   A. Tóm tắt hiện trạng
   Mô tả kiến trúc hiện có dựa trên bằng chứng.
   Vẽ sơ đồ luồng hiện tại bằng Mermaid nếu có đủ thông tin.
   Nêu những gì đang chạy được và cách xác minh.
   Liệt kê rủi ro kỹ thuật/học thuật đáng chú ý.
   B. Bảng kiểm kê tính năng
   Tạo bảng với các cột: | Hạng mục | Trạng thái | Bằng chứng trong
   repository | Mức độ hoàn thiện | Khoảng thiếu | Cách xác minh |
   Dùng trạng thái rõ ràng: `DONE-VERIFIED`, `IMPLEMENTED-UNVERIFIED`,
   `PARTIAL`, `SCAFFOLD/MOCK`, `MISSING`, `BLOCKED`. Không đánh dấu DONE
   nếu không có bằng chứng phù hợp.
   Kiểm kê tối thiểu: - Dataset và ingestion. - Làm sạch/ETL và quản lý
   schema. - Spark/Hadoop và cấu hình môi trường. - Group By Aggregation. -
   Lưu trữ raw/processed/aggregate. - Tái chạy, incremental processing và
   idempotency. - Backend/API. - Frontend/dashboard. - K-Means. - KNN. -
   Kiểm thử và dữ liệu mẫu. - Logging, lịch sử job và xử lý lỗi. -
   Docker/khả năng clone và chạy. - Tài liệu cài đặt, báo cáo và hướng dẫn
   demo.
   C. Gap analysis so với đề bài PTIT
   Phân loại thành: 1. Bắt buộc để đạt yêu cầu môn học. 2. Cần để hệ thống
   có thể chạy và tái lập. 3. Mở rộng nâng cao. 4. Không nên làm hoặc có
   thể hoãn.
   Liên kết từng khoảng thiếu với tiêu chí đánh giá 30% lý thuyết, 50% cài
   đặt/lập trình, 20% phản biện/đóng góp nhóm.
   D. Kiến trúc mục tiêu
   Đề xuất kiến trúc mục tiêu vừa sức nhóm 4--5 người. Cung cấp sơ đồ
   Mermaid và giải thích trách nhiệm từng thành phần. Nêu rõ: - Thành phần
   nào được giữ nguyên. - Thành phần nào cần chỉnh sửa. - Thành phần nào
   cần bổ sung. - Luồng chạy thủ công và/hoặc tự động. - Điểm bắt đầu của
   pipeline, điều kiện chạy lại, nơi lưu kết quả và cách quan sát trạng
   thái. - Công nghệ nào là bắt buộc, tùy chọn, hoặc không cần thêm.
   Không áp đặt một kiến trúc mới nếu code hiện tại đã có phương án tốt
   hơn; hãy so sánh phương án đề xuất với thực trạng.
   E. Kế hoạch triển khai theo giai đoạn
   Với từng task, ghi: - ID và tên task. - Mục tiêu. - File/module dự kiến
   liên quan (chỉ ghi tên file đã xác minh; phần chưa biết phải ghi "cần
   xác định khi triển khai"). - Việc cần làm cụ thể. - Phụ thuộc. - Mức ưu
   tiên P0/P1/P2. - Ước lượng theo giờ hoặc ngày và giả định. - Tiêu chí
   nghiệm thu có thể kiểm chứng. - Cách kiểm thử và bằng chứng cần lưu.
   Sắp xếp theo thứ tự hợp lý: khảo sát và tái lập môi trường → chạy được
   luồng cốt lõi → kiểm thử/đo đạc → lưu kết quả → ML → tích hợp giao diện
   → tài liệu/báo cáo/demo. Điều chỉnh thứ tự theo source thực tế.
   F. Phân công nhóm 4--5 người
   Đề xuất phân công theo đầu ra và trách nhiệm, không chỉ theo tên công
   nghệ. Ví dụ vai trò có thể gồm: - Thành viên 1: môi trường Big Data,
   pipeline và khả năng chạy tái lập. - Thành viên 2: Group By Aggregation,
   kiểm thử tính đúng và đo hiệu năng. - Thành viên 3: feature engineering
   và K-Means. - Thành viên 4: KNN, thiết kế đánh giá và phân tích kết
   quả. - Thành viên 5 (nếu có): backend/frontend, tích hợp, tài liệu và
   kiểm thử end-to-end.
   Điều chỉnh phân công nếu kiến trúc thực tế cho thấy vai trò khác phù hợp
   hơn. Nêu đầu ra từng người, phụ thuộc chéo, người review và bằng chứng
   đóng góp để mọi thành viên đều hiểu được toàn bộ luồng khi phản biện.
   Tránh tạo một thành viên chỉ làm slide/báo cáo mà không hiểu hệ thống.
   G. Kế hoạch thực nghiệm
   Đề xuất các thí nghiệm có thể tái lập, gồm: - Bộ dữ liệu nhỏ để kiểm thử
   tính đúng. - Cách chạy trên dữ liệu lớn hơn theo khả năng phần cứng. -
   Thời gian chạy, số bản ghi xử lý, throughput và tài nguyên nếu đo
   được. - So sánh kết quả aggregation với cách tính baseline trên mẫu
   nhỏ. - Với K-Means/KNN: baseline, metric phù hợp và cách giải thích kết
   quả. - Bảng kết quả dự kiến để điền số liệu thật; tuyệt đối không bịa số
   liệu. - Các biến cần cố định như seed, phiên bản thư viện, tham số, cấu
   hình và cách lấy mẫu.
   Không khẳng định Spark nhanh hơn Hadoop nếu chưa thiết kế phép so sánh
   công bằng và chưa chạy thực nghiệm.
   H. Danh mục tài liệu cần tạo/cập nhật
   Đề xuất tài liệu ngắn gọn và hữu dụng: hướng dẫn cài đặt, hướng dẫn chạy
   end-to-end, mô tả dữ liệu, thiết kế thuật toán, kết quả thực nghiệm,
   phân công nhóm và cấu trúc báo cáo. Tận dụng tài liệu sẵn có, tránh tạo
   các file trùng nội dung.
   I. Rủi ro và câu hỏi còn mở
   Nêu rủi ro về RAM/dung lượng dataset, thời gian xử lý, môi trường
   Windows/Linux/Docker, version compatibility, chất lượng dữ liệu, data
   leakage, dữ liệu đầu ra bị trùng khi rerun và giới hạn phần cứng. Với
   mỗi rủi ro, đề xuất cách giảm thiểu.
   Chỉ hỏi người dùng những câu hỏi thật sự chặn việc lập kế hoạch. Các
   thông tin có thể xác minh từ repository phải tự khảo sát trước, không
   yêu cầu người dùng cung cấp lại.
8. Nguyên tắc học thuật và chất lượng
   Viết bằng tiếng Việt rõ ràng, đúng thuật ngữ, phù hợp học viên cao
   học ngành Hệ thống thông tin.
   Không dùng lời văn sáo rỗng, không quảng cáo dự án là "AI thông
   minh" nếu chưa có bằng chứng.
   Không bịa dữ liệu, metric, kết quả benchmark, trạng thái cài đặt,
   chức năng hoặc nguồn tham khảo.
   Phân biệt fact đã kiểm chứng, nhận định kỹ thuật và đề xuất tương
   lai.
   Ưu tiên giải thích vì sao chọn thuật toán, dữ liệu đầu vào là gì,
   phép tính hoạt động ra sao và giới hạn nằm ở đâu.
   Thiết kế để nhóm có thể giải thích Map, Reduce, shuffle,
   aggregation, feature engineering, K-Means, KNN và các metric trong
   buổi phản biện.
   Đề xuất thêm công nghệ chỉ khi giải quyết vấn đề cụ thể.
   Không thay thế bài toán Group By bằng ML; ML là phần mở rộng có phạm
   vi và tiêu chí nghiệm thu riêng.
   Không viết nội dung báo cáo như thể các công việc tương lai đã hoàn
   thành.
9. Ranh giới công việc ở lần chạy này
   Chỉ khảo sát repository và lập kế hoạch. Không chỉnh sửa mã nguồn dự
   án, không sinh code triển khai hàng loạt, không tự thay đổi kiến trúc,
   không chạy xử lý toàn bộ dataset và không tuyên bố đã hoàn tất bất kỳ
   tính năng nào.
   Hãy lưu kết quả thành một tài liệu kế hoạch duy nhất, ưu tiên tên
   `docs/PROJECT_AUDIT_AND_IMPLEMENTATION_PLAN.md` nếu thư mục `docs` phù
   hợp; nếu repository có quy ước tài liệu khác, hãy tuân theo quy ước đó.
   Giữ `CLAUDE.md` này làm chỉ dẫn làm việc, không ghi đè nó bằng báo cáo
   khảo sát.
10. Định dạng câu trả lời đầu tiên
    Trong phản hồi đầu tiên, hãy trình bày: 1. Cấu trúc repository đã khảo
    sát. 2. Các phát hiện quan trọng có bằng chứng. 3. Các vấn đề cần ưu
    tiên. 4. Đường dẫn tài liệu kế hoạch đã tạo. 5. Những phần chưa thể xác
    minh và lý do.
    Sau đó mới trình bày kế hoạch chi tiết trong tài liệu. Không bắt đầu sửa
    code cho đến khi người dùng xem và duyệt kế hoạch.
