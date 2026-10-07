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

export default function Overview() {
  const { runId, runs, setRunId, error } = useRun();
  const manifest = useGet<Manifest>(runId ? `/api/runs/${runId}` : null);
  const parity = useGet<any>(runId ? `/api/analytics/${runId}/parity` : null);
  const quality = useGet<any>(runId ? `/api/analytics/${runId}/quality` : null);
  const m = manifest.data;
  return (
    <>
      <h1>Tổng quan pipeline</h1>
      {error && <p className="error">{error}</p>}
      <section>
        <div className="row">
          <label>
            Serving run
            <select value={runId ?? ""} onChange={(e) => setRunId(e.target.value)}>
              {runs.map((r) => (
                <option key={r.runId} value={r.runId}>
                  {r.runId}
                  {r.default ? " (mặc định)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="note">
          Luồng: Kaggle CSV → HDFS → Hadoop MapReduce (đối chứng) và Spark (ETL, Group By, đặc trưng) → notebook
          K-Means/KNN → publish serving → backend Spring Boot (chỉ đọc + suy luận) → trang này. Web không chạy job và
          không đọc dữ liệu thô.
        </p>
      </section>
      {m && (
        <section>
          <h2>Dữ liệu và nguồn</h2>
          <div className="grid">
            <Kpi label="Dataset" value={m.dataset.tag} />
            <Kpi label="Input HDFS" value={m.dataset.input} />
            <Kpi label="Số file serving" value={String(m.files.length)} />
            <Kpi label="Publish lúc" value={m.createdAt} />
            <Kpi label="git" value={m.gitSha} />
          </div>
          {quality.data && (
            <div className="grid" style={{ marginTop: 12 }}>
              <Kpi label="Dòng vào ETL" value={num(quality.data.rowsIn, 0)} />
              <Kpi label="Dòng hợp lệ" value={num(quality.data.rowsValid, 0)} />
              <Kpi label="Dòng bị loại" value={JSON.stringify(quality.data.rejected)} />
            </div>
          )}
        </section>
      )}
      {parity.data && (
        <section>
          <h2>
            Đối chiếu Group By A1: MapReduce V1 và Spark{" "}
            <span className={`badge ${parity.data.matched ? "ok" : "bad"}`}>
              {parity.data.matched ? "KHỚP TUYỆT ĐỐI" : `LỆCH ${parity.data.mismatchCount} nhóm`}
            </span>
          </h2>
          <p>
            MR: {num(parity.data.mrGroups, 0)} nhóm · Spark: {num(parity.data.sparkGroups, 0)} nhóm · tổng purchase hợp
            lệ {num(parity.data.mrPurchaseCount, 0)}. So khớp chính xác (tổng tiền theo đơn vị nhỏ nhất, số lượt, trung
            bình).
          </p>
          {!parity.data.matched && <pre className="error">{JSON.stringify(parity.data.mismatches, null, 2)}</pre>}
          <p className="source">MR output: {parity.data.mrOutput} · Spark A1 run: {parity.data.sparkRevenueRunId}</p>
        </section>
      )}
      {m && (
        <section>
          <h2>Artifact trong manifest</h2>
          <table>
            <thead>
              <tr><th>File</th><th>Số dòng</th><th>Bytes</th><th>sha256</th></tr>
            </thead>
            <tbody>
              {m.files.map((f) => (
                <tr key={f.path}>
                  <td>{f.path}</td>
                  <td className="num">{f.rows !== undefined ? num(f.rows, 0) : ""}</td>
                  <td className="num">{num(f.bytes, 0)}</td>
                  <td><code>{f.sha256.slice(0, 12)}…</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: value.length > 24 ? "0.85rem" : undefined }}>{value}</div>
    </div>
  );
}
