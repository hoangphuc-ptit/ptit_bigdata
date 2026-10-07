import { num } from "../api";
import { useGet } from "../hooks";
import { useRun } from "../run";

interface Manifest {
  runId: string;
  createdAt: string;
  gitSha: string;
  dataset: { tag: string; input: string };
  sources: Record<string, string>;
  files: { path: string; sha256: string; bytes: number; rows?: number }[];
}

/** Các bước dữ liệu đi qua trước khi tới web. */
const FLOW: { title: string; detail: string }[] = [
  { title: "Kaggle CSV", detail: "File gốc giữ nguyên, sha256 trong DATASET.md" },
  { title: "HDFS", detail: "/data/ecommerce/raw, 1 NameNode + 1 DataNode" },
  { title: "MapReduce V1–V5", detail: "Đối chứng A1, benchmark" },
  { title: "Spark", detail: "ETL Parquet, Group By A1–A8" },
  { title: "Spark MLlib", detail: "K-Means, chuẩn hóa cho KNN" },
  { title: "Serving", detail: "JSON/CSV + manifest sha256" },
];

export default function Overview() {
  const { runId, error } = useRun();
  const manifest = useGet<Manifest>(runId ? `/api/runs/${runId}` : null);
  const parity = useGet<any>(runId ? `/api/analytics/${runId}/parity` : null);
  const quality = useGet<any>(runId ? `/api/analytics/${runId}/quality` : null);
  const m = manifest.data;
  const p = parity.data;
  const q = quality.data;
  return (
    <>
      <header className="page-head">
        <h1>Pipeline Big Data từ HDFS tới mô hình</h1>
        <p className="lead">
          Mọi con số trong ứng dụng đến từ kết quả đã được pipeline xử lý và publish. Web không chạy job và không đọc dữ liệu thô.
        </p>
      </header>
      {error && <p className="error">{error}</p>}

      {p && (
        <section className={`hero ${p.matched ? "hero-ok" : "hero-bad"}`}>
          <div className="hero-figure">
            <span className="hero-count">{num(p.sparkGroups, 0)}/{num(p.mrGroups, 0)}</span>
            <span className="hero-unit">nhóm category_id</span>
          </div>
          <div className="hero-text">
            <h2>{p.matched ? "MapReduce V1 và Spark A1 cho cùng một kết quả" : `MapReduce và Spark lệch ở ${p.mismatchCount} nhóm`}</h2>
            <p>
              So khớp chính xác tổng tiền theo đơn vị nhỏ nhất, số lượt mua và trung bình của {num(p.mrPurchaseCount, 0)} purchase
              hợp lệ. Hai engine đọc cùng file trên HDFS.
            </p>
            {!p.matched && <pre className="error">{JSON.stringify(p.mismatches, null, 2)}</pre>}
            <p className="source">
              MR output <code>{p.mrOutput}</code>
              <br />
              Spark A1 run <code>{p.sparkRevenueRunId}</code>
            </p>
          </div>
        </section>
      )}

      {m && (
        <section>
          <h2>Luồng dữ liệu của serving run này</h2>
          <ol className="flow">
            {FLOW.map((f) => (
              <li key={f.title}>
                <strong>{f.title}</strong>
                <span>{f.detail}</span>
              </li>
            ))}
          </ol>
          <dl className="facts">
            <div><dt>Dữ liệu</dt><dd>{m.dataset.tag.toUpperCase()}</dd><dd className="sub">{m.dataset.input}</dd></div>
            {q && <div><dt>Dòng vào ETL</dt><dd>{num(q.rowsIn, 0)}</dd></div>}
            {q && <div><dt>Dòng hợp lệ</dt><dd>{num(q.rowsValid, 0)}</dd></div>}
            {q && (
              <div>
                <dt>Dòng bị loại</dt>
                <dd>{Object.entries(q.rejected ?? {}).map(([k, v]) => `${num(v as number, 0)} ${k}`).join(", ") || "0"}</dd>
              </div>
            )}
            <div><dt>Publish (UTC)</dt><dd>{m.createdAt.slice(0, 16).replace("T", " ")}</dd><dd className="sub">git {m.gitSha}</dd></div>
          </dl>
        </section>
      )}

      {q?.quality && (
        <section>
          <h2>Chất lượng dữ liệu sau ETL</h2>
          <dl className="facts">
            <div><dt>Lượt xem</dt><dd>{num(q.quality.eventTypes?.view, 0)}</dd></div>
            <div><dt>Thêm giỏ</dt><dd>{num(q.quality.eventTypes?.cart, 0)}</dd></div>
            <div><dt>Lượt mua</dt><dd>{num(q.quality.eventTypes?.purchase, 0)}</dd></div>
            <div><dt>Sản phẩm</dt><dd>{num(q.quality.distinct_products, 0)}</dd></div>
            <div><dt>Người dùng</dt><dd>{num(q.quality.distinct_users, 0)}</dd></div>
            <div><dt>category_code rỗng</dt><dd>{num(q.quality.null_category_code, 0)}</dd></div>
            <div><dt>brand rỗng</dt><dd>{num(q.quality.null_brand, 0)}</dd></div>
            <div><dt>Giá bằng 0</dt><dd>{num(q.quality.zero_price, 0)}</dd></div>
          </dl>
        </section>
      )}

      {m && (
        <section>
          <h2>Artifact trong manifest</h2>
          <p className="note">Backend chỉ đọc file có trong danh sách này và kiểm sha256 trước khi dùng.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>File</th><th className="num">Số dòng</th><th className="num">Bytes</th><th>sha256</th></tr>
              </thead>
              <tbody>
                {m.files.map((f) => (
                  <tr key={f.path}>
                    <td>{f.path}</td>
                    <td className="num">{f.rows !== undefined ? num(f.rows, 0) : ""}</td>
                    <td className="num">{num(f.bytes, 0)}</td>
                    <td><code>{f.sha256.slice(0, 12)}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: value.length > 24 ? "0.95rem" : undefined }}>{value}</div>
    </div>
  );
}
