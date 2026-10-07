import ReactECharts from "echarts-for-react";
import { num } from "../api";
import { useGet } from "../hooks";
import { useRun } from "../run";

/** Định dạng benchmarks/<name>.json do bước tổng hợp giai đoạn 3 tạo (docs/evidence/bench). */
interface Benchmark {
  experiment: string;
  title: string;
  dataset: string;
  scope: string;
  metric: string;
  unit: string;
  rows: { label: string; median: number; min: number; max: number; runs: number; details?: Record<string, unknown> }[];
  notes?: string[];
  source: string;
}

function BenchmarkCard({ name }: { name: string }) {
  const { runId } = useRun();
  const b = useGet<Benchmark>(runId ? `/api/analytics/${runId}/benchmarks/${name}` : null);
  if (b.error) return <section><p className="error">{b.error}</p></section>;
  if (!b.data) return null;
  const d = b.data;
  return (
    <section>
      <h2>{d.experiment} — {d.title}</h2>
      <p className="note">Dữ liệu: {d.dataset} · Phạm vi đo: {d.scope}</p>
      <ReactECharts
        style={{ height: Math.max(220, d.rows.length * 34 + 60) }}
        option={{
          tooltip: {
            trigger: "axis",
            formatter: (p: any[]) => {
              const r = d.rows[p[0].dataIndex];
              return `${r.label}<br/>median ${num(r.median, 0)} ${d.unit} (min ${num(r.min, 0)} – max ${num(r.max, 0)}), ${r.runs} lần đo`;
            },
          },
          grid: { left: 200, right: 40 },
          xAxis: { type: "value", name: `${d.metric} (${d.unit})` },
          yAxis: { type: "category", inverse: true, data: d.rows.map((r) => r.label) },
          series: [
            { type: "bar", data: d.rows.map((r) => r.median), name: "median" },
            {
              // thanh min–max quanh median
              type: "custom",
              renderItem: (_: unknown, api: any) => {
                const i = api.value(0);
                const lo = api.coord([api.value(1), i]);
                const hi = api.coord([api.value(2), i]);
                return { type: "line", shape: { x1: lo[0], y1: lo[1], x2: hi[0], y2: hi[1] }, style: { stroke: "#1d2330", lineWidth: 2 } };
              },
              encode: { x: [1, 2], y: 0 },
              data: d.rows.map((r, i) => [i, r.min, r.max]),
              z: 10,
            },
          ],
        }}
      />
      <table>
        <thead><tr><th>Cấu hình</th><th>Median</th><th>Min</th><th>Max</th><th>Số lần đo</th></tr></thead>
        <tbody>
          {d.rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="num">{num(r.median, 0)}</td>
              <td className="num">{num(r.min, 0)}</td>
              <td className="num">{num(r.max, 0)}</td>
              <td className="num">{r.runs}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {d.notes?.map((n) => <p key={n} className="warn">{n}</p>)}
      <p className="source">Nguồn: {d.source}</p>
    </section>
  );
}

export default function Benchmarks() {
  const { runId } = useRun();
  const list = useGet<string[]>(runId ? `/api/analytics/${runId}/benchmarks` : null);
  return (
    <>
      <h1>Hadoop MapReduce và Spark: tính đúng và hiệu năng</h1>
      <section>
        <p className="warn">
          Phạm vi: một máy (Windows 11, 4 nhân/8 luồng, RAM 7,9 GB), HDFS 1 NameNode + 1 DataNode trong Docker.
          MapReduce chạy LocalJobRunner (không YARN), Spark chạy local[n]. Kết quả chỉ áp dụng cho cấu hình này, không
          phải hiệu năng cụm và không kết luận chung “Spark nhanh hơn Hadoop”.
        </p>
        <p className="note">Mỗi cấu hình: 1 lần warmup (không tính) + ít nhất 3 lần đo; hiển thị median và min–max.</p>
      </section>
      {list.error && <p className="error">{list.error}</p>}
      {list.data?.length === 0 && <p className="note">Serving run này chưa có benchmark.</p>}
      {list.data?.map((name) => <BenchmarkCard key={name} name={name} />)}
    </>
  );
}
