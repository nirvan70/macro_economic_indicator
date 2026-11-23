import type { ChartSeries } from "@/components/MultiSeriesChart";
import { triggerDownload } from "@/lib/chart-export";

export type ChartDataFormat = "xlsx" | "csv" | "txt" | "json";

export type ChartDataTable = {
  headers: string[];
  /** Each row: [period, ...series values as string | number | null] */
  rows: (string | number | null)[][];
  meta: { label: string; value: string }[];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function safeBasename(basename: string): string {
  return basename
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

/** Build a period × series table from chart series used in the graph. */
export function buildChartDataTable(
  series: ChartSeries[],
  meta: { label: string; value: string }[] = [],
): ChartDataTable {
  const periodSet = new Set<string>();
  for (const s of series) {
    for (const obs of s.observations) periodSet.add(obs.period);
  }
  const periods = [...periodSet].sort((a, b) => a.localeCompare(b));
  const maps = series.map(
    (s) => new Map(s.observations.map((o) => [o.period, o.value])),
  );

  const headers = [
    "기간",
    ...series.map((s) => (s.unit ? `${s.label} (${s.unit})` : s.label)),
  ];
  const rows = periods.map((period) => [
    period,
    ...maps.map((m) => {
      const v = m.get(period);
      return v === undefined ? null : v;
    }),
  ]);

  return { headers, rows, meta };
}

function toCsv(table: ChartDataTable): string {
  const metaLines = table.meta.map(
    (m) => `${csvCell(m.label)},${csvCell(m.value)}`,
  );
  const body = [
    ...metaLines,
    ...(metaLines.length ? [""] : []),
    table.headers.map(csvCell).join(","),
    ...table.rows.map((row) => row.map(csvCell).join(",")),
  ];
  return body.join("\r\n");
}

function toTxt(table: ChartDataTable): string {
  const lines: string[] = [];
  for (const m of table.meta) {
    lines.push(`${m.label}: ${m.value}`);
  }
  if (table.meta.length) lines.push("");
  lines.push(table.headers.join("\t"));
  for (const row of table.rows) {
    lines.push(row.map((c) => (c === null ? "" : String(c))).join("\t"));
  }
  return `${lines.join("\n")}\n`;
}

function toJson(table: ChartDataTable): string {
  const columns = table.headers.slice(1);
  const records = table.rows.map((row) => {
    const period = String(row[0] ?? "");
    const values: Record<string, number | null> = {};
    columns.forEach((col, i) => {
      const v = row[i + 1];
      values[col] = typeof v === "number" ? v : null;
    });
    return { period, values };
  });
  return `${JSON.stringify({ meta: table.meta, series: columns, data: records }, null, 2)}\n`;
}

/** Excel-compatible SpreadsheetML (.xls that Excel opens). */
function toSpreadsheetMl(table: ChartDataTable): string {
  const rowsXml: string[] = [];

  for (const m of table.meta) {
    rowsXml.push(
      `<Row><Cell ss:StyleID="Meta"><Data ss:Type="String">${escapeXml(m.label)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(m.value)}</Data></Cell></Row>`,
    );
  }
  if (table.meta.length) {
    rowsXml.push("<Row/>");
  }

  rowsXml.push(
    `<Row>${table.headers
      .map(
        (h) =>
          `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`,
      )
      .join("")}</Row>`,
  );

  for (const row of table.rows) {
    const cells = row
      .map((cell, i) => {
        if (cell === null || cell === undefined) {
          return "<Cell/>";
        }
        if (i > 0 && typeof cell === "number") {
          return `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`;
        }
        return `<Cell><Data ss:Type="String">${escapeXml(String(cell))}</Data></Cell>`;
      })
      .join("");
    rowsXml.push(`<Row>${cells}</Row>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#EEF2F0" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Meta"><Font ss:Color="#64748B"/></Style>
 </Styles>
 <Worksheet ss:Name="차트데이터">
  <Table>${rowsXml.join("")}</Table>
 </Worksheet>
</Workbook>
`;
}

export const CHART_DATA_DOWNLOAD_FORMATS: {
  id: ChartDataFormat;
  label: string;
}[] = [
  { id: "xlsx", label: "Excel" },
  { id: "csv", label: "CSV" },
  { id: "txt", label: "TXT" },
  { id: "json", label: "JSON" },
];

export function downloadChartData(
  series: ChartSeries[],
  format: ChartDataFormat,
  basename: string,
  meta: { label: string; value: string }[] = [],
): void {
  const table = buildChartDataTable(series, meta);
  const safe = safeBasename(basename) || "chart_data";

  if (format === "xlsx") {
    // SpreadsheetML; Excel opens this as a workbook.
    const xml = toSpreadsheetMl(table);
    triggerDownload(
      new Blob([xml], { type: "application/vnd.ms-excel" }),
      `${safe}.xls`,
    );
    return;
  }

  if (format === "csv") {
    // UTF-8 BOM so Excel on Windows keeps Korean intact.
    const csv = `\uFEFF${toCsv(table)}`;
    triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${safe}.csv`);
    return;
  }

  if (format === "txt") {
    triggerDownload(
      new Blob([toTxt(table)], { type: "text/plain;charset=utf-8" }),
      `${safe}.txt`,
    );
    return;
  }

  triggerDownload(
    new Blob([toJson(table)], { type: "application/json;charset=utf-8" }),
    `${safe}.json`,
  );
}
