import ReactECharts from "../chart";
import { useEffect, useState } from "react";
import { ModelEntry, num, post, Row, when } from "../api";
import { useGet } from "../hooks";
import { Kpi } from "./Overview";
import ProductPicker from "./ProductPicker";

const RAW_FIELDS = [
  ["views", "Lượt xem"],
  ["carts", "Thêm giỏ"],
  ["purchases", "Lượt mua"],
  ["medianPrice", "Giá trung vị"],
  ["distinctUsers", "Số user khác nhau"],
] as const;

export default function KMeansPage() {
  const models = useGet<ModelEntry[]>("/api/ml/kmeans/models");
  const [runId, setRunId] = useState<string | null>(null);
  useEffect(() => {
    if (!runId && models.data?.length) setRunId(models.data[0].runId);
  }, [models.data, runId]);
  const detail = useGet<any>(runId ? `/api/ml/kmeans/${runId}` : null);
  const clusters = useGet<any>(runId ? `/api/ml/kmeans/${runId}/clusters` : null);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const predict = (body: object) => {
    setError(null);
    post<any>("/api/ml/kmeans/predict", { runId, ...body }).then(setResult).catch((e) => { setResult(null); setError(String(e.message)); });
  };
  const meta = detail.data?.metadata;
  const metrics = detail.data?.metrics;
  return (
    <>
      <header className="page-head"><h1>K-Means: phân cụm sản phẩm</h1><p className="lead">Huấn luyện offline bằng Spark MLlib trên đặc trưng tổng hợp theo product_id. Dự đoán ở đây do backend tính từ mô hình đã lưu.</p></header>
      {models.error && <p className="error">{models.error}</p>}
      {models.data?.length === 0 && <p className="note">Chưa publish mô hình K-Means nào.</p>}
      {models.data && models.data.length > 0 && (
        <section>
          <label>
            Mô hình (run huấn luyện)
            <select value={runId ?? ""} onChange={(e) => { setRunId(e.target.value); setResult(null); }}>
              {models.data.map((m) => <option key={m.runId}>{m.runId}</option>)}
            </select>
          </label>
          {meta && (
            <div className="grid" style={{ marginTop: 12 }}>
              <Kpi label="Thuật toán" value={meta.algorithm} />
              <Kpi label="K" value={String(meta.hyperparameters.k)} />
              <Kpi label="Silhouette" value={num(meta.metrics.silhouette, 4)} />
              <Kpi label="Inertia" value={num(meta.metrics.inertia, 1)} />
              <Kpi label="Số sản phẩm" value={num(meta.dataset.products, 0)} />
              <Kpi label="Huấn luyện lúc" value={when(meta.training_time)} />
            </div>
          )}
          {meta && <p className="note">Đặc trưng: {meta.features.join(", ")} · Tiền xử lý: {meta.feature_preprocessing}</p>}
        </section>
      )}
      {metrics?.sweep && (
        <section>
          <h2>Chọn K: silhouette và inertia theo K (trung bình 3 seed)</h2>
          <p className="note">Quy tắc: {metrics.selectionRule}</p>
          <ReactECharts
            style={{ height: 300 }}
            option={{
              tooltip: { trigger: "axis" },
              legend: {},
              xAxis: { type: "category", name: "K", data: metrics.sweep.map((r: any) => r.k) },
              yAxis: [{ type: "value", name: "silhouette" }, { type: "value", name: "inertia", axisLabel: { formatter: (v: number) => num(v, 0) } }],
              series: [
                { name: "silhouette", type: "line", data: metrics.sweep.map((r: any) => r.silhouette_mean) },
                { name: "inertia", type: "line", yAxisIndex: 1, data: metrics.sweep.map((r: any) => r.inertia_mean) },
              ],
            }}
          />
        </section>
      )}
      {clusters.data && (
        <section>
          <h2>Cụm: kích thước và hồ sơ thống kê</h2>
          <ReactECharts
            style={{ height: 220 }}
            option={{
              tooltip: {},
              xAxis: { type: "category", data: Object.keys(clusters.data.sizes) },
              yAxis: { type: "value", name: "số sản phẩm", axisLabel: { formatter: (v: number) => num(v, 0) } },
              series: [{ type: "bar", barWidth: 56, itemStyle: { borderRadius: [3, 3, 0, 0] }, data: Object.values(clusters.data.sizes) }],
            }}
          />
          <table>
            <thead><tr>{Object.keys(clusters.data.profile[0] ?? {}).map((c) => <th key={c} className={c === "top_category_roots" ? "" : "num"}>{c}</th>)}</tr></thead>
            <tbody>
              {clusters.data.profile.map((r: Row, i: number) => (
                <tr key={i}>{Object.entries(r).map(([c, v]) => <td key={c} className={c === "top_category_roots" ? "wrap" : "num"}>{c === "top_category_roots" ? v : num(v, 4)}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <p className="note">Diễn giải cụm dựa trên bảng thống kê này; cụm thể hiện tương quan, không phải nhân quả.</p>
        </section>
      )}
      {runId && (
        <section>
          <h2>Dự đoán cụm cho một sản phẩm</h2>
          <h3>Chọn sản phẩm thật</h3>
          <ProductPicker type="kmeans" runId={runId} onPick={(p) => predict({ productId: p.product_id })} />
          <h3>Hoặc nhập số đếm thô của một sản phẩm</h3>
          <form onSubmit={(e) => {
            e.preventDefault();
            predict({ raw: Object.fromEntries(RAW_FIELDS.map(([k]) => [k, Number(raw[k] ?? 0)])) });
          }}>
            {RAW_FIELDS.map(([k, label]) => (
              <label key={k}>{label}<input type="number" min="0" step="any" required value={raw[k] ?? ""} onChange={(e) => setRaw({ ...raw, [k]: e.target.value })} /></label>
            ))}
            <button type="submit">Predict Cluster</button>
          </form>
          {error && <p className="error">{error}</p>}
          {result && (
            <div>
              <p>
                Cụm dự đoán: <span className="badge ok">{result.cluster}</span>
                {result.sparkCluster !== undefined && (
                  <> · Spark đã gán: {result.sparkCluster} <span className={`badge ${result.matchesSpark ? "ok" : "bad"}`}>{result.matchesSpark ? "khớp" : "lệch"}</span></>
                )}
                {" "}· mô hình {result.modelRunId}
              </p>
              {result.outOfDomain && <p className="warn">Ngoài miền huấn luyện: {result.warnings.join("; ")}</p>}
              <ReactECharts
                style={{ height: 200 }}
                option={{
                  tooltip: {},
                  xAxis: { type: "category", name: "cụm", data: result.squaredDistances.map((_: number, i: number) => i) },
                  yAxis: { type: "value", name: "khoảng cách² (chuẩn hóa)" },
                  series: [{ type: "bar", data: result.squaredDistances }],
                }}
              />
              <p className="note">Đặc trưng: {Object.entries(result.features).map(([k, v]) => `${k}=${num(v as number, 4)}`).join(", ")}</p>
            </div>
          )}
        </section>
      )}
    </>
  );
}
