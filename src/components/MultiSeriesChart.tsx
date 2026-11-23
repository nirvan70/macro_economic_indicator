"use client";

import { forwardRef, useMemo, useState } from "react";
import { formatValue } from "@/lib/format";
import type { Observation } from "@/lib/types";

/** SVG stroke-dasharray patterns for multi-series distinction. */
export const SERIES_LINE_STYLES = [
  { id: "solid", label: "실선", dash: undefined as string | undefined },
  { id: "dashed", label: "파선", dash: "7 4" },
  { id: "dotted", label: "점선", dash: "2 2.5" },
  { id: "dashDot", label: "일점쇄선", dash: "9 3.5 2 3.5" },
  { id: "longDash", label: "긴파선", dash: "12 4" },
  { id: "shortDash", label: "짧은파선", dash: "4 3" },
  { id: "denseDot", label: "촘촘점선", dash: "1.5 2" },
  { id: "dashDotDot", label: "이점쇄선", dash: "9 3.5 2 3.5 2 3.5" },
] as const;

export type ChartSeries = {
  id: string;
  label: string;
  unit: string;
  color: string;
  /** SVG stroke-dasharray; omit / undefined = solid. */
  dasharray?: string;
  digits?: number;
  observations: Observation[];
  /** When dual axis is on, series on the right scale. */
  axis?: "left" | "right";
};

type Props = {
  series: ChartSeries[];
  dualAxis?: boolean;
  hint?: string;
};

function formatTick(period: string): string {
  if (period.includes("-Q")) {
    const [y, q] = period.split("-Q");
    return `${y.slice(2)}.${q}Q`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    const [y, m, d] = period.split("-");
    return `${y.slice(2)}.${m}.${d}`;
  }
  const [y, m] = period.split("-");
  return `${y.slice(2)}.${m}`;
}

function scaleDomain(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = maxV - minV || Math.abs(maxV) || 1;
  return { min: minV - span * 0.12, max: maxV + span * 0.12 };
}

