/**
 * Seed ~20 years of observations for each indicator into data/store.json.
 * Keeps factors / upcoming / notification fields.
 *
 *   npx tsx scripts/seed-history.ts
 */

import { promises as fs } from "fs";
import path from "path";
import type {
  DataStore,
  IndicatorId,
  Observation,
} from "../src/lib/types";

const STORE_PATH = path.join(process.cwd(), "data", "store.json");

function round(n: number, digits = 1): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function noise(seed: string, amplitude: number): number {
  return (hash(seed) - 0.5) * 2 * amplitude;
}

function monthlyPeriods(startYear: number, startMonth: number, count: number) {
  const out: { year: number; month: number; period: string }[] = [];
  let y = startYear;
  let m = startMonth;
  for (let i = 0; i < count; i += 1) {
    out.push({
      year: y,
      month: m,
      period: `${y}-${String(m).padStart(2, "0")}`,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function quarterlyPeriods(startYear: number, startQ: number, count: number) {
  const out: { year: number; quarter: number; period: string }[] = [];
  let y = startYear;
  let q = startQ;
  for (let i = 0; i < count; i += 1) {
    out.push({ year: y, quarter: q, period: `${y}-Q${q}` });
    q += 1;
    if (q > 4) {
      q = 1;
      y += 1;
    }
  }
  return out;
}

function releaseDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildCpi(): Observation[] {
  // YoY % — roughly 0.5~5 over 2016-02 .. 2026-02
  return monthlyPeriods(2016, 3, 120).map(({ year, month, period }, i) => {
    const covid = year === 2020 && month >= 4 && month <= 10 ? -0.8 : 0;
    const inflationSpike =
      year === 2022 ? 2.2 : year === 2023 ? 1.0 : year === 2021 ? 0.6 : 0;
    const base = 1.4 + Math.sin(i / 9) * 0.5 + inflationSpike + covid;
    const value = round(Math.max(0.2, base + noise(`cpi-${period}`, 0.35)), 1);
    const ry = month === 12 ? year + 1 : year;
    const rm = month === 12 ? 1 : month + 1;
    return {
      period,
      value,
      releasedAt: releaseDate(ry, rm, 2),
      sourceUrl: "https://kostat.go.kr",
    };
  });
}

function buildTrade(): Observation[] {
  // Trade balance, 억 USD
  return monthlyPeriods(2016, 3, 120).map(({ year, month, period }, i) => {
    const chipCycle = Math.sin(i / 14) * 18;
    const energyShock = year === 2022 ? -35 : year === 2023 && month < 6 ? -15 : 0;
    const base = 28 + chipCycle + energyShock + (i / 120) * 8;
    const value = round(base + noise(`trade-${period}`, 6), 1);
    const ry = month === 12 ? year + 1 : year;
    const rm = month === 12 ? 1 : month + 1;
    return {
      period,
      value,
      releasedAt: releaseDate(ry, rm, 1),
      sourceUrl: "https://unipass.customs.go.kr",
    };
  });
}

function buildIndustrial(): Observation[] {
  // MoM SA %
  return monthlyPeriods(2016, 3, 120).map(({ year, month, period }, i) => {
    const covid =
      year === 2020 && month === 3
        ? -3.2
        : year === 2020 && month === 4
          ? -2.1
          : year === 2020 && month === 5
            ? 1.8
            : 0;
    const base = Math.sin(i / 6) * 0.7 + Math.cos(i / 11) * 0.3;
    const value = round(base + covid + noise(`ind-${period}`, 0.45), 1);
    const ry = month === 12 ? year + 1 : year;
    const rm = month === 12 ? 1 : month + 1;
    return {
      period,
      value,
      releasedAt: releaseDate(ry, rm, 28),
      sourceUrl: "https://kostat.go.kr",
    };
  });
}

function buildEmployment(): Observation[] {
  // Unemployment rate %
  return monthlyPeriods(2016, 3, 120).map(({ year, month, period }, i) => {
    const covid =
      year === 2020 && month >= 3 && month <= 8
        ? 1.1
        : year === 2020
          ? 0.4
          : 0;
    const base = 3.5 + Math.sin(i / 18) * 0.25 - i / 400;
    const value = round(
      Math.min(5.2, Math.max(2.4, base + covid + noise(`emp-${period}`, 0.15))),
      1,
    );
    const ry = month === 12 ? year + 1 : year;
    const rm = month === 12 ? 1 : month + 1;
    return {
      period,
      value,
      releasedAt: releaseDate(ry, rm, 12),
      sourceUrl: "https://kostat.go.kr",
    };
  });
}

function buildGdp(): Observation[] {
  // QoQ SA real %
  return quarterlyPeriods(2016, 1, 41).map(({ year, quarter, period }, i) => {
    const covid =
      year === 2020 && quarter === 1
        ? -1.3
        : year === 2020 && quarter === 2
          ? -3.2
          : year === 2020 && quarter === 3
            ? 2.2
            : 0;
    const base = 0.6 + Math.sin(i / 5) * 0.25;
    const value = round(base + covid + noise(`gdp-${period}`, 0.2), 1);
    const releaseMonth = quarter === 1 ? 4 : quarter === 2 ? 7 : quarter === 3 ? 10 : 1;
    const releaseYear = quarter === 4 ? year + 1 : year;
    return {
      period,
      value,
      releasedAt: releaseDate(releaseYear, releaseMonth, 23),
      sourceUrl: "https://www.bok.or.kr",
    };
  });
}

const builders: Partial<Record<IndicatorId, () => Observation[]>> = {
  cpi: buildCpi,
  trade: buildTrade,
  industrial: buildIndustrial,
  employment: buildEmployment,
  gdp: buildGdp,
};

async function main() {
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const store = JSON.parse(raw) as DataStore;

  for (const id of Object.keys(builders) as IndicatorId[]) {
    const build = builders[id];
    if (!build) continue;
    store.observations[id] = build();
  }
  store.updatedAt = new Date().toISOString();

  await fs.writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  for (const id of Object.keys(builders) as IndicatorId[]) {
    const series = store.observations[id];
    if (!series?.length) continue;
    console.log(
      `${id}: ${series.length} pts (${series[0].period} → ${series[series.length - 1].period})`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
