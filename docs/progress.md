# Trạng thái triển khai

Đã sửa chuỗi V1–V5 theo yêu cầu cùng bài toán và một job. V4 dense primitive arrays, V5 projection + packed batches thay hoàn toàn salting hai tầng. Source và tài liệu thuật toán cũ đã được xóa; build clean loại classes cũ.

Clean Maven integration verify thành công; Python5 tests thành công. Reviewer độc lập không thấy Critical/Important defect. RecordReductionIT chứng minh oracle và emit reduction600→3→2. Benchmark200k purchase/32categories, cùng2reducers, đã ghi evidence từ20runs (1warmup+3repeats/variant).

Không có dữ liệu Kaggle thật/cụm YARN để suy diễn tốc độ phân tán. Profile preparation được đo riêng và cộng vào CLI + profile scan V4/V5; không hứa ranking strict cho mọi cardinality/workload.

Poll100ms:median V1 1266ms,V3 1051ms,V4 1146ms,V5 851ms; V4 chưa thắng V3 trên workload này. Profile scan1085ms khiến first-use V4/V5 chưa thắng baselineCLI. Xem benchmark-report và evidence; không giấu chênh lệch này.
