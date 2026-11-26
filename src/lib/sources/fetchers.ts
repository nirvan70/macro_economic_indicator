import type { IndicatorId, Observation } from "../types";
import {
  customsServiceKey,
  fetchCustomsTrade,
  periodFromCustomsYear,
  toEokUsd,
} from "./customs";
import { itemTradeServiceKey } from "./customs-items";
import {
  ecosApiKey,
  ecosKeyIsSample,
  ecosSearch,
  ecosSearchPaged,
  periodFromEcosTime,
  shiftMonth,
  yyyymm,
} from "./ecos";
import { fetchFedwatchHikeSeries } from "./fedwatch";
import { fetchFredLevelSeries, fetchFredYoySeries } from "./fred";
import { fetchYahooIndexSeries } from "./yahoo-finance";

function round1(n: number): number {
  return Number(n.toFixed(1));
}

function roundN(n: number, digits: number): number {
  return Number(n.toFixed(digits));
}

function releaseGuess(period: string, day = 15): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return period;
  }
  if (period.includes("Q")) {
    const [y, q] = period.split("-Q").map(Number);
    const month = q === 1 ? 4 : q === 2 ? 7 : q === 3 ? 10 : 1;
    const year = q === 4 ? y + 1 : y;
    return `${year}-${String(month).padStart(2, "0")}-23`;
  }
  const next = shiftMonth(period, 1);
  return `${next}-${String(day).padStart(2, "0")}`;
}

function dayWindow(daysBack: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - daysBack);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

/** Daily level series from ECOS (FX, equities, market rates). */
async function fetchDailyLevelSeries(
  statCode: string,
  itemCode: string,
  history: boolean,
  digits: number,
): Promise<Observation[]> {
  const sample = ecosKeyIsSample();
  // ~20y; fetch by calendar year so long windows do not fail for some items.
  const days = sample ? 20 : history ? 7500 : 5200;
  const { start, end } = dayWindow(days);
  const startYear = Number(start.slice(0, 4));
  const endYear = Number(end.slice(0, 4));
  const rows = [];
  for (let y = startYear; y <= endYear; y += 1) {
    const chunkStart = y === startYear ? start : `${y}0101`;
    const chunkEnd = y === endYear ? end : `${y}1231`;
    try {
      const part = await ecosSearchPaged(
        [statCode, "D", chunkStart, chunkEnd, itemCode],
        {
          pageSize: sample ? 10 : 100,
          maxRows: sample ? 10 : 400,
        },
      );
      rows.push(...part);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("INFO-200")) throw error;
    }
    if (sample) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  const byTime = new Map(rows.map((row) => [row.TIME, row]));
  return [...byTime.values()]
    .sort((a, b) => a.TIME.localeCompare(b.TIME))
    .map((row) => {
      const period = periodFromEcosTime(row.TIME);
      return {
        period,
        value: roundN(Number(row.DATA_VALUE), digits),
        releasedAt: releaseGuess(period),
        sourceUrl: "https://ecos.bok.or.kr",
      };
    })
    .filter((o) => Number.isFinite(o.value));
}

function monthWindow(monthsBack: number): { start: string; end: string } {
  const now = new Date();
  const endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const startDate = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - monthsBack, 1),
  );
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start: fmt(startDate), end: fmt(endDate) };
}

function quarterWindow(quartersBack: number): { start: string; end: string } {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  let y = now.getFullYear();
  let qq = q;
  const end = `${y}Q${qq}`;
  for (let i = 0; i < quartersBack; i += 1) {
    qq -= 1;
    if (qq < 1) {
      qq = 4;
      y -= 1;
    }
  }
  return { start: `${y}Q${qq}`, end };
}

async function fetchMonthlyIndex(
  segments: string[],
  monthsBack: number,
  pageEnd?: number,
) {
  const { start, end } = monthWindow(monthsBack);
  return ecosSearch([...segments.slice(0, 1), "M", start, end, ...segments.slice(1)], {
    end: pageEnd,
  });
}

