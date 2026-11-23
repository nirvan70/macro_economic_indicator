import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Observation } from "../types";

const execFileAsync = promisify(execFile);

type FredCsvRow = { date: string; value: number };

function roundN(n: number, digits: number): number {
  return Number(n.toFixed(digits));
}

function toPeriod(
  iso: string,
  kind: "daily" | "monthly" | "quarterly",
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m] = iso.split("-").map(Number);
  if (kind === "daily") return iso;
  if (kind === "monthly") return `${y}-${String(m).padStart(2, "0")}`;
  const q = Math.floor((m - 1) / 3) + 1;
  return `${y}-Q${q}`;
}

/** curl is more reliable than Node fetch/http2 against fred.stlouisfed.org here. */
async function fetchFredCsv(seriesId: string): Promise<FredCsvRow[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const { stdout } = await execFileAsync(
    "curl",
    ["-fsSL", "--max-time", "60", url],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  const lines = stdout.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const out: FredCsvRow[] = [];
  for (const line of lines.slice(1)) {
    const [date, raw] = line.split(",");
    if (!date || raw === undefined || raw === "." || raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    out.push({ date, value });
  }
  return out;
}

function cutoffIso(yearsBack: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - yearsBack);
  return d.toISOString().slice(0, 10);
}

/** Level series from FRED CSV (no API key required). */
export async function fetchFredLevelSeries(
  seriesId: string,
  opts: {
    yearsBack: number;
    digits: number;
    forceKind: "daily" | "monthly" | "quarterly";
  },
): Promise<Observation[]> {
  const rows = await fetchFredCsv(seriesId);
  const cutoff = cutoffIso(opts.yearsBack);
  const map = new Map<string, Observation>();
  for (const row of rows) {
    if (row.date < cutoff) continue;
    const period = toPeriod(row.date, opts.forceKind);
    if (!period) continue;
    map.set(period, {
      period,
      value: roundN(row.value, opts.digits),
      releasedAt: row.date,
      sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
    });
  }
  return [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
}

/** YoY % from a FRED monthly index series (e.g. CPIAUCSL). */
export async function fetchFredYoySeries(
  seriesId: string,
  opts: { yearsBack: number; digits?: number },
): Promise<Observation[]> {
  const digits = opts.digits ?? 1;
  const rows = await fetchFredCsv(seriesId);
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    byMonth.set(month, row.value);
  }
  const months = [...byMonth.keys()].sort();
  const cutoff = cutoffIso(opts.yearsBack).slice(0, 7);
  const out: Observation[] = [];
  for (const month of months) {
    if (month < cutoff) continue;
    const [y, m] = month.split("-").map(Number);
    const prev = `${y - 1}-${String(m).padStart(2, "0")}`;
    const curr = byMonth.get(month);
    const base = byMonth.get(prev);
    if (curr === undefined || base === undefined || base === 0) continue;
    out.push({
      period: month,
      value: roundN((curr / base - 1) * 100, digits),
      releasedAt: `${month}-15`,
      sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
    });
  }
  return out;
}
