import { env } from "../env";
import { periodFromCustomsYear, toEokUsd } from "./customs";

export type ItemTradeRaw = {
  year: string;
  hsCode: string;
  statKor?: string;
  expDlr: string | number;
  impDlr: string | number;
  balPayments: string | number;
};

export type TradeItemAgg = {
  period: string;
  hsCode: string;
  nameKo: string;
  expEok: number;
  impEok: number;
  balEok: number;
};

/** 주요 수출입 품목(HS 4단위) — 한국 무역 모니터링용 */
export const TRACKED_HS4: { code: string; nameKo: string }[] = [
  { code: "8542", nameKo: "반도체(집적회로)" },
  { code: "8703", nameKo: "승용차" },
  { code: "8708", nameKo: "자동차부품" },
  { code: "2710", nameKo: "석유제품" },
  { code: "8471", nameKo: "컴퓨터·주변기기" },
  { code: "9013", nameKo: "액정·광학소자" },
  { code: "8507", nameKo: "축전지" },
  { code: "8901", nameKo: "여객선·화물선" },
  { code: "2902", nameKo: "환식탄화수소" },
  { code: "3004", nameKo: "의약품" },
  { code: "7208", nameKo: "철강 평판압연" },
  { code: "3901", nameKo: "에틸렌 폴리머" },
];

export function itemTradeServiceKey(): string {
  return env(
    "DATA_GO_KR_ITEM_TRADE_KEY",
    env("CUSTOMS_ITEM_API_KEY", env("DATA_GO_KR_SERVICE_KEY")),
  );
}

function parseItemsXml(text: string): ItemTradeRaw[] {
  const rows: ItemTradeRaw[] = [];
  for (const block of text.split(/<item>/i).slice(1)) {
    const year = block.match(/<year>([^<]*)<\/year>/i)?.[1]?.trim();
    const hsCode = block.match(/<hsCode>([^<]*)<\/hsCode>/i)?.[1]?.trim();
    const statKor = block.match(/<statKor>([^<]*)<\/statKor>/i)?.[1]?.trim();
    const expDlr = block.match(/<expDlr>([^<]*)<\/expDlr>/i)?.[1]?.trim();
    const impDlr = block.match(/<impDlr>([^<]*)<\/impDlr>/i)?.[1]?.trim();
    const bal = block.match(/<balPayments>([^<]*)<\/balPayments>/i)?.[1]?.trim();
    if (!year || year.includes("총계") || !hsCode) continue;
    rows.push({
      year,
      hsCode,
      statKor,
      expDlr: expDlr ?? "0",
      impDlr: impDlr ?? "0",
      balPayments: bal ?? "0",
    });
  }
  return rows;
}

