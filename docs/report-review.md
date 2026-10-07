# Review báo cáo BTL Group By Aggregation bằng Hadoop MapReduce

## 1. Phạm vi và cách đánh giá

Tiêu chí phù hợp không phải là báo cáo phải nhắc lại toàn bộ kiến thức trong slide. Báo cáo cần cho thấy nhóm:

1. Hiểu các thuộc tính cốt lõi của MapReduce và Hadoop có liên quan trực tiếp đến bài toán.
2. Xác định được các điều kiện mà lời giải Group By Aggregation phải đáp ứng.
3. Cung cấp bằng chứng có thể kiểm tra cho từng thuộc tính.

Có thể xem đây là các **proof obligations** tương tự việc chứng minh một thiết kế cơ sở dữ liệu đạt 1NF, 2NF, 3NF và BCNF.

## 2. Kết luận tổng quát

Báo cáo hiện tại **chứng minh khá tốt tính đúng của phép Group By Aggregation và hiệu quả giảm dữ liệu trung gian**, nhưng **chưa chứng minh đầy đủ bài tập thực sự được cài đặt và chạy thành công trên Hadoop Standalone**. Báo cáo cũng chưa chứng minh rõ khả năng xử lý phân tán hoặc mở rộng, bởi benchmark chính chỉ chạy bằng LocalJobRunner với một mapper.

Tóm tắt:

- **Phần thuật toán và tối ưu:** tốt.
- **Phần bằng chứng cài đặt và demo:** thiếu nghiêm trọng.
- **Phần chứng minh đây thực sự là bài toán MapReduce:** có nền tảng tốt nhưng thiếu execution trace trực quan.
- **Phần chứng minh khả năng phân tán và scalability:** chưa đủ.
- **Không cần bổ sung toàn bộ kiến thức Spark, K-means, 4V...** nếu chúng không phục vụ trực tiếp cho việc giải thích hoặc chứng minh bài làm.

## 3. Ma trận thuộc tính cần chứng minh

### 3.1. Bài toán có đúng với đề tài Group By Aggregation không?

#### Yêu cầu cần chứng minh

Với mỗi nhóm `g`, chương trình phải tính:

\[
SUM(g)=\sum_{r \in R_g} price(r)
\]

\[
COUNT(g)=|R_g|
\]

\[
AVG(g)=\frac{SUM(g)}{COUNT(g)}
\]

Trong đó chỉ các bản ghi hợp lệ và có `event_type=purchase` được đưa vào tập `R_g`.

#### Đánh giá: Đạt tốt

Báo cáo đã:

- Xác định rõ khóa nhóm là `category_id`, `category_code` hoặc `category_root`.
- Chỉ nhận sự kiện `purchase`.
- Biểu diễn tiền bằng số nguyên đơn vị nhỏ nhất để tránh sai số dấu phẩy động.
- Tính trạng thái trung gian `(sum, count)`.
- Chỉ tính trung bình sau khi có tổng và số lượng cuối cùng.
- Dùng `Math.addExact` để phát hiện overflow.
- Có oracle cụ thể:
  - Nhóm 1: `60.00 / 3 / 20.00`.
  - Nhóm 2: `0.03 / 3 / 0.01`.
- Có kiểm tra V1–V5 cho kết quả giống nhau.

Đây là một trong những phần thuyết phục nhất của báo cáo.

#### Nên bổ sung

Thêm một bảng đầu vào–đầu ra nhỏ, chẳng hạn:

| category_id | event_type | price |
|---|---|---:|
| 1 | purchase | 10.00 |
| 1 | view | 20.00 |
| 1 | purchase | 30.00 |
| 2 | purchase | 5.00 |

Kết quả:

| category_id | sum | count | average |
|---|---:|---:|---:|
| 1 | 40.00 | 2 | 20.00 |
| 2 | 5.00 | 1 | 5.00 |

Bảng này giúp người chấm kiểm tra ngay cách hiểu nghiệp vụ.

### 3.2. Phép tính có phân rã được theo mô hình MapReduce không?

Đây là thuộc tính quan trọng nhất về mặt lý thuyết.

#### Yêu cầu cần chứng minh

Trạng thái tổng hợp phải có thể được tính trên từng phân vùng rồi hợp nhất:

\[
merge((s_1,c_1),(s_2,c_2))=(s_1+s_2,c_1+c_2)
\]

Cần có:

