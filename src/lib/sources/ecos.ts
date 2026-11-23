import { env } from "../env";

export type EcosRow = {
  TIME: string;
  DATA_VALUE: string;
  UNIT_NAME?: string;
  ITEM_NAME1?: string;
  ITEM_NAME2?: string;
};

type EcosSearchResponse = {
  RESULT?: { CODE: string; MESSAGE: string };
  StatisticSearch?: {
    list_total_count: number;
    row: EcosRow | EcosRow[];
  };
};

export function ecosApiKey(): string {
  return env("ECOS_API_KEY", env("BOK_API_KEY", "sample"));
}

export function ecosKeyIsSample(key = ecosApiKey()): boolean {
  return key === "sample" || key.length === 0;
}

function asRows(row: EcosRow | EcosRow[] | undefined): EcosRow[] {
  if (!row) return [];
  return Array.isArray(row) ? row : [row];
}

/** ECOS StatisticSearch — path segments after language/paging. */
export async function ecosSearch(
  segments: string[],
  opts?: { start?: number; end?: number },
): Promise<EcosRow[]> {
  const key = ecosApiKey();
  const start = opts?.start ?? 1;
  const end = opts?.end ?? (ecosKeyIsSample(key) ? 10 : 120);
  const url = [
    "https://ecos.bok.or.kr/api/StatisticSearch",
    encodeURIComponent(key),
    "json",
    "kr",
    String(start),
    String(end),
    ...segments.map((s) => encodeURIComponent(s)),
  ].join("/");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`ECOS HTTP ${res.status} for ${segments.join("/")}`);
  }
  const data = (await res.json()) as EcosSearchResponse;
  if (data.RESULT) {
    throw new Error(`ECOS ${data.RESULT.CODE}: ${data.RESULT.MESSAGE}`);
  }
  return asRows(data.StatisticSearch?.row);
}

/** Page through StatisticSearch until exhausted (sample key stops at 10). */
export async function ecosSearchPaged(
  segments: string[],
  opts?: { pageSize?: number; maxRows?: number },
): Promise<EcosRow[]> {
  const key = ecosApiKey();
  if (ecosKeyIsSample(key)) {
    return ecosSearch(segments, { start: 1, end: 10 });
  }
  const pageSize = opts?.pageSize ?? 100;
  const maxRows = opts?.maxRows ?? 4000;
  const all: EcosRow[] = [];
  let start = 1;
  while (all.length < maxRows) {
    const end = start + pageSize - 1;
    try {
      const rows = await ecosSearch(segments, { start, end });
      all.push(...rows);
      if (rows.length < pageSize) break;
      start += pageSize;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Past the last page ECOS often returns INFO-200 instead of an empty row set.
      if (message.includes("INFO-200") && all.length > 0) break;
      throw error;
    }
  }
  return all.slice(0, maxRows);
}

export function periodFromEcosTime(time: string): string {
  if (/^\d{8}$/.test(time)) {
    return `${time.slice(0, 4)}-${time.slice(4, 6)}-${time.slice(6, 8)}`;
  }
  if (/^\d{6}$/.test(time)) {
    return `${time.slice(0, 4)}-${time.slice(4, 6)}`;
  }
  if (/^\d{4}Q[1-4]$/.test(time)) {
    return `${time.slice(0, 4)}-${time.slice(4)}`;
  }
  return time;
}

export function yyyymm(period: string): string {
  return period.replace("-", "");
}

export function shiftMonth(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export function shiftQuarter(period: string, delta: number): string {
  const match = period.match(/^(\d{4})-Q([1-4])$/);
  if (!match) return period;
  let y = Number(match[1]);
  let q = Number(match[2]) + delta;
  while (q < 1) {
    q += 4;
    y -= 1;
  }
  while (q > 4) {
    q -= 4;
    y += 1;
  }
  return `${y}-Q${q}`;
}