/** CPI YoY % from ECOS CPI index 901Y009 / 0. */
export async function fetchCpiSeries(history: boolean): Promise<Observation[]> {
  const sample = ecosKeyIsSample();
  // sample returns the first N rows of the range, so keep windows short and end-anchored.
  if (sample) {
    const recent = await fetchMonthlyIndex(["901Y009", "0"], 9, 10);
    const prior = await fetchMonthlyIndex(["901Y009", "0"], 21, 10);
    const index = new Map<string, number>();
    for (const row of [...prior, ...recent]) {
      index.set(periodFromEcosTime(row.TIME), Number(row.DATA_VALUE));
    }
    const out: Observation[] = [];
    for (const period of [...index.keys()].sort()) {
      const curr = index.get(period);
      const prev = index.get(shiftMonth(period, -12));
      if (curr === undefined || prev === undefined || prev === 0) continue;
      // Only keep YoY for the recent window months.
      const recentPeriods = new Set(
        recent.map((r) => periodFromEcosTime(r.TIME)),
      );
      if (!recentPeriods.has(period)) continue;
      out.push({
        period,
        value: round1((curr / prev - 1) * 100),
        releasedAt: releaseGuess(period, 2),
        sourceUrl: "https://ecos.bok.or.kr",
      });
    }
    return out;
  }

  const months = history ? 252 : 240;
  const rows = await fetchMonthlyIndex(
    ["901Y009", "0"],
    months,
    history ? 280 : 260,
  );
  const index = new Map<string, number>();
  for (const row of rows) {
    index.set(periodFromEcosTime(row.TIME), Number(row.DATA_VALUE));
  }
  const out: Observation[] = [];
  for (const period of [...index.keys()].sort()) {
    const curr = index.get(period);
    const prev = index.get(shiftMonth(period, -12));
    if (curr === undefined || prev === undefined || prev === 0) continue;
    out.push({
      period,
      value: round1((curr / prev - 1) * 100),
      releasedAt: releaseGuess(period, 2),
      sourceUrl: "https://ecos.bok.or.kr",
    });
  }
  return out;
}

async function fetchMonthlyIndexMom(
  segments: string[],
  history: boolean,
  releaseDay: number,
): Promise<Observation[]> {
  const sample = ecosKeyIsSample();
  const months = sample ? 9 : history ? 252 : 240;
  const rows = await fetchMonthlyIndex(
    segments,
    months,
    sample ? 10 : history ? 280 : 260,
  );
  const sorted = [...rows].sort((a, b) => a.TIME.localeCompare(b.TIME));
  const out: Observation[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = Number(sorted[i - 1].DATA_VALUE);
    const curr = Number(sorted[i].DATA_VALUE);
    if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev === 0) continue;
    const period = periodFromEcosTime(sorted[i].TIME);
    out.push({
      period,
      value: round1((curr / prev - 1) * 100),
      releasedAt: releaseGuess(period, releaseDay),
      sourceUrl: "https://ecos.bok.or.kr",
    });
  }
  return out;
}

/** Retail dual-chart horizon (years). Industrial keeps a longer MoM window. */
const RETAIL_YEARS = 10;
const INDUSTRIAL_YEARS = 20;