- Tính kết hợp:

\[
merge(merge(a,b),c)=merge(a,merge(b,c))
\]

- Phần tử đơn vị:

\[
merge((s,c),(0,0))=(s,c)
\]

- Không phụ thuộc thứ tự xử lý.
- Không được tính “trung bình của các trung bình” nếu các nhóm con có kích thước khác nhau.

#### Đánh giá: Đạt rất tốt

Báo cáo đã dùng đúng trạng thái `(sum, count)`, giải thích tính kết hợp, phần tử đơn vị và lý do AVG chỉ được tính ở cuối. Ví dụ hai partial `(10000,100)` và `(3000,10)` phải cho kết quả `13000/110`, không phải trung bình không trọng số của hai average.

Phần này thể hiện nhóm thực sự hiểu MapReduce, không chỉ biết viết Mapper và Reducer.

#### Nên cải thiện cách trình bày

Đưa nội dung này thành một mục nổi bật với tên:

> **Các điều kiện để Group By Aggregation có thể thực hiện đúng bằng MapReduce**

Sau đó liệt kê ba điều kiện:

1. Mỗi purchase được ghi nhận đúng một lần.
2. Mọi partial cùng khóa được đưa về cùng reducer.
3. Phép merge `(sum, count)` có tính kết hợp và phần tử đơn vị.

Cách này gần với việc chứng minh các dạng chuẩn trong báo cáo cơ sở dữ liệu.

### 3.3. Mapper và Reducer có thực hiện đúng hợp đồng không?

#### Yêu cầu cần chứng minh

Mapper:

\[
Map(offset,line)\rightarrow(group,(price,1))
\]

Reducer:

\[
Reduce(group,\{(s_i,c_i)\})\rightarrow(group,\sum s_i,\sum c_i,\frac{\sum s_i}{\sum c_i})
\]

#### Đánh giá: Đạt về mô tả, thiếu bằng chứng trực quan

Báo cáo có pseudocode Map và Reduce tốt. Tuy nhiên chưa cho thấy một lần chạy cụ thể từ input qua các pha.

#### Cần bổ sung execution trace

Ví dụ:

```text
Input:
purchase, category=A, price=10
purchase, category=B, price=5
purchase, category=A, price=20
```

Mapper:

```text
(A, (10,1))
(B, (5,1))
(A, (20,1))
```

Shuffle/Sort:

```text
A -> [(10,1), (20,1)]
B -> [(5,1)]
```

Reducer:

```text
A -> (30,2,15)
B -> (5,1,5)
```

Đây là bằng chứng quan trọng vì nó kết nối dữ liệu đầu vào, hàm Map, shuffle/sort, hàm Reduce và kết quả cuối. Báo cáo hiện mới mô tả các thành phần riêng lẻ, chưa chạy xuyên suốt một ví dụ.

### 3.4. Tất cả giá trị cùng khóa có đến cùng reducer không?

#### Yêu cầu cần chứng minh

Partitioner phải thỏa:

\[
key_1=key_2 \Rightarrow partition(key_1)=partition(key_2)
\]

Nếu dùng HashPartitioner:

\[
partition(key)=hash(key)\bmod R
\]

#### Đánh giá: Đạt một phần

Báo cáo nói tất cả partial cùng group phải tới cùng reducer và mô tả V5 có `BatchPartitioner` kiểm tra ownership. Tuy nhiên:

- Chưa mô tả rõ partitioner mặc định của V1–V4.
- Chưa có ví dụ nhiều reducer.
- Chưa có output hoặc log cho thấy cùng một khóa không xuất hiện ở hai reducer.

#### Nên bổ sung

- Một câu giải thích V1–V4 dùng HashPartitioner.
- Một test với hai hoặc ba reducer.
- Validator kiểm tra không có khóa trùng giữa các file `part-r-*`.
- Một bảng bằng chứng:

| Thuộc tính kiểm tra | Bằng chứng |
|---|---|
| Cùng khóa về cùng reducer | `ResultValidator` từ chối khóa xuất hiện trong nhiều part file |
| Số reducer | `2` |
| Số part file | `part-r-00000`, `part-r-00001` |
| Khóa trùng giữa part files | `0` |

### 3.5. Combiner có an toàn không?

Combiner không được coi là bước bắt buộc vì Hadoop có thể chạy nó không lần nào, một lần hoặc nhiều lần.

