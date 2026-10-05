package vn.edu.bigdata.revenue.spark;

import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import org.apache.spark.sql.SparkSession;
import vn.edu.bigdata.revenue.cli.CliArguments;

/**
 * Điểm chạy các job Spark (Java) của pipeline:
 *
 * <pre>
 * spark-submit --class vn.edu.bigdata.revenue.spark.SparkTool revenue-aggregation-spark.jar JOB --name value ...
 *   revenue  --input /data/... --tag d1 [--reducers 2]                   A1 (RDD reduceByKey), đối chứng MR
 *   etl      --input /data/... --tag d1 [--duplicates true]              raw -> curated Parquet + chất lượng
 *   metrics  --curated-run-id ID [--revenue-run-id A1_ID]                A2-A5
 *   features --curated-run-id ID [--min-views 20]                        A7 (đầu vào notebook K-Means/KNN)
 * </pre>
 */
public final class SparkTool {
  private static final Map<String, Set<String>> FLAGS =
      Map.of(
          "revenue", Set.of("input", "tag", "reducers", "run-id"),
          "etl", Set.of("input", "tag", "duplicates", "run-id"),
          "metrics", Set.of("curated-run-id", "revenue-run-id", "run-id"),
          "features", Set.of("curated-run-id", "min-views", "run-id"));

  private SparkTool() {}

  public static void main(String[] args) throws Exception {
    if (args.length == 0 || !FLAGS.containsKey(args[0])) {
      System.err.println("Usage: SparkTool {revenue|etl|metrics|features} --name value ...");
      System.exit(2);
    }
    CliArguments a = new CliArguments(Arrays.copyOfRange(args, 1, args.length), FLAGS.get(args[0]));
    SparkSession spark = SparkSupport.session("ptit-" + args[0]);
    try {
      switch (args[0]) {
        case "revenue":
          RevenueJob.run(spark, a);
          break;
        case "etl":
          EventEtlJob.run(spark, a);
          break;
        case "metrics":
          MetricsJob.run(spark, a);
          break;
        default:
          ProductFeaturesJob.run(spark, a);
      }
    } finally {
      spark.stop();
    }
  }
}
