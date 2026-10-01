# Cấu trúc và function từng file

Một Maven module; package vn.edu.bigdata.revenue. Source active dưới src; các thuật toán salting cũ đã được xóa.

```text
bigdata/
  src/main/java/vn/edu/bigdata/revenue/
    cli/
      CliArguments.java
      DatasetTool.java
      RevenueTool.java
    domain/
      AggregateState.java
      GroupKeyResolver.java
      GroupMode.java
      Money.java
      Purchase.java
    hadoop/io/
      AggregateBatchWritable.java
      SumCountWritable.java
    hadoop/shared/
      BoundedAccumulator.java
      DenseAggregationMapper.java
      FinalRevenueReducer.java
      MapperSupport.java
      RevenueCounters.java
    hadoop/v1/
      DirectPurchaseMapper.java
    hadoop/v2/
      SumCountCombiner.java
    hadoop/v3/
      InMapperPurchaseMapper.java
    hadoop/v4/
      DensePurchaseMapper.java
    hadoop/v5/
      BatchPartitioner.java
      BatchPurchaseMapper.java
      BatchRevenueReducer.java
    input/
      BoundedLineReader.java
      CsvEventParser.java
      DatasetPreflight.java
      EventParser.java
      InputManifest.java
      JsonArtifacts.java
      ParseResult.java
      ParsedEvent.java
      PreflightReport.java
      PreparationResult.java
      ProjectedCsvEventParser.java
      PurchasePreparation.java
      SamplingHash.java
    job/
      JobExecutor.java
      JobPlan.java
      JobPlanFactory.java
      RunOptions.java
      Variant.java
    metrics/
      MetricsCollector.java
      RunManifest.java
    output/
      CsvExporter.java
      OutputRow.java
      ResultValidator.java
      RevenueFormatter.java
      ValidationReport.java
    profile/
      DatasetProfiler.java
      GroupDictionary.java
      ProfileReport.java
  src/test/java/ (unit và integration)
  scripts/ (CLI wrappers, workload, benchmark, Python tests)
  config/ (local, cluster, benchmark matrix)
  docs/ (design, plan, runbook, evidence)
  data/ và results/ (input/output artifacts, gitignored)
```

## File mới và tối ưu

| File | Function và trách nhiệm |
|---|---|
| input/EventParser.java | parse(String): ParseResult; seam dùng chung reference/projection parser |
| input/ProjectedCsvEventParser.java | parse: scan field cần thiết; fallback Commons CSV khi quote/BOM/CR; cùng semantic với reference |
| profile/GroupDictionary.java | from(profile), computedChecksum(), validate(fingerprint,mode), index(); sorted group IDs, provenance/checksum, cardinality guard |
| hadoop/shared/DenseAggregationMapper.java | setup: load dictionary+arrays; map: prepare purchase, checked add; parser() cho V5 thay parser |
| hadoop/v4/DensePurchaseMapper.java | cleanup: emit mỗi group có count>0 đúng một partial sum/count |
| hadoop/io/AggregateBatchWritable.java | write/readFields: packed id/sum/count arrays; ctor defensive copy; size/id/sum/count accessors; reject invalid payload |
| hadoop/v5/BatchPurchaseMapper.java | parser: projection; cleanup: gom arrays theo id%R, một batch/reducer có dữ liệu |
| hadoop/v5/BatchPartitioner.java | getPartition: identity partition key, reject outside reducer range |
| hadoop/v5/BatchRevenueReducer.java | setup: dictionary+arrays; reduce: validate ownership, checked merge; cleanup: output owned categories với shared formatter |
| job/JobPlanFactory.java | build(Configuration,RunOptions): luôn đúng một Job; chọn mapper/value/partitioner/reducer cho variant |
| job/RunOptions.java | validate: CLI config, fresh manifest/preflight/output; bắt buộc dictionary V4/V5 |
| job/Variant.java | parse v1..v5 thành DIRECT, COMBINER, IN_MAPPER, DENSE, BATCH |
| cli/DatasetTool.java | profile tạo profile report và --dictionary; preflight/sample/export/compare giữ contract |
| cli/RevenueTool.java | run: validate artifacts → build/execution → validate input/output → run manifest, exit status |
| metrics/RunManifest.java | schema2; one stage/job, counters, timestamps, config/provenance, validation status |
| input/SamplingHash.java | bucket(path,offset,seed,buckets): hash deterministic phục vụ lấy mẫu dữ liệu |