function shiftYyyymm(yyyymm: string, delta: number): string {
  const y = Number(yyyymm.slice(0, 4));
  const m = Number(yyyymm.slice(4, 6));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function fetchMonthlyLevelsChunked(
  segments: string[],
  monthsBack: number,
): Promise<Map<string, number>> {
  const sample = ecosKeyIsSample();
  const now = new Date();
  const end = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const start = shiftYyyymm(end, -monthsBack);
  const index = new Map<string, number>();
  const pathTail = segments;

  if (!sample) {
    const rows = await ecosSearchPaged(
      [pathTail[0], "M", start, end, ...pathTail.slice(1)],
      { pageSize: 100, maxRows: monthsBack + 8 },
    );
    for (const row of rows) {
      const value = Number(row.DATA_VALUE);
      if (Number.isFinite(value)) {
        index.set(periodFromEcosTime(row.TIME), value);
      }
    }
    return index;
  }

  let windowEnd = end;
  const maxChunks = Math.ceil(monthsBack / 9) + 1;
  for (let chunk = 0; chunk < maxChunks; chunk += 1) {
    const windowStart = shiftYyyymm(windowEnd, -9);
    const rows = await ecosSearch(
      [pathTail[0], "M", windowStart, windowEnd, ...pathTail.slice(1)],
      { end: 10 },
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      const value = Number(row.DATA_VALUE);
      if (Number.isFinite(value)) {
        index.set(periodFromEcosTime(row.TIME), value);
      }
    }
    const oldest = [...rows].map((r) => r.TIME).sort()[0];
    if (!oldest || oldest <= start) break;
    windowEnd = shiftYyyymm(oldest, -1);
    if (windowEnd < start) break;
  }
  return index;
}

function levelsToMom(
  levels: Map<string, number>,
  releaseDay: number,
): Observation[] {
  const periods = [...levels.keys()].sort();
  const out: Observation[] = [];
  for (let i = 1; i < periods.length; i += 1) {
    const prev = levels.get(periods[i - 1]);
    const curr = levels.get(periods[i]);
    if (prev === undefined || curr === undefined || prev === 0) continue;
    const period = periods[i];
    out.push({
      period,
      value: round1((curr / prev - 1) * 100),
      releasedAt: releaseGuess(period, releaseDay),
      sourceUrl: "https://ecos.bok.or.kr",
    });
  }
  return out;
}

function levelsToYoy(
  levels: Map<string, number>,
  releaseDay: number,
): Observation[] {
  const periods = [...levels.keys()].sort();
  const out: Observation[] = [];
  for (const period of periods) {
    const curr = levels.get(period);
    const prev = levels.get(shiftMonth(period, -12));
    if (curr === undefined || prev === undefined || prev === 0) continue;
    out.push({
      period,
      value: round1((curr / prev - 1) * 100),
      releasedAt: releaseGuess(period, releaseDay),
      sourceUrl: "https://ecos.bok.or.kr",
    });
  }
  return out;
}

function trimMonthly(series: Observation[], years: number): Observation[] {
  if (series.length === 0) return series;
  const sorted = [...series].sort((a, b) => a.period.localeCompare(b.period));
  const latest = sorted[sorted.length - 1].period;
  const floor = shiftMonth(latest, -(years * 12 - 1));
  return sorted.filter((row) => row.period >= floor);
}

export type ActivityDualSeries = {
  mom: Observation[];
  yoy: Observation[];
};

/**
 * Industrial: MoM from SA (901Y033/A00/2), YoY from original (A00/1).
 */
export async function fetchIndustrialDual(
  history: boolean,
): Promise<ActivityDualSeries> {
  const years = history ? INDUSTRIAL_YEARS : INDUSTRIAL_YEARS;
  const monthsBack = years * 12 + 12;
  const sa = await fetchMonthlyLevelsChunked(
    ["901Y033", "A00", "2"],
    monthsBack,
  );
  if (!ecosKeyIsSample()) {
    await new Promise((r) => setTimeout(r, 250));
  }
  const orig = await fetchMonthlyLevelsChunked(
    ["901Y033", "A00", "1"],
    monthsBack,
  );
  return {
    mom: trimMonthly(levelsToMom(sa, 28), years),
    yoy: trimMonthly(levelsToYoy(orig, 28), years),
  };
}

/** Industrial MoM % of SA IP index 901Y033 / A00 / 2. */
export async function fetchIndustrialSeries(
  history: boolean,
): Promise<Observation[]> {
  const dual = await fetchIndustrialDual(history);
  return dual.mom;
}

/**
 * Retail: MoM from SA (901Y100/G0/T3), YoY from constant-price (G0/T2).
 * Horizon: last 10 years.
 */
export async function fetchRetailDual(
  _history: boolean,
): Promise<ActivityDualSeries> {
  const monthsBack = RETAIL_YEARS * 12 + 12;
  const sa = await fetchMonthlyLevelsChunked(
    ["901Y100", "G0", "T3"],
    monthsBack,
  );
  if (!ecosKeyIsSample()) {
    await new Promise((r) => setTimeout(r, 250));
  }
  const real = await fetchMonthlyLevelsChunked(
    ["901Y100", "G0", "T2"],
    monthsBack,
  );
  return {
    mom: trimMonthly(levelsToMom(sa, 28), RETAIL_YEARS),
    yoy: trimMonthly(levelsToYoy(real, 28), RETAIL_YEARS),
  };
}

/** Retail sales MoM % of SA index 901Y100 / G0 / T3 — last 10 years. */
export async function fetchRetailSeries(
  history: boolean,
): Promise<Observation[]> {
  const dual = await fetchRetailDual(history);
  return dual.mom;
}

/**
 * Service sales (서비스업생산): MoM from SA (901Y038/I51A/3),
 * YoY from constant-price (I51A/2). Horizon: last 10 years.
 */
export async function fetchServiceSalesDual(
  _history: boolean,
): Promise<ActivityDualSeries> {
  const monthsBack = RETAIL_YEARS * 12 + 12;
  const sa = await fetchMonthlyLevelsChunked(
    ["901Y038", "I51A", "3"],
    monthsBack,
  );
  if (!ecosKeyIsSample()) {
    await new Promise((r) => setTimeout(r, 250));
  }
  const real = await fetchMonthlyLevelsChunked(
    ["901Y038", "I51A", "2"],
    monthsBack,
  );
  return {
    mom: trimMonthly(levelsToMom(sa, 28), RETAIL_YEARS),
    yoy: trimMonthly(levelsToYoy(real, 28), RETAIL_YEARS),
  };
}

/** Service sales MoM % of SA index 901Y038 / I51A / 3 — last 10 years. */
export async function fetchServiceSalesSeries(
  history: boolean,
): Promise<Observation[]> {
  const dual = await fetchServiceSalesDual(history);
  return dual.mom;
}

async function fetchLaborRateSeries(
  itemCode: string,
  history: boolean,
): Promise<Observation[]> {
  const sample = ecosKeyIsSample();
  const months = sample ? 9 : history ? 252 : 240;
  const rows = await fetchMonthlyIndex(
    ["901Y027", itemCode, "I28A"],
    months,
    sample ? 10 : history ? 280 : 260,
  );
  return [...rows]
    .sort((a, b) => a.TIME.localeCompare(b.TIME))
    .map((row) => {
      const period = periodFromEcosTime(row.TIME);
      return {
        period,
        value: round1(Number(row.DATA_VALUE)),
        releasedAt: releaseGuess(period, 12),
        sourceUrl: "https://ecos.bok.or.kr",
      };
    })
    .filter((o) => Number.isFinite(o.value));
}

/** Employment rate % 901Y027 / I61E / I28A. */
export async function fetchEmploymentSeries(
  history: boolean,
): Promise<Observation[]> {
  return fetchLaborRateSeries("I61E", history);
}

/** Unemployment rate % 901Y027 / I61BC / I28A. */
export async function fetchUnemploymentSeries(
  history: boolean,
): Promise<Observation[]> {
  return fetchLaborRateSeries("I61BC", history);
}

async function fetchMonthlyLevelSeries(
  segments: string[],
  history: boolean,
  releaseDay: number,
  digits = 1,
): Promise<Observation[]> {
  const sample = ecosKeyIsSample();
  const months = sample ? 9 : history ? 252 : 240;
  const rows = await fetchMonthlyIndex(
    segments,
    months,
    sample ? 10 : history ? 280 : 260,
  );
  const round = digits === 1 ? round1 : (n: number) => roundN(n, digits);
  return [...rows]
    .sort((a, b) => a.TIME.localeCompare(b.TIME))
    .map((row) => {
      const period = periodFromEcosTime(row.TIME);
      return {
        period,
        value: round(Number(row.DATA_VALUE)),
        releasedAt: releaseGuess(period, releaseDay),
        sourceUrl: "https://ecos.bok.or.kr",
      };
    })
    .filter((o) => Number.isFinite(o.value));
}

/** Consumer sentiment index — ECOS 511Y002 / FME / 99988. */
export async function fetchConsumerSentimentSeries(
  history: boolean,
): Promise<Observation[]> {
  return fetchMonthlyLevelSeries(["511Y002", "FME", "99988"], history, 25, 1);
}

/** Coincident composite index — ECOS 901Y067 / I16B. */
export async function fetchCompositeIndexSeries(
  history: boolean,
): Promise<Observation[]> {
  return fetchMonthlyLevelSeries(["901Y067", "I16B"], history, 28, 1);
}

/** Coincident index cyclical component — ECOS 901Y067 / I16D. */
export async function fetchCoincidentIndexSeries(
  history: boolean,
): Promise<Observation[]> {
  return fetchMonthlyLevelSeries(["901Y067", "I16D"], history, 28, 1);
}

/** Leading index cyclical component — ECOS 901Y067 / I16E. */
export async function fetchLeadingIndexSeries(
  history: boolean,
): Promise<Observation[]> {
  return fetchMonthlyLevelSeries(["901Y067", "I16E"], history, 28, 1);
}

function shiftEcosQuarterLabel(time: string, delta: number): string {
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

/** National accounts growth rates: always from 2000Q1. */
const NA_START_ECOS = "2000Q1";
const NA_START_PERIOD = "2000-Q1";

async function fetchQuarterlyNaValues(
  statCode: string,
  itemCode: string,
): Promise<Map<string, number>> {
  const sample = ecosKeyIsSample();
  const { end } = quarterWindow(0);
  const start = NA_START_ECOS;
  const byTime = new Map<string, number>();
  // 2000Q1 → ~2026Q4 ≈ 108 quarters; leave headroom for paging.
  const maxRows = 160;

  if (!sample) {
    const rows = await ecosSearchPaged(
      [statCode, "Q", start, end, itemCode],
      { pageSize: 100, maxRows },
    );
    for (const row of rows) {
      const value = Number(row.DATA_VALUE);
      if (Number.isFinite(value)) byTime.set(row.TIME, value);
    }
  } else {
    let windowEnd = end;
    for (let chunk = 0; chunk < 12; chunk += 1) {
      const windowStart = shiftEcosQuarterLabel(windowEnd, -9);
      const rows = await ecosSearch(
        [statCode, "Q", windowStart, windowEnd, itemCode],
        { end: 10 },
      );
      if (rows.length === 0) break;
      for (const row of rows) {
        const value = Number(row.DATA_VALUE);
        if (Number.isFinite(value)) byTime.set(row.TIME, value);
      }
      const oldest = [...rows].map((r) => r.TIME).sort()[0];
      if (!oldest || oldest <= start) break;
      windowEnd = shiftEcosQuarterLabel(oldest, -1);
      if (windowEnd < start) break;
    }
  }

  return byTime;
}

async function fetchQuarterlyNaGrowth(
  itemCode: string,
  _history: boolean,
): Promise<Observation[]> {
  const byTime = await fetchQuarterlyNaValues("200Y102", itemCode);
  return [...byTime.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([time, value]) => {
      const period = periodFromEcosTime(time);
      return {
        period,
        value: round1(value),
        releasedAt: releaseGuess(period),
        sourceUrl: "https://ecos.bok.or.kr",
      };
    })
    .filter((obs) => obs.period >= NA_START_PERIOD);
}

/** Growth % from quarterly levels (lag 1 = QoQ, lag 4 = YoY). */
function growthFromQuarterlyLevels(
  levels: Map<string, number>,
  lag: number,
): Observation[] {
  const times = [...levels.keys()].sort((a, b) => a.localeCompare(b));
  const out: Observation[] = [];
  for (const time of times) {
    const cur = levels.get(time);
    const base = levels.get(shiftEcosQuarterLabel(time, -lag));
    if (cur == null || base == null || base === 0) continue;
    const period = periodFromEcosTime(time);
    if (period < NA_START_PERIOD) continue;
    out.push({
      period,
      value: round1(((cur - base) / base) * 100),
      releasedAt: releaseGuess(period),
      sourceUrl: "https://ecos.bok.or.kr",
    });
  }
  return out;
}

export type QuarterlyDual = {
  qoq: Observation[];
  yoy: Observation[];
};

/**
 * National accounts dual series from 200Y102:
 * - QoQ item: seasonally adjusted 전분기비
 * - YoY item: original (원계열) 전년동기비
 */
async function fetchQuarterlyDual(
  qoqItem: string,
  yoyItem: string,
  history: boolean,
): Promise<QuarterlyDual> {
  const [qoq, yoy] = await Promise.all([
    fetchQuarterlyNaGrowth(qoqItem, history),
    fetchQuarterlyNaGrowth(yoyItem, history),
  ]);
  return { qoq, yoy };
}

/** SA QoQ GDP % 200Y102 / 10111 (+ original YoY 10211). */
export async function fetchGdpDual(history: boolean): Promise<QuarterlyDual> {
  return fetchQuarterlyDual("10111", "10211", history);
}
export async function fetchGdpSeries(history: boolean): Promise<Observation[]> {
  return (await fetchGdpDual(history)).qoq;
}

/** SA QoQ private consumption % 200Y102 / 10122 (+ original YoY 10222). */
export async function fetchConsumptionDual(
  history: boolean,
): Promise<QuarterlyDual> {
  return fetchQuarterlyDual("10122", "10222", history);
}

export async function fetchConsumptionSeries(
  history: boolean,
): Promise<Observation[]> {
  return (await fetchConsumptionDual(history)).qoq;
}

/** SA QoQ government consumption % 200Y102 / 10128 (+ original YoY 10228). */
export async function fetchGovConsumptionDual(
  history: boolean,
): Promise<QuarterlyDual> {
  return fetchQuarterlyDual("10128", "10228", history);
}

export async function fetchGovConsumptionSeries(
  history: boolean,
): Promise<Observation[]> {
  return (await fetchGovConsumptionDual(history)).qoq;
}

/** SA QoQ facilities investment % 200Y102 / 10123 (+ original YoY 10223). */
export async function fetchFacilityInvestmentDual(
  history: boolean,
): Promise<QuarterlyDual> {
  return fetchQuarterlyDual("10123", "10223", history);
}

export async function fetchFacilityInvestmentSeries(
  history: boolean,
): Promise<Observation[]> {
  return (await fetchFacilityInvestmentDual(history)).qoq;
}

/** SA QoQ construction investment % 200Y102 / 10124 (+ original YoY 10224). */
export async function fetchConstructionInvestmentDual(
  history: boolean,
): Promise<QuarterlyDual> {
  return fetchQuarterlyDual("10124", "10224", history);
}

export async function fetchConstructionInvestmentSeries(
  history: boolean,
): Promise<Observation[]> {
  return (await fetchConstructionInvestmentDual(history)).qoq;
}

/**
 * Intellectual property products investment % — not in 200Y102.
 * QoQ from SA real levels 200Y108/1020113; YoY from original 200Y110/1020113.
 */
export async function fetchIpInvestmentDual(
  _history: boolean,
): Promise<QuarterlyDual> {
  const [saLevels, origLevels] = await Promise.all([
    fetchQuarterlyNaValues("200Y108", "1020113"),
    fetchQuarterlyNaValues("200Y110", "1020113"),
  ]);
  return {
    qoq: growthFromQuarterlyLevels(saLevels, 1),
    yoy: growthFromQuarterlyLevels(origLevels, 4),
  };
}

export async function fetchIpInvestmentSeries(
  history: boolean,
): Promise<Observation[]> {
  return (await fetchIpInvestmentDual(history)).qoq;
}

/** SA QoQ goods exports % 200Y102 / 10125 (+ original YoY 10225). */
export async function fetchNaExportDual(
  history: boolean,
): Promise<QuarterlyDual> {
  return fetchQuarterlyDual("10125", "10225", history);
}
export async function fetchNaExportSeries(
  history: boolean,
): Promise<Observation[]> {
  return (await fetchNaExportDual(history)).qoq;
}

/** SA QoQ goods imports % 200Y102 / 10126 (+ original YoY 10226). */
export async function fetchNaImportDual(
  history: boolean,
): Promise<QuarterlyDual> {
  return fetchQuarterlyDual("10126", "10226", history);
}
export async function fetchNaImportSeries(
  history: boolean,
): Promise<Observation[]> {
  return (await fetchNaImportDual(history)).qoq;
}

/** Current account balance in 억 USD — ECOS 301Y013 / 000000. */
export async function fetchCurrentAccountSeries(
  history: boolean,
): Promise<Observation[]> {
  const years = history ? 20 : 20;
  const monthsBack = years * 12;
  const levels = await fetchMonthlyLevelsChunked(
    ["301Y013", "000000"],
    monthsBack,
  );
  return [...levels.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, millionUsd]) => ({
      period,
      value: round1(millionUsd / 100),
      releasedAt: releaseGuess(period, 5),
      sourceUrl: "https://ecos.bok.or.kr",
    }))
    .filter((o) => Number.isFinite(o.value));
}

