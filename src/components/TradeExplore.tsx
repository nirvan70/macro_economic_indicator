"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HistoryChart } from "@/components/HistoryChart";
import { TradeItemsPanel } from "@/components/TradeItemsPanel";
import type { Observation, TradeItemAgg } from "@/lib/types";

type Props = {
  exportSeries: Observation[];
  exportUnit: string;
  initialItems: TradeItemAgg[];
};

function yearAgo(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - 12, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthAgo(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function hasCompareMonths(items: TradeItemAgg[], period: string): boolean {
  const prev = monthAgo(period);
  const yoy = yearAgo(period);
  const periods = new Set(items.map((row) => row.period));
  return periods.has(period) && periods.has(prev) && periods.has(yoy);
}

export function TradeExplore({
  exportSeries,
  exportUnit,
  initialItems,
}: Props) {
  const defaultPeriod =
    exportSeries[exportSeries.length - 1]?.period ??
    [...new Set(initialItems.map((i) => i.period))].sort().at(-1) ??
    "";

  const [period, setPeriod] = useState(defaultPeriod);
  const [cache, setCache] = useState<Record<string, TradeItemAgg[]>>(() => {
    const map: Record<string, TradeItemAgg[]> = {};
    if (initialItems.length > 0) {
      const periods = [...new Set(initialItems.map((i) => i.period))];
      for (const p of periods) {
        map[p] = initialItems;
      }
    }
    return map;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const booted = useRef(false);

  const itemsForPanel = useMemo(() => cache[period] ?? [], [cache, period]);

  const ensurePeriod = useCallback(
    async (next: string, force = false) => {
      setPeriod(next);
      setError(null);

      if (!force && hasCompareMonths(cache[next] ?? [], next)) return;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/trade-items?period=${encodeURIComponent(next)}`,
        );
        const data = (await res.json()) as {
          items?: TradeItemAgg[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setCache((prev) => ({ ...prev, [next]: data.items ?? [] }));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [cache],
  );

  useEffect(() => {
    if (!defaultPeriod || booted.current) return;
    booted.current = true;
    void ensurePeriod(defaultPeriod, true);
  }, [defaultPeriod, ensurePeriod]);

  return (
    <div className="space-y-10">
      <section className="rounded-sm bg-white/75 px-3 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur sm:px-5">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl text-slate-900">
          월별 통관수출
        </h2>
        <HistoryChart
          series={exportSeries}
          unit={exportUnit}
          accent="#0f766e"
          selectedPeriod={period}
          onPeriodSelect={(p) => {
            void ensurePeriod(p);
          }}
          hint="월을 클릭하면 아래 품목별 표가 바뀝니다"
        />
      </section>

      <section className="rounded-sm bg-white/75 px-3 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur sm:px-5">
        <TradeItemsPanel
          items={itemsForPanel}
          period={period}
          loading={loading}
          error={error}
        />
      </section>
    </div>
  );
}
