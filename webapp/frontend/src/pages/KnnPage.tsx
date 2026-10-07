import ReactECharts from "echarts-for-react";
import { useEffect, useState } from "react";
import { ModelEntry, num, post } from "../api";
import { useGet } from "../hooks";
import { Kpi } from "./Overview";
import ProductPicker from "./ProductPicker";

const RAW_FIELDS = [
  ["views", "Lượt xem (14 ngày trước t0)"],
  ["carts", "Thêm giỏ"],
  ["purchases", "Lượt mua"],
  ["medianPrice", "Giá trung vị"],
  ["distinctUsers", "Số user khác nhau"],
  ["recentViews", "Lượt xem 7 ngày cuối"],
] as const;

const METRIC_COLUMNS = ["precision", "recall", "f1", "pr_auc", "balanced_accuracy", "accuracy", "tp", "fp", "fn", "tn"];

export default function KnnPage() {
  const models = useGet<ModelEntry[]>("/api/ml/knn/models");
  const [runId, setRunId] = useState<string | null>(null);
  useEffect(() => {
    if (!runId && models.data?.length) setRunId(models.data[0].runId);
  }, [models.data, runId]);
  const detail = useGet<any>(runId ? `/api/ml/knn/${runId}` : null);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const predict = (body: object) => {
    setError(null);
    post<any>("/api/ml/knn/predict", { runId, ...body }).then(setResult).catch((e) => { setResult(null); setError(String(e.message)); });
  };
  const meta = detail.data?.metadata;
  const metrics = detail.data?.metrics;
  const knnRow = metrics && Object.entries(metrics.test as Record<string, any>).find(([name]) => name.startsWith("KNN"));
  return (
    <>
      <h1>KNN: dự đoán sản phẩm có purchase trong 7 ngày tới</h1>
      {models.error && <p className="error">{models.error}</p>}
      {models.data?.length === 0 && <p className="note">Chưa publish mô hình KNN nào.</p>}
      {models.data && models.data.length > 0 && (
        <section>
          <label>
            Mô hình (run huấn luyện)
            <select value={runId ?? ""} onChange={(e) => { setRunId(e.target.value); setResult(null); }}>
              {models.data.map((m) => <option key={m.runId}>{m.runId}</option>)}
            </select>
          </label>
          {meta && (
            <>
              <div className="grid" style={{ marginTop: 12 }}>
                <Kpi label="Thuật toán" value={meta.algorithm} />
                <Kpi label="K" value={String(meta.hyperparameters.k)} />
                <Kpi label="Ngưỡng vote_share" value={num(meta.hyperparameters.threshold, 3)} />
                <Kpi label="F1 test (lớp 1)" value={num(meta.metrics.test_f1, 4)} />
                <Kpi label="PR-AUC test" value={num(meta.metrics.test_pr_auc, 4)} />
                <Kpi label="Huấn luyện lúc" value={meta.training_time} />
              </div>
              <p className="note">
                Nhãn: {meta.label}. Train t0 = {meta.dataset.trainT0}, test t0 = {meta.dataset.testT0} (chia theo thời
                gian). Đặc trưng: {meta.features.join(", ")}. Tiền xử lý: {meta.feature_preprocessing}.
              </p>
              <p className="note">
                Spark MLlib không có bộ phân loại KNN: Spark tạo đặc trưng/nhãn và chuẩn hóa, KNN tìm láng giềng chính
                xác (notebook numpy khi đánh giá, Java ở backend khi dự đoán). vote_share là tỷ lệ phiếu, không phải
                xác suất.
              </p>
            </>
          )}
        </section>
      )}
      {metrics && (
        <section>
          <h2>Đánh giá trên test (một lần, sau khi chọn K và ngưỡng trên validation)</h2>
          <table>
            <thead><tr><th>Mô hình</th>{METRIC_COLUMNS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {Object.entries(metrics.test as Record<string, any>).map(([name, m]) => (
                <tr key={name}><td>{name}</td>{METRIC_COLUMNS.map((c) => <td key={c} className="num">{num(m[c], 4)}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {knnRow && (
            <>
              <h3>Confusion matrix KNN</h3>
              <table style={{ width: "auto" }}>
                <thead><tr><th></th><th>dự đoán 0</th><th>dự đoán 1</th></tr></thead>
                <tbody>
                  <tr><th>thực tế 0</th><td className="num">{knnRow[1].tn}</td><td className="num">{knnRow[1].fp}</td></tr>
                  <tr><th>thực tế 1</th><td className="num">{knnRow[1].fn}</td><td className="num">{knnRow[1].tp}</td></tr>
                </tbody>
              </table>
            </>
          )}
          <p className="note">Khoảng tin cậy 95% (bootstrap): {JSON.stringify(metrics.testBootstrapCI95)}</p>
          <h3>Chọn K trên validation</h3>
          <ReactECharts
            style={{ height: 260 }}
            option={{
              tooltip: { trigger: "axis" },
              legend: {},
              xAxis: { type: "category", name: "K", data: metrics.validationSweep.map((r: any) => r.k) },
              yAxis: { type: "value", min: 0, max: 1 },
              series: ["f1", "precision", "recall", "pr_auc"].map((m) => ({ name: m, type: "line", data: metrics.validationSweep.map((r: any) => r[m]) })),
            }}
          />
        </section>
      )}
      {runId && (
        <section>
          <h2>KNN Prediction (backend suy luận từ tập huấn luyện đã lưu)</h2>
          <h3>Chọn sản phẩm của ảnh chụp test</h3>
          <ProductPicker type="knn" runId={runId} onPick={(p) => predict({ productId: p.product_id })} />
          <h3>Hoặc nhập số đếm thô trong 14 ngày trước t0</h3>
          <form onSubmit={(e) => {
            e.preventDefault();
            predict({ raw: Object.fromEntries(RAW_FIELDS.map(([k]) => [k, Number(raw[k] ?? 0)])) });
          }}>
            {RAW_FIELDS.map(([k, label]) => (
              <label key={k}>{label}<input type="number" min="0" step="any" required value={raw[k] ?? ""} onChange={(e) => setRaw({ ...raw, [k]: e.target.value })} /></label>
            ))}
            <button type="submit">Predict</button>
          </form>
          {error && <p className="error">{error}</p>}
          {result && (
            <div>
              <p>
                Dự đoán: <span className={`badge ${result.label ? "ok" : "bad"}`}>{result.label ? "có purchase" : "không purchase"}</span>{" "}
                · vote_share = {num(result.voteShare, 3)} (ngưỡng {num(result.threshold, 3)}, K = {result.k})
                {result.actualLabel !== undefined && <> · nhãn thật: {result.actualLabel} · notebook: {num(result.notebookVoteShare, 3)}</>}
              </p>
              {result.outOfDomain && <p className="warn">Ngoài miền huấn luyện: {result.warnings.join("; ")}</p>}
              <table>
                <thead><tr><th>#</th><th>Láng giềng (train)</th><th>Nhãn</th><th>Khoảng cách²</th></tr></thead>
                <tbody>
                  {result.neighbours.map((n: any, i: number) => (
                    <tr key={i}><td>{i + 1}</td><td>{n.productId}</td><td>{n.label}</td><td className="num">{num(n.squaredDistance, 4)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