export type TradeBundle = {
  balance: Observation[];
  exports: Observation[];
};

/** Customs trade balance + exports in 억 USD. */
export async function fetchTradeBundle(history: boolean): Promise<TradeBundle> {
  if (!customsServiceKey()) {
    throw new Error("missing DATA_GO_KR_SERVICE_KEY");
  }
  // API allows ~1 year per call; chunk yearly for history.
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  const startYear = history ? endYear - 20 : endYear - 20;
  const balanceMap = new Map<string, Observation>();
  const exportMap = new Map<string, Observation>();

  for (let y = startYear; y <= endYear; y += 1) {
    const start = `${y}01`;
    const end =
      y === endYear
        ? `${y}${String(endMonth).padStart(2, "0")}`
        : `${y}12`;
    const rows = await fetchCustomsTrade(start, end);
    for (const row of rows) {
      const period = periodFromCustomsYear(String(row.year));
      const releasedAt = releaseGuess(period, 1);
      const sourceUrl = "https://unipass.customs.go.kr";
      const bal = toEokUsd(row.balPayments);
      if (Number.isFinite(bal)) {
        balanceMap.set(period, { period, value: bal, releasedAt, sourceUrl });
      }
      if (row.expDlr !== undefined) {
        const exp = toEokUsd(row.expDlr);
        if (Number.isFinite(exp)) {
          exportMap.set(period, { period, value: exp, releasedAt, sourceUrl });
        }
      }
    }
  }

  const sortObs = (map: Map<string, Observation>) =>
    [...map.values()].sort((a, b) => a.period.localeCompare(b.period));

  return { balance: sortObs(balanceMap), exports: sortObs(exportMap) };
}