#### Yêu cầu cần chứng minh

Kết quả phải giống nhau trong cả ba trường hợp:

- Không chạy combiner.
- Chạy combiner một lần.
- Chạy combiner nhiều lần.

Điều này yêu cầu hàm gộp có tính kết hợp và không phụ thuộc thứ tự.

#### Đánh giá: Đạt tốt về lý thuyết

Báo cáo đã giải thích chính xác:

- Combiner không được đảm bảo chạy.
- `(sum, count)` an toàn để merge nhiều lần.
- Không tính average trong combiner.

#### Thiếu bằng chứng kiểm thử trực tiếp

Nên có một bảng đối chiếu:

| Phương án | Sum | Count | Average |
|---|---:|---:|---:|
| Không combiner | 130.00 | 110 | 1.18 |
| Có combiner | 130.00 | 110 | 1.18 |

V1 và V2 hiện có thể đóng vai trò bằng chứng này. Báo cáo cần nói rõ:

> V1 không dùng combiner và V2 có dùng combiner; kết quả V1 = V2 chứng minh việc thêm combiner không làm thay đổi semantics.

### 3.6. Tối ưu có thực sự giảm dữ liệu trung gian không?

Đây là metric được chứng minh tốt nhất trong báo cáo.

#### Yêu cầu cần đo

Các metric phù hợp gồm:

- `MAP_OUTPUT_RECORDS`.
- `REDUCE_INPUT_RECORDS`.
- Shuffle bytes.
- Thời gian job.
- Số batch hoặc số partial.
- Nếu có: spilled records, materialized bytes, GC time.

#### Đánh giá: Đạt tốt

Báo cáo có số liệu rõ ràng:

| Variant | Map output | Reduce input | Shuffle byte | Job time |
|---|---:|---:|---:|---:|
| V1 | 200.000 | 200.000 | 4.137.536 | 1266 ms |
| V2 | 200.000 | 32 | 674 | 1158 ms |
| V3 | 32 | 32 | 674 | 1051 ms |
| V4 | 32 | 32 | 674 | 1146 ms |
| V5 | 2 | 2 | 676 | 851 ms |

Báo cáo cũng diễn giải đúng:

- V2 không giảm `MAP_OUTPUT_RECORDS`, vì mapper vẫn emit từng purchase.
- V3 giảm record trước `context.write`.
- V5 giảm số record nhưng không làm shuffle bytes giảm tương ứng, vì batch vẫn mang các aggregate entry.
- Chi phí profile làm V4/V5 có thể chậm hơn trong lần chạy đầu.
- Không khẳng định V5 luôn nhanh nhất.

Đây là cách trình bày có chất lượng nghiên cứu tốt.

#### Nên bổ sung

- Cho biết mỗi metric lấy từ Hadoop Counter nào.
- Đưa một đoạn counter output thật.
- Bổ sung `SPILLED_RECORDS` nếu thu được.
- Với timing, nên có `min/median/max` hoặc độ lệch chuẩn thay vì chỉ median ba lần.

### 3.7. Kết quả tối ưu có giữ nguyên tính đúng không?

#### Yêu cầu cần chứng minh

\[
Output(V1)=Output(V2)=Output(V3)=Output(V4)=Output(V5)
\]

Không chỉ so sánh vài tổng cuối, mà cần so sánh:

- Tập khóa.
- Sum từng khóa.
- Count từng khóa.
- Average từng khóa.
- Tổng count toàn bộ.
- Không có khóa trùng.

#### Đánh giá: Đạt tốt

`ResultValidator` và `VariantsIT` đã được mô tả đúng hướng. Báo cáo nói validator:

- Đọc tất cả `part-r-*`.
- Từ chối khóa trùng.
- Kiểm tra tổng count.
- So sánh chính xác sum/count giữa các variant.

#### Nên bổ sung bằng chứng

Hiện mới là lời mô tả và con số “test đạt”. Nên thêm một đoạn log:

```text
Reference: V1
Compared: V2, V3, V4, V5
Keys compared: 32
Duplicate keys: 0
Sum mismatches: 0
Count mismatches: 0
Validation status: PASS
```

Như vậy người chấm không phải tin vào lời khẳng định.

## 4. Các thuộc tính quan trọng nhưng chưa được chứng minh

### 4.1. Cài đặt và chạy thành công trên Hadoop Standalone

**Đây là thiếu sót quan trọng nhất.**

