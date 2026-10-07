import ReactECharts from "echarts-for-react";
import { useState } from "react";
import { TablePage } from "../api";
import { useGet } from "../hooks";
import { Source, useRun } from "../run";

/** Bảng có tìm kiếm/sắp xếp/phân trang phía backend. */
function DataTable({ table, columns, defaultSort }: { table: string; columns: string[]; defaultSort: string }) {
  const { runId } = useRun();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const page = useGet<TablePage>(
    runId
      ? `/api/analytics/${runId}/tables/${table}?sort=${sort}&order=desc&limit=${limit}&offset=${offset}&q=${encodeURIComponent(q)}`
      : null,
  );
  return (
    <>
      <div className="row">
        <label>Tìm<input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} /></label>
        <label>
          Sắp xếp giảm dần theo
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {columns.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <button className="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>‹</button>
        <button className="secondary" disabled={!page.data || offset + limit >= page.data.total} onClick={() => setOffset(offset + limit)}>›</button>
        {page.data && <span className="note">{offset + 1}–{Math.min(offset + limit, page.data.total)} / {page.data.total}</span>}
      </div>
      {page.error && <p className="error">{page.error}</p>}
      <table>
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {page.data?.rows.map((r, i) => (
            <tr key={i}>{columns.map((c) => <td key={c} className={isNaN(Number(r[c])) || r[c] === "" ? "" : "num"}>{r[c]}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function GroupBy() {
  const { runId } = useRun();
  const top = useGet<TablePage>(runId ? `/api/analytics/${runId}/tables/revenue_by_category?sort=total_revenue&limit=15` : null);
  const trend = useGet<TablePage>(runId ? `/api/analytics/${runId}/tables/trend_by_hour?sort=event_date&order=asc&limit=5000` : null);
  const trendRows = [...(trend.data?.rows ?? [])].sort((a, b) =>
    (a.event_date + a.event_hour.padStart(2, "0")).localeCompare(b.event_date + b.event_hour.padStart(2, "0")),
  );
  return (
    <>
      <h1>Group By Aggregation</h1>
      <section>
        <h2>A1 — Doanh thu purchase theo category_id (top 15)</h2>
        {top.error && <p className="error">{top.error}</p>}
        {top.data && (
          <ReactECharts
            style={{ height: 360 }}
            option={{
              tooltip: { trigger: "axis" },
              grid: { left: 180, right: 24 },
              xAxis: { type: "value", name: "doanh thu" },
              yAxis: {
                type: "category",
                inverse: true,
                data: top.data.rows.map((r) => r.category_code || r.group_key),
              },
              series: [{ type: "bar", data: top.data.rows.map((r) => Number(r.total_revenue)) }],
            }}
          />
        )}
        <Source text="Spark A1 (khớp MapReduce V1, xem trang Tổng quan) · analytics/revenue_by_category.csv" />
        <DataTable table="revenue_by_category" columns={["group_key", "category_code", "total_revenue", "purchase_count", "average_revenue"]} defaultSort="total_revenue" />
      </section>
      <section>
        <h2>A4 — Sự kiện và purchase theo giờ (UTC)</h2>
        {trend.error && <p className="error">{trend.error}</p>}
        {trend.data && (
          <ReactECharts
            style={{ height: 320 }}
            option={{
              tooltip: { trigger: "axis" },
              legend: {},
              xAxis: { type: "category", data: trendRows.map((r) => `${r.event_date} ${r.event_hour}h`) },
              yAxis: [{ type: "value", name: "events" }, { type: "value", name: "purchases" }],
              dataZoom: [{ type: "inside" }, {}],
              series: [
                { name: "events", type: "line", showSymbol: false, data: trendRows.map((r) => Number(r.events)) },
                { name: "purchases", type: "line", yAxisIndex: 1, showSymbol: false, data: trendRows.map((r) => Number(r.purchases)) },
              ],
            }}
          />
        )}
        <Source text="Spark A4 · analytics/trend_by_hour.csv" />
      </section>
      <section>
        <h2>A2/A3 — Funnel view → cart → purchase theo danh mục</h2>
        <p className="note">
          view_to_purchase = purchases / views; cart_to_purchase = purchases / carts (có thể &gt; 1 vì purchase không
          bắt buộc có sự kiện cart trong dữ liệu).
        </p>
        <DataTable
          table="funnel_by_category"
          columns={["category_id", "category_code", "views", "carts", "purchases", "revenue", "view_to_purchase", "cart_to_purchase"]}
          defaultSort="purchases"
        />
        <Source text="Spark A2/A3 · analytics/funnel_by_category.csv" />
      </section>
      <section>
        <h2>A5 — Brand</h2>
        <DataTable table="funnel_by_brand" columns={["brand", "views", "carts", "purchases", "revenue", "view_to_purchase"]} defaultSort="revenue" />
        <Source text="Spark A5 · analytics/funnel_by_brand.csv" />
      </section>
    </>
  );
}