/** Customs export value in 억 USD. */
export async function fetchTradeExportSeries(
  history: boolean,
): Promise<Observation[]> {
  const bundle = await fetchTradeBundle(history);
  return bundle.exports;
}

export async function fetchUsdKrwSeries(history: boolean): Promise<Observation[]> {
  return fetchDailyLevelSeries("731Y001", "0000001", history, 1);
}

/** KOSPI — Yahoo Finance ^KS11 (live quote + daily history). */
export async function fetchKospiSeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchYahooIndexSeries("^KS11", {
    yearsBack: FRED_YEARS,
    digits: 2,
    timeZone: "Asia/Seoul",
  });
}

/** KOSDAQ — Yahoo Finance ^KQ11 (live quote + daily history). */
export async function fetchKosdaqSeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchYahooIndexSeries("^KQ11", {
    yearsBack: FRED_YEARS,
    digits: 2,
    timeZone: "Asia/Seoul",
  });
}

export async function fetchCallSeries(history: boolean): Promise<Observation[]> {
  return fetchDailyLevelSeries("817Y002", "010101000", history, 3);
}

export async function fetchKtb3ySeries(history: boolean): Promise<Observation[]> {
  return fetchDailyLevelSeries("817Y002", "010200000", history, 3);
}

export async function fetchKtb10ySeries(
  history: boolean,
): Promise<Observation[]> {
  return fetchDailyLevelSeries("817Y002", "010210000", history, 3);
}

