# Task triển khai chuỗi tối ưu

| Task | Thành phần | Điều kiện nghiệm thu |
|---|---|---|
| 1. Chốt nghiệp vụ | domain, PurchasePreparation | purchase-only, cùng group và SUM/AVG exact |
| 2. Input immutable | preflight, manifest, bounded reader | checksum/policy trước và sau job; malformed fail |
| 3. Baseline | DirectPurchaseMapper, FinalRevenueReducer | oracle nhiều split/reducer đúng |
| 4. Combiner | SumCountCombiner | merge sum/count associatively; cùng output |
| 5. Gom tại mapper | BoundedAccumulator, InMapperPurchaseMapper | bounded RAM, flush không mất/đếm trùng |
| 6. Dense aggregation | GroupDictionary, DenseAggregationMapper, DensePurchaseMapper | cùng dictionary IDs, unknown group fail, một partial/group/mapper |
| 7. Batch/projection | ProjectedCsvEventParser, AggregateBatchWritable, BatchPurchaseMapper/Partitioner/Reducer | parser parity, ownership id%R, một output/group, một job |
| 8. Wiring/CLI | RunOptions, JobPlanFactory, RevenueTool, DatasetTool | v1..v5 luôn một job, dictionary provenance validated |
| 9. Correctness | VariantsIT, RecordReductionIT, JobFailureIT | oracle exact, empty input, lỗi, nhiều splits;600→3→2 map records |
| 10. Benchmark | benchmark.py, matrix, report | cùng dữ liệu/tài nguyên, warmup+repeats, randomized, CLI + profile scan cost tách scope rõ |
| 11. Vận hành | runbook, structure, archive | không còn salting trong runtime JAR |

Các task đã có implementation. Kiểm chứng LocalJobRunner; kết luận YARN/Kaggle thật cần phép đo trên dữ liệu/cụm đó. Không thêm job/salting để tạo variant phức tạp hơn. V4/V5 tối ưu cho cardinality nhỏ; chi phí chuẩn bị dictionary được báo cáo rõ.
