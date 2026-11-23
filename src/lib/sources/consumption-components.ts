import type { Observation } from "../types";
import {
  ecosKeyIsSample,
  ecosSearch,
  ecosSearchPaged,
  periodFromEcosTime,
  shiftQuarter,
} from "./ecos";

export type ConsumptionComponentId =
  | "durable"
  | "semidurable"
  | "nondurable";

export type ConsumptionComponentSeries = {
  id: ConsumptionComponentId;
  nameKo: string;
  qoq: Observation[];
  yoy: Observation[];
};

const COMPONENTS: {
  id: ConsumptionComponentId;
  nameKo: string;
  itemCode: string;
}[] = [
  { id: "durable", nameKo: "내구재", itemCode: "10101" },
  { id: "semidurable", nameKo: "준내구재", itemCode: "10201" },
  { id: "nondurable", nameKo: "비내구재", itemCode: "10301" },
];

/** 가계 형태별 최종소비지출 — 계절조정·실질 (전기비용). */
const SA_REAL_TABLE = "200Y145";
/** 가계 형태별 최종소비지출 — 원계열·실질 (전년동기비용). */
const ORIG_REAL_TABLE = "200Y147";

function round1(n: number): number {
  return Number(n.toFixed(1));
}

function releaseGuess(period: string): string {
  const [y, q] = period.split("-Q").map(Number);
  const month = q === 1 ? 4 : q === 2 ? 7 : q === 3 ? 10 : 1;
  const year = q === 4 ? y + 1 : y;
  return `${year}-${String(month).padStart(2, "0")}-23`;
}

/** Display horizon for durability breakdown (years). */
export const CONSUMPTION_COMPONENT_YEARS = 10;

function shiftEcosQuarter(time: string, delta: number): string {
  const match = time.match(/^(\d{4})Q([1-4])$/);
  if (!match) return time;
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
  return `${y}Q${q}`;
}

async function fetchQuarterLevels(
  table: string,
  itemCode: string,
  _history: boolean,
): Promise<Map<string, number>> {
  const sample = ecosKeyIsSample();
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const end = `${now.getFullYear()}Q${q}`;
  // +4 quarters so YoY can be computed at the start of the 10y window.
  const back = CONSUMPTION_COMPONENT_YEARS * 4 + 4;
  const start = shiftEcosQuarter(end, -back);
  const map = new Map<string, number>();

  if (!sample) {
    const rows = await ecosSearchPaged([table, "Q", start, end, itemCode], {
      pageSize: 100,
      maxRows: CONSUMPTION_COMPONENT_YEARS * 4 + 8,
    });
    for (const row of rows) {
      const period = periodFromEcosTime(row.TIME);
      const value = Number(row.DATA_VALUE);
      if (Number.isFinite(value)) map.set(period, value);
    }
    return map;
  }

  // Sample key: ≤10 rows/call — walk windows newest-first and stitch.
  let windowEnd = end;
  for (let chunk = 0; chunk < 6; chunk += 1) {
    const windowStart = shiftEcosQuarter(windowEnd, -9);
    const rows = await ecosSearch(
      [table, "Q", windowStart, windowEnd, itemCode],
      { end: 10 },
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      const period = periodFromEcosTime(row.TIME);
      const value = Number(row.DATA_VALUE);
      if (Number.isFinite(value)) map.set(period, value);
    }
    const oldest = [...rows]
      .map((r) => r.TIME)
      .sort()[0];
    if (!oldest || oldest <= start) break;
    windowEnd = shiftEcosQuarter(oldest, -1);
    if (windowEnd < start) break;
  }
  return map;
}

function trimObservations(
  series: Observation[],
  maxYears: number,
): Observation[] {
  if (series.length === 0) return series;
  const sorted = [...series].sort((a, b) => a.period.localeCompare(b.period));
  const latest = sorted[sorted.length - 1].period;
  if (!latest.includes("-Q")) return sorted;
  const [y, q] = latest.split("-Q").map(Number);
  let yy = y;
  let qq = q;
  const back = maxYears * 4 - 1;
  for (let i = 0; i < back; i += 1) {
    qq -= 1;
    if (qq < 1) {
      qq = 4;
      yy -= 1;
    }
  }
  const floor = `${yy}-Q${qq}`;
  return sorted.filter((row) => row.period >= floor);
}

function toQoq(levels: Map<string, number>): Observation[] {
  const periods = [...levels.keys()].sort();
  const out: Observation[] = [];
  for (const period of periods) {
    const prevPeriod = shiftQuarter(period, -1);
    const curr = levels.get(period);
    const prev = levels.get(prevPeriod);
    if (curr === undefined || prev === undefined || prev === 0) continue;
    out.push({
      period,
      value: round1((curr / prev - 1) * 100),
      releasedAt: releaseGuess(period),
      sourceUrl: "https://ecos.bok.or.kr",
    });
  }
  return out;
}

function toYoy(levels: Map<string, number>): Observation[] {
  const periods = [...levels.keys()].sort();
  const out: Observation[] = [];
  for (const period of periods) {
    const prevPeriod = shiftQuarter(period, -4);
    const curr = levels.get(period);
    const prev = levels.get(prevPeriod);
    if (curr === undefined || prev === undefined || prev === 0) continue;
    out.push({
      period,
      value: round1((curr / prev - 1) * 100),
      releasedAt: releaseGuess(period),
      sourceUrl: "https://ecos.bok.or.kr",
    });
  }
  return out;
}

export async function fetchConsumptionComponents(
  history = true,
): Promise<ConsumptionComponentSeries[]> {
  const out: ConsumptionComponentSeries[] = [];
  const throttleMs = ecosKeyIsSample() ? 0 : 350;
  for (const component of COMPONENTS) {
    const saLevels = await fetchQuarterLevels(
      SA_REAL_TABLE,
      component.itemCode,
      history,
    );
    if (throttleMs) await new Promise((r) => setTimeout(r, throttleMs));
    const origLevels = await fetchQuarterLevels(
      ORIG_REAL_TABLE,
      component.itemCode,
      history,
    );
    out.push({
      id: component.id,
      nameKo: component.nameKo,
      qoq: trimObservations(toQoq(saLevels), CONSUMPTION_COMPONENT_YEARS),
      yoy: trimObservations(toYoy(origLevels), CONSUMPTION_COMPONENT_YEARS),
    });
    if (throttleMs) await new Promise((r) => setTimeout(r, throttleMs));
  }
  return out;
}