const FRED_YEARS = 20;

export async function fetchUst1ySeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchFredLevelSeries("DGS1", {
    yearsBack: FRED_YEARS,
    digits: 2,
    forceKind: "daily",
  });
}

export async function fetchUst10ySeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchFredLevelSeries("DGS10", {
    yearsBack: FRED_YEARS,
    digits: 2,
    forceKind: "daily",
  });
}

export async function fetchUst30ySeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchFredLevelSeries("DGS30", {
    yearsBack: FRED_YEARS,
    digits: 2,
    forceKind: "daily",
  });
}

export async function fetchUsGdpSeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchFredLevelSeries("A191RL1Q225SBEA", {
    yearsBack: FRED_YEARS,
    digits: 1,
    forceKind: "quarterly",
  });
}

export async function fetchUsCpiSeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchFredYoySeries("CPIAUCSL", { yearsBack: FRED_YEARS, digits: 1 });
}

/** Headline PCE price index → YoY % (Fed preferred inflation gauge). */
export async function fetchUsPceSeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchFredYoySeries("PCEPI", { yearsBack: FRED_YEARS, digits: 1 });
}

/** US Dollar Index (DXY) — Yahoo Finance DX-Y.NYB. */
export async function fetchUsdIndexSeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchYahooIndexSeries("DX-Y.NYB", {
    yearsBack: FRED_YEARS,
    digits: 2,
  });
}

