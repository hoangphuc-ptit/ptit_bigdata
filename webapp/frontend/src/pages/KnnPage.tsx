import ReactECharts from "../chart";
import { useEffect, useState } from "react";
import { ModelEntry, num, post, when } from "../api";
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

const METRIC_COLUMNS: [string, string][] = [["precision", "Precision"], ["recall", "Recall"], ["f1", "F1"], ["pr_auc", "PR-AUC"],
  ["balanced_accuracy", "Balanced acc."], ["accuracy", "Accuracy"], ["tp", "TP"], ["fp", "FP"], ["fn", "FN"], ["tn", "TN"]];
const COUNT_COLUMNS = new Set(["tp", "fp", "fn", "tn"]);
const CI_LABELS: Record<string, string> = { knn_f1: "F1 của KNN", knn_pr_auc: "PR-AUC của KNN", rule_f1: "F1 của luật lịch sử", knn_minus_rule_f1: "F1 KNN trừ F1 luật lịch sử" };

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
      <header className="page-head"><h1>KNN: sản phẩm có được mua trong 7 ngày tới?</h1><p className="lead">Nhãn tạo từ dữ liệu thật theo mốc thời gian t0; đánh giá trên ảnh chụp test sau thời điểm huấn luyện.</p></header>
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
                <Kpi label="Huấn luyện lúc" value={when(meta.training_time)} />
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
            <thead><tr><th>Mô hình</th>{METRIC_COLUMNS.map(([c, label]) => <th key={c} className="num">{label}</th>)}</tr></thead>
            <tbody>
              {Object.entries(metrics.test as Record<string, any>).map(([name, m]) => (
                <tr key={name} className={name.startsWith("KNN") ? "highlight" : ""}><td>{name}</td>{METRIC_COLUMNS.map(([c]) => <td key={c} className="num">{num(m[c], COUNT_COLUMNS.has(c) ? 0 : 4)}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {knnRow && (
            <>
              <h3>Confusion matrix KNN</h3>
              <table className="confusion">
                <thead><tr><th></th><th className="num">Dự đoán 0</th><th className="num">Dự đoán 1</th></tr></thead>
                <tbody>
                  <tr><th>Thực tế 0</th><td className="num">{num(knnRow[1].tn, 0)}</td><td className="num">{num(knnRow[1].fp, 0)}</td></tr>
                  <tr><th>Thực tế 1</th><td className="num">{num(knnRow[1].fn, 0)}</td><td className="num">{num(knnRow[1].tp, 0)}</td></tr>
                </tbody>
              </table>
            </>
          )}
          <h3>Khoảng tin cậy 95% (bootstrap 1 000 lần trên test)</h3>
          <div className="table-wrap" style={{ maxWidth: 560 }}>
            <table>
              <thead><tr><th>Chỉ số</th><th className="num">Cận dưới</th><th className="num">Cận trên</th></tr></thead>
              <tbody>
                {Object.entries(metrics.testBootstrapCI95 as Record<string, number[]>).map(([k, [lo, hi]]) => (
                  <tr key={k}><td>{CI_LABELS[k] ?? k}</td><td className="num">{num(lo, 4)}</td><td className="num">{num(hi, 4)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <h2>KNN Prediction</h2><p className="note">Backend tìm K láng giềng gần nhất trong tập huấn luyện đã lưu (K của mô hình) và bỏ phiếu.</p>
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