export const MultiSeriesChart = forwardRef<HTMLDivElement, Props>(
  function MultiSeriesChart({ series, dualAxis = false, hint }, ref) {
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => {
    const usable = series.filter((s) => s.observations.length > 0);
    if (usable.length === 0) return null;

    const periodSet = new Set<string>();
    for (const s of usable) {
      for (const obs of s.observations) periodSet.add(obs.period);
    }
    const periods = [...periodSet].sort((a, b) => a.localeCompare(b));
    if (periods.length === 0) return null;

    const maps = usable.map((s) => ({
      ...s,
      axis: dualAxis ? (s.axis ?? "left") : "left",
      map: new Map(s.observations.map((o) => [o.period, o.value])),
    }));

    const leftValues = maps
      .filter((s) => s.axis === "left")
      .flatMap((s) => periods.map((p) => s.map.get(p)).filter((v): v is number => v !== undefined));
    const rightValues = maps
      .filter((s) => s.axis === "right")
      .flatMap((s) => periods.map((p) => s.map.get(p)).filter((v): v is number => v !== undefined));

    const leftDomain = scaleDomain(leftValues);
    const rightDomain =
      dualAxis && rightValues.length > 0
        ? scaleDomain(rightValues)
        : leftDomain;

    const width = 920;
    const height = 340;
    const pad = {
      top: 28,
      right: dualAxis ? 56 : 24,
      bottom: 40,
      left: 56,
    };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const xAt = (i: number) =>
      pad.left +
      (periods.length <= 1 ? innerW / 2 : (i / (periods.length - 1)) * innerW);
    const yAt = (v: number, axis: "left" | "right") => {
      const domain = axis === "right" ? rightDomain : leftDomain;
      return (
        pad.top +
        ((domain.max - v) / (domain.max - domain.min || 1)) * innerH
      );
    };

    const lines = maps.map((s) => {
      const pts: { x: number; y: number }[] = [];
      periods.forEach((period, i) => {
        const v = s.map.get(period);
        if (v === undefined) return;
        pts.push({ x: xAt(i), y: yAt(v, s.axis) });
      });
      const d =
        pts.length === 0
          ? ""
          : pts
              .map(
                (p, i) =>
                  `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
              )
              .join(" ");
      return { ...s, d };
    });

    const yTicks = 5;
    const leftLabels = Array.from({ length: yTicks }, (_, i) => {
      const t = i / (yTicks - 1);
      const value = leftDomain.max - t * (leftDomain.max - leftDomain.min);
      return { value, y: yAt(value, "left") };
    });
    const rightLabels =
      dualAxis && rightValues.length > 0
        ? Array.from({ length: yTicks }, (_, i) => {
            const t = i / (yTicks - 1);
            const value =
              rightDomain.max - t * (rightDomain.max - rightDomain.min);
            return { value, y: yAt(value, "right") };
          })
        : [];

    const xLabelCount = Math.min(10, periods.length);
    const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
      const idx =
        xLabelCount === 1
          ? 0
          : Math.round((i / (xLabelCount - 1)) * (periods.length - 1));
      return { idx, period: periods[idx], x: xAt(idx) };
    });

    const zeroYLeft =
      leftDomain.min < 0 && leftDomain.max > 0
        ? yAt(0, "left")
        : null;
    const slotW = periods.length > 0 ? innerW / periods.length : innerW;

    return {
      width,
      height,
      pad,
      innerW,
      innerH,
      periods,
      lines,
      leftLabels,
      rightLabels,
      xLabels,
      zeroYLeft,
      xAt,
      yAt,
      slotW,
      leftDigits: maps.find((s) => s.axis === "left")?.digits ?? 1,
      rightDigits: maps.find((s) => s.axis === "right")?.digits ?? 1,
    };
  }, [series, dualAxis]);

  if (!chart) {
    return (
      <div ref={ref}>
        <p className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          표시할 시계열이 없습니다.
        </p>
      </div>
    );
  }

  const focusIdx = hover ?? chart.periods.length - 1;
  const focusPeriod = chart.periods[focusIdx];
  const focusX = chart.xAt(focusIdx);
  const showingHover = hover !== null;
  const tooltipLeft =
    focusX > chart.pad.left + chart.innerW * 0.65
      ? focusX - 188
      : focusX + 12;

  return (
    <div ref={ref} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            {focusPeriod}
            {showingHover ? " · 선택" : ""}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
            {chart.lines.map((s) => {
              const value = s.map.get(focusPeriod);
              return (
                <p key={s.id} style={{ color: s.color }}>
                  {s.label}{" "}
                  <span className="text-base font-semibold text-slate-900">
                    {formatValue(value, s.digits ?? 1)}
                    <span className="ml-0.5 text-xs font-normal text-slate-500">
                      {s.unit}
                    </span>
                  </span>
                </p>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap justify-end gap-3 text-[11px] text-slate-600">
            {chart.lines.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5">
                <svg
                  width="22"
                  height="8"
                  viewBox="0 0 22 8"
                  aria-hidden
                  className="shrink-0"
                >
                  <line
                    x1="1"
                    y1="4"
                    x2="21"
                    y2="4"
                    stroke={s.color}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeDasharray={s.dasharray}
                  />
                </svg>
                {s.label}
                {dualAxis ? (
                  <span className="text-slate-400">
                    ({s.axis === "right" ? "우" : "좌"})
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            {hint ??
              `${chart.periods[0]} ~ ${chart.periods[chart.periods.length - 1]} · ${chart.periods.length}개 시점`}
          </p>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-auto w-full min-w-[640px] cursor-crosshair"
          role="img"
          aria-label="복수 지표 시계열 그래프"
          onMouseLeave={() => setHover(null)}
        >
          {chart.leftLabels.map((tick) => (
            <g key={`L-${tick.value}`}>
              <line
                x1={chart.pad.left}
                x2={chart.pad.left + chart.innerW}
                y1={tick.y}
                y2={tick.y}
                stroke="#cbd5e1"
                strokeDasharray="3 4"
              />
              <text
                x={chart.pad.left - 10}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
              >
                {formatValue(tick.value, chart.leftDigits)}
              </text>
            </g>
          ))}

          {chart.rightLabels.map((tick) => (
            <text
              key={`R-${tick.value}`}
              x={chart.pad.left + chart.innerW + 10}
              y={tick.y + 4}
              textAnchor="start"
              fontSize="11"
              fill="#64748b"
            >
              {formatValue(tick.value, chart.rightDigits)}
            </text>
          ))}

          {chart.zeroYLeft !== null ? (
            <line
              x1={chart.pad.left}
              x2={chart.pad.left + chart.innerW}
              y1={chart.zeroYLeft}
              y2={chart.zeroYLeft}
              stroke="#94a3b8"
              strokeWidth="1"
            />
          ) : null}

          {chart.lines.map((s) => (
            <path
              key={s.id}
              d={s.d}
              fill="none"
              stroke={s.color}
              strokeWidth="2.3"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dasharray}
            />
          ))}

          {chart.xLabels.map((label) => (
            <text
              key={label.period}
              x={label.x}
              y={chart.height - 14}
              textAnchor="middle"
              fontSize="11"
              fill="#64748b"
            >
              {formatTick(label.period)}
            </text>
          ))}

          {showingHover ? (
            <line
              x1={focusX}
              x2={focusX}
              y1={chart.pad.top}
              y2={chart.pad.top + chart.innerH}
              stroke="#64748b"
              strokeOpacity="0.45"
              strokeDasharray="4 4"
            />
          ) : null}

          {chart.lines.map((s) => {
            const value = s.map.get(focusPeriod);
            if (value === undefined) return null;
            return (
              <circle
                key={`dot-${s.id}`}
                cx={focusX}
                cy={chart.yAt(value, s.axis)}
                r={showingHover ? 5.5 : 4}
                fill="#fff"
                stroke={s.color}
                strokeWidth="2.3"
              />
            );
          })}

          {chart.periods.map((period, i) => (
            <rect
              key={period}
              x={chart.xAt(i) - chart.slotW / 2}
              y={chart.pad.top}
              width={Math.max(6, chart.slotW)}
              height={chart.innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseMove={() => setHover(i)}
            />
          ))}
        </svg>

        {showingHover ? (
          <div
            className="pointer-events-none absolute top-3 z-10 min-w-[160px] rounded-sm border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-sm backdrop-blur"
            style={{
              left: `clamp(0px, ${(tooltipLeft / chart.width) * 100}%, calc(100% - 180px))`,
            }}
          >
            <p className="font-medium text-slate-800">{focusPeriod}</p>
            {chart.lines.map((s) => (
              <p
                key={s.id}
                className="mt-0.5 tabular-nums"
                style={{ color: s.color }}
              >
                {s.label} {formatValue(s.map.get(focusPeriod), s.digits ?? 1)}
                {s.unit}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
  },
);
