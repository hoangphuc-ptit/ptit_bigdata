package vn.edu.bigdata.revenue.spark;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.RowFactory;
import org.apache.spark.sql.SaveMode;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.types.DataTypes;
import org.apache.spark.sql.types.StructType;
import org.apache.spark.util.LongAccumulator;
import scala.Tuple2;
import vn.edu.bigdata.revenue.domain.GroupMode;
import vn.edu.bigdata.revenue.domain.Money;
import vn.edu.bigdata.revenue.input.CsvEventParser;
import vn.edu.bigdata.revenue.input.PreparationResult;
import vn.edu.bigdata.revenue.input.PreparationResult.Reason;
import vn.edu.bigdata.revenue.input.PurchasePreparation;

/**
 * A1 trên Spark RDD: doanh thu purchase theo category_id, đối chứng chính xác với Hadoop MR V1.
 *
 * <p>Dùng lại nguyên CsvEventParser + PurchasePreparation + Money của MR nên chính sách lọc trùng
 * khớp theo cấu trúc. Ánh xạ mô hình: flatMapToPair = map (emit category_id -> (sum, 1));
 * reduceByKey gộp phía map trước shuffle (tương tự combiner), shuffle theo HashPartitioner, rồi gộp
 * cuối (tương tự reducer). Đây là cơ chế của Spark, không phải Hadoop Reducer.
 */
public final class RevenueJob {
  public static final String OUTPUT_ROOT = "/data/ecommerce/agg/revenue_by_category";
  public static final List<String> CSV_HEADER =
      List.of("group_key", "total_revenue", "purchase_count", "average_revenue");
  static final StructType SCHEMA =
      new StructType()
          .add("group_key", DataTypes.StringType, false)
          .add("sum_minor", DataTypes.LongType, false)
          .add("purchase_count", DataTypes.LongType, false)
          .add("total_revenue", DataTypes.StringType, false)
          .add("average_revenue", DataTypes.StringType, false);

  private RevenueJob() {}

  /** Kết quả A1: các nhóm đã sắp theo group_key, số dòng theo lý do, và lineage của RDD. */
  public static final class Result {
    public final List<Row> rows;
    public final Map<String, Long> reasons;
    public final String lineage;

    Result(List<Row> rows, Map<String, Long> reasons, String lineage) {
      this.rows = rows;
      this.reasons = reasons;
      this.lineage = lineage;
    }
  }

  public static Result compute(SparkSession spark, String input, int reducers) {
    JavaSparkContext jsc = JavaSparkContext.fromSparkContext(spark.sparkContext());
    // Accumulator cập nhật trong transformation có thể đếm lặp nếu task chạy lại; job kiểm tra
    // VALID_PURCHASE == tổng purchase_count để phát hiện trường hợp đó.
    EnumMap<Reason, LongAccumulator> counters = new EnumMap<>(Reason.class);
    for (Reason reason : Reason.values())
      counters.put(reason, spark.sparkContext().longAccumulator(reason.name()));
    GroupMode mode = GroupMode.CATEGORY_ID;

    JavaRDD<String> lines = jsc.textFile(SparkSupport.qualify(input));
    JavaPairRDD<String, long[]> mapped =
        lines.flatMapToPair(
            line -> {
              PreparationResult r =
                  PurchasePreparation.prepare(new CsvEventParser().parse(line), mode);
              counters.get(r.reason()).add(1);
              if (!r.valid()) return Collections.emptyIterator();
              return List.of(new Tuple2<>(r.group(), new long[] {r.state().sumMinor(), 1L}))
                  .iterator();
            });
    JavaPairRDD<String, long[]> reduced =
        mapped.reduceByKey(
            (a, b) -> new long[] {Math.addExact(a[0], b[0]), Math.addExact(a[1], b[1])}, reducers);
    List<Tuple2<String, long[]>> groups = new ArrayList<>(reduced.collect());
    groups.sort((x, y) -> x._1().compareTo(y._1()));

    List<Row> rows = new ArrayList<>();
    for (Tuple2<String, long[]> g : groups)
      rows.add(
          RowFactory.create(
              g._1(),
              g._2()[0],
              g._2()[1],
              Money.formatMinor(g._2()[0]),
              Money.average(g._2()[0], g._2()[1])));
    Map<String, Long> reasons = new LinkedHashMap<>();
    for (Reason reason : Reason.values()) {
      long value = counters.get(reason).value();
      if (value > 0) reasons.put(reason.name(), value);
    }
    return new Result(rows, reasons, reduced.toDebugString());
  }

  public static List<List<Object>> csvRows(List<Row> rows) {
    List<List<Object>> out = new ArrayList<>();
    for (Row r : rows)
      out.add(List.of(r.getString(0), r.getString(3), r.getLong(2), r.getString(4)));
    return out;
  }

  /** --input /data/... --tag d1 [--reducers 2 --run-id ID] */
  static void run(SparkSession spark, vn.edu.bigdata.revenue.cli.CliArguments a) throws Exception {
    String input = a.required("input");
    String runId = a.get("run-id", SparkSupport.runId(a.required("tag")));
    int reducers = a.integer("reducers", 2);
    String out = OUTPUT_ROOT + "/run_id=" + runId;
    Map<String, Object> params = new LinkedHashMap<>();
    params.put("input", input);
    params.put("reducers", reducers);
    params.put("output", out);
    SparkSupport.RunRecord run = new SparkSupport.RunRecord(spark, "revenue", runId, params);
    try {
      SparkSupport.requireNew(spark, out);
      Result result = run.stage("map_reduceByKey", () -> compute(spark, input, reducers));
      run.stage(
          "write_parquet",
          () -> {
            spark
                .createDataFrame(result.rows, SCHEMA)
                .coalesce(1)
                .write()
                .mode(SaveMode.ErrorIfExists)
                .parquet(SparkSupport.qualify(out));
            return null;
          });
      long valid = result.reasons.getOrDefault(Reason.VALID_PURCHASE.name(), 0L);
      long counted = result.rows.stream().mapToLong(r -> r.getLong(2)).sum();
      if (valid != counted)
        throw new IllegalStateException("VALID_PURCHASE " + valid + " != sum count " + counted);
      SparkSupport.writeCsv(run.localDir.resolve("revenue.csv"), CSV_HEADER, csvRows(result.rows));
      java.nio.file.Files.writeString(
          run.localDir.resolve("revenue-rdd-lineage.txt"), result.lineage);
      run.metrics.put("rowsIn", result.reasons.values().stream().mapToLong(Long::longValue).sum());
      run.metrics.put("reasons", result.reasons);
      run.metrics.put("groups", result.rows.size());
      run.metrics.put("validPurchases", valid);
      run.finish(out + "/_run.json", null);
      System.out.println(
          "A1 xong: " + runId + " groups=" + result.rows.size() + " valid=" + valid + " -> " + out);
    } catch (Exception e) {
      run.finish(null, e);
      throw e;
    }
  }
}