/** NASDAQ Composite — Yahoo Finance ^IXIC (live quote + daily history). */
export async function fetchUsNasdaqSeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchYahooIndexSeries("^IXIC", {
    yearsBack: FRED_YEARS,
    digits: 2,
  });
}

/** S&P 500 — Yahoo Finance ^GSPC (live quote + daily history). */
export async function fetchUsSp500Series(
  _history: boolean,
): Promise<Observation[]> {
  return fetchYahooIndexSeries("^GSPC", {
    yearsBack: FRED_YEARS,
    digits: 2,
  });
}

export async function fetchUsDjiaSeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchFredLevelSeries("DJIA", {
    yearsBack: FRED_YEARS,
    digits: 2,
    forceKind: "daily",
  });
}

/** WTI — Yahoo Finance CL=F (front-month futures, USD/barrel). */
export async function fetchOilWtiSeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchYahooIndexSeries("CL=F", {
    yearsBack: FRED_YEARS,
    digits: 2,
  });
}

/** Dubai crude — Yahoo Finance DBL=F Dubai Crude Oil (Platts) financial. */
export async function fetchOilDubaiSeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchYahooIndexSeries("DBL=F", {
    yearsBack: FRED_YEARS,
    digits: 2,
  });
}

/** Yen per USD — Yahoo Finance USDJPY=X. */
export async function fetchUsdJpySeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchYahooIndexSeries("USDJPY=X", {
    yearsBack: FRED_YEARS,
    digits: 2,
  });
}