function num(v: string | number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 관세청 품목별 수출입실적 (Itemtrade). */
export async function fetchItemTradeRaw(
  startYymm: string,
  endYymm: string,
  hsSgn: string,
): Promise<ItemTradeRaw[]> {
  const serviceKey = itemTradeServiceKey();
  if (!serviceKey) {
    throw new Error("DATA_GO_KR_ITEM_TRADE_KEY is not set");
  }

  const url = new URL(
    "https://apis.data.go.kr/1220000/Itemtrade/getItemtradeList",
  );
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("strtYymm", startYymm);
  url.searchParams.set("endYymm", endYymm);
  url.searchParams.set("hsSgn", hsSgn);
  url.searchParams.set("numOfRows", "1000");
  url.searchParams.set("pageNo", "1");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Itemtrade HTTP ${res.status}`);
  const text = await res.text();
  if (text.includes("<resultCode>") && !text.includes("<resultCode>00</resultCode>")) {
    const code = text.match(/<resultCode>([^<]*)<\/resultCode>/)?.[1];
    const msg = text.match(/<resultMsg>([^<]*)<\/resultMsg>/)?.[1];
    throw new Error(`Itemtrade API ${code}: ${msg}`);
  }
  return parseItemsXml(text);
}

function yyyymm(period: string): string {
  return period.replace("-", "");
}

function monthPeriods(count: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  return out.reverse();
}

function shiftMonthPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthDistance(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return Math.abs((ay - by) * 12 + (am - bm));
}

/** Customs item API allows roughly 1-year windows — split if needed. */
function chunkPeriods(periods: string[]): string[][] {
  const sorted = [...new Set(periods)].sort();
  if (sorted.length === 0) return [];
  const chunks: string[][] = [];
  let current: string[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    if (monthDistance(current[0], sorted[i]) > 11) {
      chunks.push(current);
      current = [sorted[i]];
    } else {
      current.push(sorted[i]);
    }
  }
  chunks.push(current);
  return chunks;
}

async function aggregateForPeriods(periods: string[]): Promise<TradeItemAgg[]> {
  if (periods.length === 0) return [];
  const wanted = new Set(periods);
  const byKey = new Map<string, TradeItemAgg>();

  for (const chunk of chunkPeriods([...wanted])) {
    const sorted = [...chunk].sort();
    const start = yyyymm(sorted[0]);
    const end = yyyymm(sorted[sorted.length - 1]);

    for (const { code, nameKo } of TRACKED_HS4) {
      const rows = await fetchItemTradeRaw(start, end, code);
      for (const row of rows) {
        const period = periodFromCustomsYear(row.year);
        if (!wanted.has(period)) continue;
        const key = `${period}|${code}`;
        const prev = byKey.get(key) ?? {
          period,
          hsCode: code,
          nameKo,
          expEok: 0,
          impEok: 0,
          balEok: 0,
        };
        prev.expEok += num(row.expDlr) / 100_000_000;
        prev.impEok += num(row.impDlr) / 100_000_000;
        prev.balEok += num(row.balPayments) / 100_000_000;
        byKey.set(key, prev);
      }
    }
  }

  return [...byKey.values()]
    .map((row) => ({
      ...row,
      expEok: Number(row.expEok.toFixed(1)),
      impEok: Number(row.impEok.toFixed(1)),
      balEok: Number(row.balEok.toFixed(1)),
    }))
    .sort((a, b) =>
      a.period === b.period
        ? b.expEok - a.expEok
        : a.period.localeCompare(b.period),
    );
}

/** Aggregate tracked HS4 codes over recent months. */
export async function fetchTrackedItemTrade(
  months = 3,
): Promise<TradeItemAgg[]> {
  return aggregateForPeriods(monthPeriods(months));
}

/** Fetch selected month + previous month + year-ago month. */
export async function fetchTrackedItemTradeAroundPeriod(
  period: string,
): Promise<TradeItemAgg[]> {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error(`Invalid period: ${period}`);
  }
  const prev = shiftMonthPeriod(period, -1);
  const yoy = shiftMonthPeriod(period, -12);
  return aggregateForPeriods([yoy, prev, period]);
}

export function summarizeItemMovers(
  items: TradeItemAgg[],
): { headline: string; detail: string } | null {
  const periods = [...new Set(items.map((i) => i.period))].sort();
  if (periods.length < 2) return null;
  const latest = periods[periods.length - 1];
  const prev = periods[periods.length - 2];
  const latestRows = items.filter((i) => i.period === latest);
  const prevMap = new Map(
    items.filter((i) => i.period === prev).map((i) => [i.hsCode, i]),
  );

  const movers = latestRows
    .map((row) => {
      const before = prevMap.get(row.hsCode);
      const dExp = before ? row.expEok - before.expEok : row.expEok;
      return { ...row, dExp: Number(dExp.toFixed(1)) };
    })
    .sort((a, b) => Math.abs(b.dExp) - Math.abs(a.dExp));

  const top = movers.slice(0, 3);
  if (top.length === 0) return null;

  const parts = top.map(
    (m) =>
      `${m.nameKo} 수출 ${m.dExp > 0 ? "+" : ""}${m.dExp}억달러(전월비)`,
  );
  return {
    headline: `${latest} 품목별 수출 움직임`,
    detail: parts.join(" · "),
  };
}

export { toEokUsd };
