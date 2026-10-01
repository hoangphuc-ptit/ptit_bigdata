# Sửa chuỗi tối ưu cho cùng một bài toán

Yêu cầu: cùng CSV, cùng filter purchase, cùng group, cùng SUM/AVG, cùng số reducer và **một job** cho mọi variant. Tối ưu bằng giảm records/allocations/sort; không thêm salting/job thứ hai.

| Variant | Thay đổi so với baseline |
|---|---|
| V1 | Emit mỗi purchase; Hadoop sort/group rồi reducer cộng |
| V2 | V1 + combiner sum/count |
| V3 | Bounded HashMap trong mapper: giảm emit trước framework sort |
| V4 | Dictionary group→int + primitive arrays: một partial mỗi group/mapper, bỏ flush và allocation khi merge |
| V5 | V4 + CSV projection fast path + packed batch theo reducer: tối đa R map records/mapper, reducer cộng các entry theo ID |

N tổng events, P purchases, K groups, M mapper, R reducer. K bị guard 100000 ở V4/V5; input group chưa có trong dictionary làm job fail, không tự bỏ dòng. Dictionary được tạo một lần từ profile và có fingerprint/policy/group mode/checksum; chi phí chuẩn bị phải công bố riêng và cộng profile scan vào thời gian CLI khi so single-use; chưa gồm JVM startup/serialization artifact.

V1 worst model O(N+P log P). V2 cùng worst case nhưng giảm shuffle thực tế. V3 expected O(N+E3 log E3), E3≤P; không flush thì E3≤MK. V4 expected O(N+MK+(MK)log(MK)), bộ nhớ O(K)/mapper. V5 expected O(N+M(K+R)+RK+Q log Q), Q≤M min(R,K), bộ nhớ O(K+R)/mapper và O(K)/reducer; map output record≤MR nhưng vẫn mang≤MK aggregate entries. Không gọi payload bytes là O(MR): dữ liệu aggregate vẫn O(MK). Hadoop vẫn sort/merge batch keys; upper bound comparison model O(MR log(MR)). Cận dưới đọc input Ω(N); hash/dictionary tăng tốc kỳ vọng, không cam kết ranking mọi workload.

V4/V5 phù hợp K nhỏ hơn nhiều so với số purchase mỗi split. Khi K vượt guard, chọn V3 bounded. Nếu R lớn hơn K, nhiều reducer không có việc; không tăng R riêng cho một variant để tạo speedup giả. V5 key là partition ID, dùng partitioner identity; reducer chỉ nhận một batch key và phát nhiều group rows. Dictionary ID quyết định ownership `id % R`, do đó một group chỉ được một reducer phát.

Parser projected chỉ dùng fast path cho dòng không quote/BOM/CR; các trường hợp khác dùng Commons CSV. V1–V5 dùng cùng PurchasePreparation và counters. Overflow/count/rounding/output không thay đổi.