/** USD per EUR — Yahoo Finance EURUSD=X. */
export async function fetchEurUsdSeries(
  _history: boolean,
): Promise<Observation[]> {
  return fetchYahooIndexSeries("EURUSD=X", {
    yearsBack: FRED_YEARS,
    digits: 4,
  });
}

export async function fetchIndicatorSeries(
  id: IndicatorId,
  history: boolean,
): Promise<Observation[]> {
  switch (id) {
    case "cpi":
      return fetchCpiSeries(history);
    case "industrial":
      return fetchIndustrialSeries(history);
    case "retail":
      return fetchRetailSeries(history);
    case "serviceSales":
      return fetchServiceSalesSeries(history);
    case "employment":
      return fetchEmploymentSeries(history);
    case "unemployment":
      return fetchUnemploymentSeries(history);
    case "consumerSentiment":
      return fetchConsumerSentimentSeries(history);
    case "compositeIndex":
      return fetchCompositeIndexSeries(history);
    case "coincidentIndex":
      return fetchCoincidentIndexSeries(history);
    case "leadingIndex":
      return fetchLeadingIndexSeries(history);
    case "gdp":
      return fetchGdpSeries(history);
    case "consumption":
      return fetchConsumptionSeries(history);
    case "govConsumption":
      return fetchGovConsumptionSeries(history);
    case "facilityInvestment":
      return fetchFacilityInvestmentSeries(history);
    case "constructionInvestment":
      return fetchConstructionInvestmentSeries(history);
    case "ipInvestment":
      return fetchIpInvestmentSeries(history);
    case "naExport":
      return fetchNaExportSeries(history);
    case "naImport":
      return fetchNaImportSeries(history);
    case "currentAccount":
      return fetchCurrentAccountSeries(history);
    case "trade":
      return fetchTradeExportSeries(history);
    case "usdkrw":
      return fetchUsdKrwSeries(history);
    case "kospi":
      return fetchKospiSeries(history);
    case "kosdaq":
      return fetchKosdaqSeries(history);
    case "call":
      return fetchCallSeries(history);
    case "ktb3y":
      return fetchKtb3ySeries(history);
    case "ktb10y":
      return fetchKtb10ySeries(history);
    case "ust1y":
      return fetchUst1ySeries(history);
    case "ust10y":
      return fetchUst10ySeries(history);
    case "ust30y":
      return fetchUst30ySeries(history);
    case "fedwatchHike":
      return fetchFedwatchHikeSeries(history);
    case "usdjpy":
      return fetchUsdJpySeries(history);
    case "eurusd":
      return fetchEurUsdSeries(history);
    case "usgdp":
      return fetchUsGdpSeries(history);
    case "uscpi":
      return fetchUsCpiSeries(history);
    case "uspce":
      return fetchUsPceSeries(history);
    case "usdIndex":
      return fetchUsdIndexSeries(history);
    case "usnasdaq":
      return fetchUsNasdaqSeries(history);
    case "ussp500":
      return fetchUsSp500Series(history);
    case "usdjia":
      return fetchUsDjiaSeries(history);
    case "oilWti":
      return fetchOilWtiSeries(history);
    case "oilDubai":
      return fetchOilDubaiSeries(history);
    default:
      return [];
  }
}

export function describeSources(): string {
  const ecos = ecosApiKey();
  const sample = ecosKeyIsSample(ecos);
  const customs = customsServiceKey() ? "set" : "missing";
  const items = itemTradeServiceKey() ? "set" : "missing";
  return `ECOS key=${sample ? "sample(max 10 rows)" : "custom"}, customs=${customs}, itemTrade=${items}, FRED=csv, Yahoo=chart`;
}

export { yyyymm };
