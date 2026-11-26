import Link from "next/link";
import type { IndicatorSnapshot } from "@/lib/analysis";
import { formatSigned, formatValue } from "@/lib/analysis";
import type { DataStore, Observation } from "@/lib/types";

export type MoverRow = IndicatorSnapshot & {
  movePct: number;
  zScore: number;
  rank: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function displayName(item: IndicatorSnapshot): string {
  return item.subgroupKo
    ? `${item.subgroupKo} ${item.nameKo}`
    : item.nameKo;
}

function latestDeltaStats(series: Observation[]): {
  delta: number;
  z: number;
  pct: number;
} | null {
  if (series.length < 2) return null;
  const deltas: number[] = [];
  for (let i = 1; i < series.length; i += 1) {
    deltas.push(series[i].value - series[i - 1].value);
  }
  const delta = deltas[deltas.length - 1];
  const prev = series[series.length - 2].value;
  const pct = prev !== 0 ? Math.abs((delta / prev) * 100) : Math.abs(delta);

  const window = deltas.slice(-60);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const variance =
    window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
  const std = Math.sqrt(variance);
  const z = std > 1e-9 ? Math.abs((delta - mean) / std) : pct;

  return { delta, z, pct };
}

function parseDateMs(iso: string | undefined): number {
  if (!iso) return 0;
  // Prefer calendar date only so timezone does not push a Seoul "today" back a day.
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function todayUtcMidnightMs(): number {
  const now = new Date();
  const seoul = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  return Date.UTC(seoul.getFullYear(), seoul.getMonth(), seoul.getDate());
}

function formatReleaseDay(iso: string | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return iso;
  const [, m, d] = day.split("-");
  return `${Number(m)}.${Number(d)}`;
}

const STOCK_MARKET_IDS = new Set([
  "kospi",
  "kosdaq",
  "usnasdaq",
  "ussp500",
  "usdjia",
]);

/** Omitted from the recent-update strip (still shown on cards). */
const HIDDEN_FROM_RECENT_IDS = new Set([
  "ktb3y",
  "ktb10y",
  "oilDubai",
  "ust1y",
  "ust30y",
]);

const RECENT_WINDOW_DAYS = 5;
const RECENT_MAX_ITEMS = 10;

function isStockMarketId(id: string): boolean {
  return STOCK_MARKET_IDS.has(id);
}

/** Indicators whose latest release falls within the past N days (Seoul). */
export function pickRecentReleases(
  snapshots: IndicatorSnapshot[],
  store: DataStore,
  withinDays = RECENT_WINDOW_DAYS,
  maxItems = RECENT_MAX_ITEMS,
): MoverRow[] {
  const today = todayUtcMidnightMs();
  const cutoff = today - (withinDays - 1) * 24 * 60 * 60 * 1000;

  const scored = snapshots
    .map((s) => {
      if (HIDDEN_FROM_RECENT_IDS.has(s.id)) return null;
      const series = store.observations[s.id] ?? [];
      if (s.value === undefined) return null;
      const releaseMs = Math.max(
        parseDateMs(s.releasedAt),
        // Daily series often key off the observation period itself.
        s.frequency === "daily" ? parseDateMs(s.period) : 0,
      );
      if (!releaseMs || releaseMs < cutoff || releaseMs > today + WEEK_MS) {
        return null;
      }
      const stats = latestDeltaStats(series);
      return {
        ...s,
        delta:
          stats != null
            ? Number(stats.delta.toFixed(s.valueDigits))
            : s.delta,
        movePct: stats?.pct ?? 0,
        zScore: stats?.z ?? 0,
        _releaseMs: releaseMs,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => {
      // Keep equity indices at the bottom of the recent update list.
      const aStock = isStockMarketId(a.id) ? 1 : 0;
      const bStock = isStockMarketId(b.id) ? 1 : 0;
      if (aStock !== bStock) return aStock - bStock;
      return (
        b._releaseMs - a._releaseMs ||
        b.zScore - a.zScore ||
        b.movePct - a.movePct ||
        0
      );
    })
    .slice(0, maxItems);

  return scored.map(({ _releaseMs: _, ...row }, i) => ({
    ...row,
    rank: i + 1,
  }));
}

export function MoversSummary({
  snapshots,
  store,
}: {
  snapshots: IndicatorSnapshot[];
  store: DataStore;
}) {
  const movers = pickRecentReleases(snapshots, store);

  const rangeLabel = (() => {
    const end = new Date(todayUtcMidnightMs());
    const start = new Date(
      todayUtcMidnightMs() - (RECENT_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000,
    );
    const fmt = (d: Date) => `${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
    return `${fmt(start)}–${fmt(end)}`;
  })();

  return (
    <section
      id="recent-updates"
      aria-labelledby="movers-heading"
      className="relative w-full overflow-hidden rounded-sm border border-slate-900/10 bg-[linear-gradient(135deg,#0f2f2c_0%,#134e4a_42%,#1a3a4a_100%)] shadow-[0_18px_48px_-32px_rgba(15,23,42,0.55)]"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.55)_1px,transparent_0)] [background-size:14px_14px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-teal-300/20 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/80 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-100/90">
              Last {RECENT_WINDOW_DAYS} days · {rangeLabel}
            </p>
          </div>
          <h2
            id="movers-heading"
            className="mt-1.5 font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-white sm:text-2xl"
          >
            최근 업데이트 자료
          </h2>
          <p className="mt-1 max-w-xl text-sm text-teal-50/75">
            최근 {RECENT_WINDOW_DAYS}일 발표·갱신된 지표를 최대 {RECENT_MAX_ITEMS}
            개까지 보여 줍니다.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end rounded-sm bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
          <span className="text-[10px] uppercase tracking-[0.16em] text-teal-100/80">
            Updates
          </span>
          <span className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-white">
            {movers.length}
          </span>
        </div>
      </div>

      {movers.length === 0 ? (
        <p className="relative px-4 py-8 text-center text-sm text-teal-50/70 sm:px-5">
          최근 {RECENT_WINDOW_DAYS}일 내 발표된 지표가 없습니다.
        </p>
      ) : (
        <ul className="relative grid grid-cols-2 gap-px bg-white/10">
          {movers.map((row) => {
            const up = (row.delta ?? 0) > 0;
            const down = (row.delta ?? 0) < 0;
            const tone = up
              ? "text-rose-300"
              : down
                ? "text-emerald-300"
                : "text-slate-300";
            return (
              <li key={row.id} className="bg-[#123d3a]">
                <Link
                  href={`/indicator/${row.id}`}
                  className="group flex h-full items-center gap-2.5 px-3.5 py-2.5 transition hover:bg-white/[0.06] sm:px-4 sm:py-3"
                >
                  <span className="shrink-0 rounded-sm bg-white/10 px-1.5 py-1 text-center text-[11px] font-semibold tabular-nums text-teal-50 ring-1 ring-white/10">
                    {formatReleaseDay(row.releasedAt ?? row.period)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-white group-hover:text-teal-100 sm:text-sm">
                      {displayName(row)}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-teal-100/60">
                      {row.groupKo}
                      {row.period ? ` · ${row.period}` : ""}
                      <span className="text-teal-100/45">
                        {" · "}
                        {formatValue(row.value, row.valueDigits)}
                        {row.unit.split(" ")[0]}
                      </span>
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-right text-sm font-semibold tabular-nums ${tone}`}
                  >
                    {row.delta === undefined
                      ? "—"
                      : formatSigned(row.delta, row.valueDigits)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