Đề yêu cầu:

- Cài đặt Apache Hadoop Standalone.
- Lập trình.
- Chạy thử nghiệm trên Hadoop.

Báo cáo hiện có nói dùng `Hadoop LocalJobRunner` và local filesystem. Về kỹ thuật, đây là chế độ local/standalone hợp lệ. Nhưng báo cáo chưa có bằng chứng môi trường.

#### Đánh giá: Chưa đạt về bằng chứng

Cần bổ sung:

1. Phiên bản Hadoop:

```bash
hadoop version
```

2. Phiên bản Java:

```bash
java -version
```

3. Cấu hình thể hiện local mode:

```text
mapreduce.framework.name=local
fs.defaultFS=file:///
```

4. Lệnh chạy chương trình thật.
5. Ảnh terminal hoặc log thể hiện:
   - Job bắt đầu.
   - Mapper chạy.
   - Reducer chạy.
   - Job thành công.
   - Counters.
6. Danh sách file output.
7. Nội dung một file `part-r-*`.

Báo cáo có thể dùng Docker, nhưng phải nói rõ:

> Container cung cấp Java, Maven và Hadoop API; MapReduce chạy bằng LocalJobRunner trong chế độ Standalone, không phải pseudo-distributed HDFS/YARN cluster.

Nếu chỉ dùng LocalJobRunner thì không nên trình bày như đã chạy trên cụm HDFS/YARN.

### 4.2. Demo với dữ liệu mẫu

#### Đánh giá: Chưa đạt về bằng chứng trực quan

Báo cáo có benchmark và test nhưng chưa có một demo dễ kiểm tra bởi người chấm.

Cần có một tiểu mục “Demo chương trình”, gồm:

- Ảnh hoặc đoạn trích input.
- Lệnh thực thi.
- Log job thành công.
- Output.
- Đối chiếu output với kết quả tính tay.

Một demo tốt không cần dữ liệu lớn. Dữ liệu nhỏ giúp kiểm tra tính đúng; benchmark lớn dùng để đánh giá hiệu năng. Hai mục đích này nên tách riêng:

- **Demo nhỏ:** chứng minh tính đúng.
- **Benchmark:** chứng minh hiệu quả.

### 4.3. Khả năng xử lý song song và phân tán

Bản chất của MapReduce là input được chia thành nhiều split, nhiều mapper xử lý độc lập rồi reducer tổng hợp.

#### Yêu cầu cần chứng minh

Kết quả phải không đổi khi thay đổi:

- Số input split.
- Số mapper.
- Số reducer.
- Cách phân phối record giữa mapper.

#### Đánh giá: Có test nhưng benchmark chưa chứng minh

Báo cáo nói integration test có nhiều split/reducer, nhưng benchmark chính lại dùng:

- Một mapper.
- Hai reducer.
- LocalJobRunner.

Do đó benchmark chứng minh tối ưu nội bộ của job, nhưng chưa chứng minh khả năng scale-out.

#### Cần bổ sung ít nhất một thí nghiệm

Chạy cùng input với:

| Cấu hình | Số mapper | Số reducer | Kết quả |
|---|---:|---:|---|
| A | 1 | 1 | Hash/output X |
| B | 2+ | 1 | Hash/output X |
| C | 2+ | 2 | Hash/output X |
| D | 2+ | 4 | Hash/output X |

Kết quả phải giống nhau.

Nếu chỉ chạy Standalone, có thể ép input thành nhiều split để chứng minh tính độc lập của mapper. Tuy nhiên cần nói rõ:

> Đây là kiểm chứng logic nhiều task trong môi trường local, không phải bằng chứng về tốc độ mở rộng trên nhiều máy.

### 4.4. Khả năng mở rộng theo kích thước dữ liệu

Slide nhấn mạnh scalability, nhưng không có nghĩa báo cáo phải chép lý thuyết scale-out. Bài làm nên có số liệu thể hiện thuật toán hoạt động khi dữ liệu tăng.

#### Đánh giá: Chưa chứng minh

Benchmark hiện chỉ có một kích thước 200.000 dòng, nên không thể thấy xu hướng khi N tăng.

Nên chạy ít nhất:

- 10.000 dòng.
- 100.000 dòng.
- 200.000 hoặc 1.000.000 dòng.

Đo:

- Thời gian.
- Map output.
- Reduce input.
- Shuffle bytes.