## Domain/input/output và file vận hành

Các API dưới đây giữ nghiệp vụ độc lập với Hadoop.

| File | Trách nhiệm và API |
|---|---|
| `Purchase.java` | Immutable value chứa `categoryId:String`, `categoryCode:String` nullable, `priceMinor:long`. Không giữ user/session vì không dùng để group. Constructor kiểm tra tiền ≥ 0. |
| `AggregateState.java` | Immutable `(sumMinor:long,purchaseCount:long)`. `empty(): AggregateState`, `single(long): AggregateState`, `merge(AggregateState): AggregateState`. Dùng cộng có kiểm tra overflow; không format tiền hoặc chia trung bình. |
| `Money.java` | `parseMinor(String): long`, `formatMinor(long): String`, `average(long sumMinor,long count): String`. Exact conversion, scale 2; average HALF_UP; count 0 bị từ chối. |
| `GroupMode.java` | Enum `CATEGORY_ID`, `CATEGORY_CODE`, `CATEGORY_ROOT`; parse tên CLI, không có `BRANCH` khi chưa có input hỗ trợ. |
| `GroupKeyResolver.java` | `resolve(Purchase,GroupMode): String`. ID thiếu bị từ chối; code/root thiếu trả `__UNKNOWN__`; không biến brand thành branch. |
| `ParsedEvent.java` | Immutable raw fields cần dùng: `eventType`, `categoryId`, `categoryCode`, `priceText`. Giữ price dạng text để chỉ parse tiền trên purchase. |
| `ParseResult.java` | Tagged result `HEADER`, `EVENT`, `MALFORMED`; fields `kind`, `event` và factory methods `header/malformed/event`. Không ném lỗi định dạng của từng dòng ra mapper. |
| `CsvEventParser.java` | `parse(String line): ParseResult`; kiểm tra 9 cột, quoting, header/BOM; nhận header đúng ở bất kỳ split nào. Không filter purchase hoặc cập nhật Hadoop counter. |
| `PreparationResult.java` | Tagged result với reason `VALID_PURCHASE`, `NON_PURCHASE`, `UNKNOWN_EVENT`, `INVALID_PRICE`, `INVALID_GROUP`, `HEADER`, `MALFORMED_CSV`; payload thành công là key và state; cờ `missingCategoryCode`. |
| `PurchasePreparation.java` | `prepare(ParseResult,GroupMode): PreparationResult`; một pipeline chung cho profiler và mọi mapper. Event → tiền → group đúng thứ tự ở design; không phụ thuộc Hadoop. |
| `InputManifest.java` | Danh sách file URI chuẩn hóa, byte size, SHA-256, schema/policy version và fingerprint toàn input; `fingerprint(): String`; JSON qua `JsonArtifacts.read/write`. Từ chối file URI lặp. SHA-256 đọc stream. |
| `PreflightReport.java` | Artifact metadata: manifest, fingerprint, group mode, validPurchaseCount, lines, errors, elapsedMillis; `isValid(): boolean`. |
| `DatasetPreflight.java` | `inspect(List<Path>,FileSystem,GroupMode): PreflightReport`; đọc stream từng file, xác minh header đầu file, full structural validation và giới hạn line/key; nhận cả local FS và HDFS. Không aggregate output cuối. |
| `ProfileReport.java` | Counters nghiệp vụ, count theo group (cardinality lấy từ map.size), input fingerprint, policy hash, thời gian quét; JSON round-trip qua JsonArtifacts. |
| `DatasetProfiler.java` | `profile(List<Path>,FileSystem,GroupMode,int maxProfileKeys): ProfileReport`. Dùng parser/preparation chung, giữ count theo key; fail nếu vượt guard. Không ghi user/session. |
| `SumCountWritable.java` | `Writable` của hai long; no-arg constructor, `set(long,long)`, `toState()`, `write(DataOutput)`, `readFields(DataInput)`. Không giữ alias domain hoặc buffer khác. |
| `RevenueCounters.java` | Enum các counters trong design, bổ sung `CACHE_FLUSHES`, `CACHE_PEAK_KEYS`. Peak keys dùng max cục bộ để debug; Hadoop counter cộng các peak không được diễn giải là max cluster. |
| `MapperSupport.java` | `prepare(Text,Mapper.Context,GroupMode): PreparationResult`; adapter gọi domain pipeline và tăng counters. Không emit thay từng mapper. |
| `BoundedAccumulator.java` | Generic `BoundedAccumulator<K>`; `add(K,AggregateState,Emitter<K>)`, `flush(Emitter<K>)`, `size(): int`; merge immutable state; flush trước khi thêm key mới vượt B. Nested `Emitter<K>.emit(K,AggregateState)` cho checked exceptions; key K phải immutable. |
| `FinalRevenueReducer.java` | `Reducer<Text,SumCountWritable,Text,Text>`; reduce merge streaming, key → formatted value gồm total/count/avg; không dùng như combiner. |
| `v1/DirectPurchaseMapper.java` | `Mapper<LongWritable,Text,Text,SumCountWritable>`; map mỗi purchase thành một pair; counter dùng MapperSupport. V2 dùng lại mapper này. |
| `v3/InMapperPurchaseMapper.java` | Cùng kiểu mapper V1; setup cache bounded String keys; map merge; cleanup flush. Không phụ thuộc job factory. |
| `OutputRow.java` | Immutable `groupKey,sumMinor,purchaseCount,averageText`; `parseTsv(String): OutputRow`. Từ chối duplicate key ở validator, không ở parser một dòng. |
| `RevenueFormatter.java` | `value(AggregateState): String` → `total\tcount\taverage`; sử dụng Money. Không trả header. |
| `ValidationReport.java` | Report valid/errors, group count, total count, total sum; lỗi cụ thể, không chỉ boolean. |
| `ResultValidator.java` | `validate(Path,FileSystem,long expectedPurchaseCount): ValidationReport`; đọc `part-r-*`, kiểm tra key unique, tiền/count/AVG và tổng count. `compare(Path,Path,FileSystem): ValidationReport` so state chính xác; đọc output vào memory với guard vì K nhỏ, fail rõ nếu quá giới hạn. |
| `CsvExporter.java` | `export(Path parts,Path csv,FileSystem): void`; header CSV, escape và sort key, kiểm tra output mới; nằm ngoài job timing. |
| `MetricsCollector.java` | `collect(Job): Map<String,Long>` counters có qualified names; stage label riêng. Chưa tự lấy reducer p50/p95 từ JobHistory; giữ job IDs để phân tích bổ sung, không tạo số 0 giả. |
| `RevenueTool.java` | Hadoop `Tool`/`Configured`; `run(String[]): int`, `main(String[])`. Parse CLI → options → preflight artifact check → plan → execute → validate → write manifest. Exit 0 success-valid, 2 invalid CLI/input/artifact, 1 job hoặc validation failure. |
| `pom.xml` | Compile Java 11; Hadoop dependencies `provided`; CSV/JSON/CLI runtime đóng gói trong JAR; Surefire unit, Failsafe integration profile; formatter và compiler warnings. Không shade Hadoop classes. |
| `.gitignore` | Bỏ IDE metadata, target, raw/sample dữ liệu, results, credentials. Giữ fixture nhỏ và docs trong git. |
| `.editorconfig` | UTF-8, LF, newline cuối file, indent nhất quán. |
| `config/cluster.properties` | Template endpoint/memory/split/compression cho cụm môn học; không chứa token hoặc password. |
| `prepare-input.sh` | Kiểm tra file người dùng tải từ Kaggle, gọi preflight; profile là lệnh riêng. Chỉ prepare metadata local; upload HDFS theo runbook. Không hard-code credentials, không tự tải nhiều GB. |
| `run-local.sh`, `run-cluster.sh` | Wrapper quote args đúng, fail fast, gọi cùng JAR/CLI; không reimplement thuật toán. |
| `benchmark.py` | `run_case(case)->run_metadata`, `validate_runs(paths)->None`, `summarize(paths)->CSV`; orchestration subprocess và median; không dùng pandas groupby thay Hadoop. Python stdlib đủ. |
| `docs/runbook.md` | Setup cụm đã chọn, build JAR, chuẩn bị input, lệnh V1–V5, xem counters, lỗi thường gặp, cleanup thủ công đúng run path. |
| `docs/benchmark-report.md` | Hardware, manifest, protocol, bảng tốc độ/shuffle, kết quả correctness và giới hạn kết luận; không ghi số giả. |
| Unit test files | Đúng responsibility theo tên class; assert hành vi từ design, không chỉ mirror implementation. |
| `fixtures/*` | Dữ liệu nhỏ tổng hợp và expected outputs review được bằng tay; không có user/session thật. |
| `mvnw` | Chọn JDK project/override, tải Maven khi cần, dùng cache dependency trong workspace. |
| `input/BoundedLineReader.java` | Full scan bounded UTF-8, byte offsets và SHA-256; không đọc nguyên file vào RAM. `scan(Path,FileSystem,Visitor): InputManifest.Entry`. |
| `input/JsonArtifacts.java` | JSON read với giới hạn 32 MiB; atomic create-only write qua temp/rename. API generic `read(path,fs,type)`, `write(path,fs,value)`. |
| `cli/CliArguments.java` | Parser flags value strict, reject unknown/duplicate/missing value; generic Hadoop flags do ToolRunner xử lý. |
| `ResultValidator.validateInput(...)` | Kiểm tra checksum/byte-size sau job trước khi mark valid, phát hiện đổi price dù count không đổi. |
| `scripts/java-env.sh` | Chọn Java cho process local, không thay Java hệ thống. |
| `scripts/demo.sh` | Preflight/profile, chạy và so cả 5 variants, export fixture, output mới. |
| `scripts/generate_workload.py` | Sinh CSV có nhãn synthetic theo mode uniform/skew/cardinality, seed cố định. |
| `scripts/test_benchmark.py` / `test_workload.py` | Kiểm chứng summary/profile provenance và tính deterministic của workload. |
| `integration/DatasetToolIT.java` | Kiểm chứng preflight/sampling CLI và giữ header/non-purchase. |
| `src/main/resources/log4j.properties` | Log WARN ra stderr, tránh log hàng triệu dòng sự kiện. |

## Task kiểm chứng

| File | Hành vi cần chứng minh |
|---|---|
| ProjectedCsvEventParserTest | fast path/fallback parity và malformed/header semantics |
| GroupDictionaryTest | sorted IDs và reject stale/duplicate dictionary |
| JobPlanFactoryTest | cả năm một job, missing dictionary fail |
| WritableContractTest | state/batch serialization, identity partition và alias safety |
| VariantsIT | oracle exact cho cả variants, multisplits/reducers, empty input |
| RecordReductionIT |600 purchase/3group: V1/V2=600,V3/V4=3,V5=2 map records; cùng oracle |
| JobFailureIT | invalid artifact/output/input không được mark valid |
| DatasetToolIT | preflight và deterministic sampling |
| scripts/test_benchmark.py | summary/provenance/profile cost |
| scripts/test_workload.py | generator deterministic và distribution |

## Dependency

domain ← input/output ← Hadoop adapters; profile xây dictionary từ input; JobPlanFactory wiring; CLI orchestration; scripts gọi CLI. Domain không import Hadoop. V1–V5 giữ nguyên group policy, money và formatter.
