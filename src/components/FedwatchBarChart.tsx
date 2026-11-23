"use client";

import type { Observation } from "@/lib/types";

function meetingLabel(period: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) return period;
  const [y, m, d] = period.split("-");
  return `${y.slice(2)}.${Number(m)}.${Number(d)}`;
}

/** Full-width bar chart for FedWatch 6-month hike-probability outlook. */
export function FedwatchBarChart({
  series,
  unit = "%",
  digits = 1,
}: {
  series: Observation[];
  unit?: string;
  digits?: number;
}) {
  if (series.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        표시할 전망이 없습니다.
      </p>
    );
  }

  const maxVal = Math.max(100, ...series.map((s) => s.value));
  const asOf = series[0]?.releasedAt;

  return (
    <div>
      {asOf ? (
        <p className="mb-4 text-xs text-slate-500">
          정산 기준일 {asOf} · 단위 {unit}
        </p>
      ) : null}
      <div className="flex items-end gap-3 sm:gap-4" style={{ height: 220 }}>
        {series.map((row) => {
          const pct = Math.max(2, (row.value / maxVal) * 100);
          return (
            <div
              key={row.period}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
            >
              <span className="font-[family-name:var(--font-display)] text-sm tabular-nums font-semibold text-slate-900">
                {row.value.toFixed(digits)}
              </span>
              <div className="relative w-full max-w-[4.5rem] flex-1">
                <div className="absolute inset-x-0 bottom-0 top-0 rounded-sm bg-slate-100/80" />
                <div
                  className="absolute inset-x-0 bottom-0 rounded-sm bg-teal-700/85 transition-all"
                  style={{ height: `${pct}%` }}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-slate-800">
                  {meetingLabel(row.period)}
                </p>
                <p className="text-[10px] text-slate-500">FOMC</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        각 막대는 해당 FOMC 이후 목표금리가 현 구간 대비{" "}
        <span className="font-medium text-slate-600">+25bp 구간</span>에
        있을 확률입니다(CME FedWatch·언론이 주로 인용하는 수치). 이후
        회의로 갈수록 확률 질량이 +50bp 이상 구간으로 이동하면 막대가
        낮아질 수 있습니다.
      </p>
    </div>
  );
}