Kỳ vọng:

- V1: map output tăng gần tuyến tính theo số purchase.
- V3/V4: nếu số nhóm K cố định và cache đủ lớn, map output tăng chậm hơn nhiều.
- V5: số batch chủ yếu phụ thuộc mapper và reducer, không trực tiếp bằng số purchase.

Đây là bằng chứng mạnh cho việc nhóm hiểu lợi ích của local aggregation.

### 4.5. Ảnh hưởng của số lượng nhóm/cardinality

Các tối ưu V3–V5 phụ thuộc mạnh vào số nhóm K.

#### Đánh giá: Có phân tích, chưa có thực nghiệm

Báo cáo đã nói:

- V3 phụ thuộc cache B.
- V4/V5 tốn `O(K)` bộ nhớ.
- Dictionary có lợi khi K vừa phải.
- High cardinality chưa được đánh giá.

Đây là nhận xét đúng, nhưng hiện vẫn là lập luận.

Nên benchmark với:

- K = 32.
- K = 1.000.
- K = 10.000.
- Cache V3 nhỏ hơn và lớn hơn K.

Metric:

- Map output.
- Shuffle bytes.
- Thời gian.
- Peak memory nếu lấy được.

Điều này sẽ chứng minh điều kiện áp dụng của từng variant.

### 4.6. Xử lý dữ liệu lỗi

#### Đánh giá: Thiết kế tốt, thiếu bảng kết quả thực nghiệm

Báo cáo nói có:

- Kiểm tra UTF-8.
- Kiểm tra header.
- Kiểm tra số cột.
- Kiểm tra price.
- Kiểm tra group.
- Kiểm tra line size.
- Checksum và fingerprint.
- Phát hiện malformed CSV.
- Phát hiện overflow.

Đây là phần tốt, nhưng cần biến thành bằng chứng:

| Trường hợp | Kỳ vọng | Kết quả |
|---|---|---|
| Header sai | Job bị từ chối trước khi chạy | PASS |
| Price âm | Record bị từ chối hoặc job fail theo policy | PASS |
| Price sai định dạng | Báo lỗi | PASS |
| Thiếu category | `__UNKNOWN__` hoặc từ chối theo mode | PASS |
| CSV có dấu quote | Parser fallback | PASS |
| Input thay đổi sau preflight | Fingerprint mismatch | PASS |
| Overflow `long` | Job fail rõ ràng | PASS |

### 4.7. Fault tolerance

Hadoop có cơ chế retry task và HDFS có replication. Nhưng project chạy local filesystem và LocalJobRunner.

#### Đánh giá: Không được coi là đã chứng minh

Báo cáo chỉ nên nói:

- Fault tolerance là thuộc tính của Hadoop cluster.
- Thiết kế MapReduce với task độc lập hỗ trợ retry.
- Thử nghiệm local không kiểm chứng replication HDFS, NodeManager failure hay task chạy lại trên node khác.

Không nhất thiết phải làm thí nghiệm fault tolerance vì đề chỉ yêu cầu Standalone. Tuy nhiên phải tránh ngụ ý rằng bài làm đã chứng minh thuộc tính này.

## 5. Những phần từ slide không bắt buộc đưa vào

Theo cách đánh giá này, các nội dung sau **không cần thêm chỉ để phủ slide**:

- Nguồn phát sinh Big Data.
- Cơ hội và thách thức xã hội của Big Data.
- GPU, FPGA, MPI và cloud.
- HBase.
- TensorFlow.
- K-means.
- Toàn bộ Spark SQL/DataFrame.
- Chi tiết lịch sử Hadoop/Spark.
- Các ví dụ PB/ZB trong slide.

Chỉ nên giữ kiến thức phục vụ ba mục đích:

1. Giải thích vì sao chọn Hadoop MapReduce.
2. Chứng minh thuật toán đúng.
3. Giải thích và đo hiệu quả của các phương án tối ưu.

Phần Spark hiện tại có thể rút gọn. Đề bài cho phép chọn Hadoop **hoặc** Spark; nhóm đã chọn Hadoop, do đó không cần dành nhiều trang cho kiến trúc Spark. Một bảng so sánh ngắn là đủ.

## 6. Đánh giá theo bộ tiêu chí “chứng minh thuộc tính”

