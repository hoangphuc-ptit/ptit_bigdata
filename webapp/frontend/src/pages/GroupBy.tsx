import ReactECharts from "../chart";
import { useState } from "react";
import { num, Row, TablePage } from "../api";
import { useGet } from "../hooks";
import { Source, useRun } from "../run";

/** Cột hiển thị: key = tên cột trong CSV serving; format đổi giá trị chuỗi sang chữ hiển thị. */
interface Column {
  key: string;
  label: string;
  format?: (v: string) => string;
  numeric?: boolean;
}
const count = (v: string) => num(v, 0);
const money = (v: string) => num(v, 2);
const minorMoney = (v: string) => (v === "" ? "—" : num(Number(v) / 100, 2));
const pct = (v: string) => (v === "" ? "—" : `${num(Number(v) * 100, 2)}%`);

/** Bảng có tìm kiếm/sắp xếp/phân trang phía backend. */
function DataTable({ table, columns, defaultSort }: { table: string; columns: Column[]; defaultSort: string }) {
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
  const show = (c: Column, r: Row) => (c.format ? c.format(r[c.key] ?? "") : r[c.key]);
  return (
    <>
      <div className="toolbar">
        <label>Tìm<input value={q} placeholder="mã, danh mục, brand" onChange={(e) => { setQ(e.target.value); setOffset(0); }} /></label>
        <label>
          Sắp xếp giảm dần theo
          <select value={sort} onChange={(e) => { setSort(e.target.value); setOffset(0); }}>
            {columns.filter((c) => c.numeric).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <div className="pager">
          <button className="secondary" aria-label="Trang trước" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>‹</button>
          {page.data && <span>{num(offset + 1, 0)}–{num(Math.min(offset + limit, page.data.total), 0)} trong {num(page.data.total, 0)}</span>}
          <button className="secondary" aria-label="Trang sau" disabled={!page.data || offset + limit >= page.data.total} onClick={() => setOffset(offset + limit)}>›</button>
        </div>
      </div>
      {page.error && <p className="error">{page.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr>{columns.map((c) => <th key={c.key} className={c.numeric ? "num" : ""}>{c.label}</th>)}</tr></thead>
          <tbody>
            {page.data?.rows.map((r, i) => (
              <tr key={i}>{columns.map((c) => <td key={c.key} className={c.numeric ? "num" : ""}>{show(c, r)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const REVENUE: Column[] = [
  { key: "group_key", label: "category_id" },
  { key: "category_code", label: "Danh mục" },
  { key: "total_revenue", label: "Doanh thu", format: money, numeric: true },
  { key: "purchase_count", label: "Lượt mua", format: count, numeric: true },
  { key: "average_revenue", label: "Giá trị TB", format: money, numeric: true },
];
const FUNNEL: Column[] = [
  { key: "category_id", label: "category_id" },
  { key: "category_code", label: "Danh mục" },
  { key: "views", label: "Xem", format: count, numeric: true },
  { key: "carts", label: "Thêm giỏ", format: count, numeric: true },
  { key: "purchases", label: "Mua", format: count, numeric: true },
  { key: "revenue_minor", label: "Doanh thu", format: minorMoney, numeric: true },
  { key: "view_to_purchase", label: "Mua / xem", format: pct, numeric: true },
  { key: "cart_to_purchase", label: "Mua / giỏ", format: (v) => num(v, 3), numeric: true },
];
const BRAND: Column[] = [
  { key: "brand", label: "Brand" },
  { key: "views", label: "Xem", format: count, numeric: true },
  { key: "carts", label: "Thêm giỏ", format: count, numeric: true },
  { key: "purchases", label: "Mua", format: count, numeric: true },
  { key: "revenue_minor", label: "Doanh thu", format: minorMoney, numeric: true },
  { key: "view_to_purchase", label: "Mua / xem", format: pct, numeric: true },
];

export default function GroupBy() {
  const { runId } = useRun();
  const top = useGet<TablePage>(runId ? `/api/analytics/${runId}/tables/revenue_by_category?sort=total_revenue&limit=15` : null);
  const trend = useGet<TablePage>(runId ? `/api/analytics/${runId}/tables/trend_by_hour?sort=event_date&order=asc&limit=5000` : null);
  const trendRows = [...(trend.data?.rows ?? [])].sort((a, b) =>
    (a.event_date + a.event_hour.padStart(2, "0")).localeCompare(b.event_date + b.event_hour.padStart(2, "0")),
  );
  return (
    <>
      <header className="page-head">
        <h1>Group By Aggregation</h1>
        <p className="lead">Các phép tổng hợp trên toàn bộ sự kiện của serving run, tính bằng Spark trên HDFS. Doanh thu chỉ tính từ purchase hợp lệ.</p>
      </header>
      <section>
        <div className="section-head">
          <h2>Doanh thu theo danh mục</h2>
          <span className="tag" title="Mã phép tổng hợp trong plan">A1</span>
        </div>
        <p className="note">15 category_id có doanh thu cao nhất. Danh mục trống là sản phẩm không có category_code trong dữ liệu gốc.</p>
        {top.error && <p className="error">{top.error}</p>}
        {top.data && (
          <ReactECharts
            style={{ height: 380 }}
            option={{
              tooltip: { trigger: "axis", valueFormatter: (v: number) => num(v, 2) },
              grid: { left: 200, right: 32, top: 16, bottom: 32 },
              xAxis: { type: "value", axisLabel: { formatter: (v: number) => (v >= 1e6 ? `${num(v / 1e6, 0)} tr` : num(v, 0)) } },
              yAxis: { type: "category", inverse: true, data: top.data.rows.map((r) => r.category_code || `(trống) ${r.group_key}`) },
              series: [{ type: "bar", barWidth: "60%", data: top.data.rows.map((r) => Number(r.total_revenue)) }],
            }}
          />
        )}
        <DataTable table="revenue_by_category" columns={REVENUE} defaultSort="total_revenue" />
        <Source text="Spark A1, khớp MapReduce V1 (trang Pipeline), analytics/revenue_by_category.csv" />
      </section>
      <section>
        <div className="section-head">
          <h2>Sự kiện và lượt mua theo giờ</h2>
          <span className="tag">A4</span>
        </div>
        <p className="note">Giờ theo UTC như trong dữ liệu gốc. Kéo thanh dưới biểu đồ để phóng to một khoảng thời gian.</p>
        {trend.error && <p className="error">{trend.error}</p>}
        {trend.data && (
          <ReactECharts
            style={{ height: 340 }}
            option={{
              tooltip: { trigger: "axis" },
              legend: { top: 0 },
              grid: { left: 64, right: 64, top: 40, bottom: 72 },
              xAxis: { type: "category", data: trendRows.map((r) => `${r.event_date} ${r.event_hour}h`) },
              yAxis: [{ type: "value", name: "sự kiện", axisLabel: { formatter: (v: number) => num(v, 0) } }, { type: "value", name: "lượt mua", axisLabel: { formatter: (v: number) => num(v, 0) } }],
              dataZoom: [{ type: "inside" }, { bottom: 16 }],
              series: [
                { name: "sự kiện", type: "line", showSymbol: false, data: trendRows.map((r) => Number(r.events)) },
                { name: "lượt mua", type: "line", yAxisIndex: 1, showSymbol: false, data: trendRows.map((r) => Number(r.purchases)) },
              ],
            }}
          />
        )}
        <Source text="Spark A4, analytics/trend_by_hour.csv" />
      </section>
      <section>
        <div className="section-head">
          <h2>Funnel xem, thêm giỏ, mua theo danh mục</h2>
          <span className="tag">A2, A3</span>
        </div>
        <p className="note">
          Mua / giỏ có thể lớn hơn 1 vì trong dữ liệu một lượt mua không bắt buộc đi qua sự kiện thêm giỏ; đây là tỷ số, không phải xác suất.
        </p>
        <DataTable table="funnel_by_category" columns={FUNNEL} defaultSort="purchases" />
        <Source text="Spark A2/A3, analytics/funnel_by_category.csv" />
      </section>
      <section>
        <div className="section-head">
          <h2>Theo brand</h2>
          <span className="tag">A5</span>
        </div>
        <p className="note">__UNKNOWN__ gom các sự kiện không có brand.</p>
        <DataTable table="funnel_by_brand" columns={BRAND} defaultSort="revenue_minor" />
        <Source text="Spark A5, analytics/funnel_by_brand.csv" />
      </section>
    </>
  );
}