| Thuộc tính | Đánh giá | Nhận xét |
|---|---|---|
| Đúng bài toán Group By Aggregation | Tốt | Định nghĩa sum/count/average rõ |
| Map/Reduce đúng | Tốt về lý thuyết | Thiếu execution trace |
| Phép merge hợp lệ | Rất tốt | Có associativity, identity và weighted average |
| Combiner an toàn | Tốt | Nên dùng V1 = V2 làm bằng chứng rõ ràng |
| Partition đúng | Khá | Thiếu ví dụ nhiều reducer và counter/output thật |
| V1–V5 giữ nguyên kết quả | Tốt | Có differential validation nhưng thiếu log minh chứng |
| Giảm dữ liệu trung gian | Rất tốt | Có counters và giải thích đúng |
| Hiệu năng | Khá | Chỉ một workload, ba lần chạy và một mapper |
| Khả năng mở rộng theo N | Chưa đạt | Chỉ một kích thước dữ liệu |
| Khả năng xử lý khi K tăng | Chưa đạt | Có phân tích nhưng không có số liệu |
| Nhiều mapper/reducer | Một phần | Có nói integration test, chưa có bảng kết quả cụ thể |
| Hadoop Standalone được cài và chạy | Chưa đạt về bằng chứng | Thiếu ảnh, cấu hình, version, log và output |
| Demo dữ liệu mẫu | Chưa đạt | Không có chuỗi input → command → output → kiểm tra tay |
| Dữ liệu lỗi và failure path | Khá | Thiết kế tốt nhưng thiếu bảng bằng chứng |
| Fault tolerance của cụm | Không kiểm chứng | Phải ghi rõ giới hạn LocalJobRunner |
| Khả năng tái lập | Khá tốt | Có command/version nhưng thiếu artifact/log trực tiếp trong báo cáo |

## 7. Các sửa đổi nên ưu tiên

### 7.1. Bắt buộc

1. **Thêm mục “Bằng chứng cài đặt Hadoop Standalone”**:
   - Hadoop version.
   - Java version.
   - Cấu hình local.
   - Lệnh build và chạy.
   - Ảnh hoặc log job thành công.

2. **Thêm mục “Demo kiểm chứng tính đúng”**:
   - Input nhỏ.
   - Map output.
   - Shuffle grouping.
   - Reduce output.
   - Kết quả tính tay.

3. **Thêm một bảng “Thuộc tính và bằng chứng”**:

| Thuộc tính | Cách kiểm tra | Kết quả |
|---|---|---|
| Mỗi purchase được tính một lần | Oracle thủ công | PASS |
| Combiner không đổi kết quả | So V1 với V2 | PASS |
| Các tối ưu không đổi kết quả | So V1 với V2–V5 | PASS |
| Cùng key về cùng reducer | Kiểm tra part files không trùng key | PASS |
| Thay đổi reducer không đổi kết quả | Chạy R=1,2,4 | PASS |
| V3 giảm map output | Hadoop Counter | 200.000 → 32 |
| V5 giảm số record sort | Hadoop Counter | 200.000 → 2 |

4. **Đưa log/counter thật vào phụ lục**, thay vì chỉ ghi con số tổng hợp.

### 7.2. Nên có

5. Chạy với nhiều split và các giá trị reducer khác nhau.
6. Chạy ít nhất ba kích thước N để thể hiện scalability.
7. Nếu muốn bảo vệ mạnh V3–V5, chạy thêm vài mức cardinality K.
8. Thêm bảng failure cases.
9. Điền đầy đủ phân công, thông tin nhóm và cập nhật mục lục.

### 7.3. Có thể rút gọn

10. Rút phần Spark xuống một bảng hoặc khoảng nửa trang.
11. Không cần bổ sung K-means, HBase, GPU, cloud hay toàn bộ nội dung slide.
12. Giảm mô tả chi tiết nội bộ V4/V5 nếu thành viên không thể giải thích chắc chắn khi phản biện.

## 8. Nhận định cuối

Báo cáo đã có phần chứng minh thuật toán tốt hơn nhiều báo cáo BTL thông thường. Vấn đề lớn không phải thiếu kiến thức trong slide, mà là bằng chứng hiện nghiêng về thiết kế và số liệu tổng hợp, trong khi thiếu chuỗi chứng cứ thực hành dễ kiểm tra:

> **Môi trường Hadoop → lệnh chạy → log job → counters → output → đối chiếu kết quả**

Đây nên là trọng tâm của lần sửa tiếp theo.
