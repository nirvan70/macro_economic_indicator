"use client";

import { useMemo, useState } from "react";
import type { Observation } from "@/lib/types";
import { formatSigned, formatValue } from "@/lib/format";

type Props = {
  primary: Observation[];
  secondary: Observation[];
  primaryLabel: string;
  secondaryLabel: string;
  unit?: string;
  digits?: number;
  primaryColor?: string;
  secondaryColor?: string;
  /** Keep only the most recent N years of overlapping periods. */
  maxYears?: number;
  /** Inclusive start period (e.g. 2000-Q1 / 2000-01). Overrides maxYears when set. */
  fromPeriod?: string;
};

function formatTick(period: string): string {
  if (period.includes("-Q")) {
    const [y, q] = period.split("-Q");
    return `${y.slice(2)}.${q}Q`;
  }
  const [y, m] = period.split("-");
  return `${y.slice(2)}.${m}`;
}

function periodSortKey(period: string): string {
  return period;
}

function trimToYears(periods: string[], maxYears: number): string[] {
  if (periods.length === 0 || maxYears <= 0) return periods;
  const sorted = [...periods].sort((a, b) =>
    periodSortKey(a).localeCompare(periodSortKey(b)),
  );
  const latest = sorted[sorted.length - 1];
  if (latest.includes("-Q")) {
    const [y, q] = latest.split("-Q").map(Number);
    // Inclusive window of maxYears * 4 quarters → start at latest - 40 + 1.
    const back = maxYears * 4 - 1;
    let yy = y;
    let qq = q;
    for (let i = 0; i < back; i += 1) {
      qq -= 1;
      if (qq < 1) {
        qq = 4;
        yy -= 1;
      }
    }
    const floor = `${yy}-Q${qq}`;
    return sorted.filter((p) => p >= floor);
  }
  const [y, m] = latest.split("-").map(Number);
  const start = new Date(Date.UTC(y - maxYears, m - 1, 1));
  const floor = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return sorted.filter((p) => p >= floor);
}

function trimFromPeriod(periods: string[], fromPeriod: string): string[] {
  return [...periods]
    .sort((a, b) => periodSortKey(a).localeCompare(periodSortKey(b)))
    .filter((p) => p >= fromPeriod);
}

export function DualHistoryChart({
  primary,
  secondary,
  primaryLabel,
  secondaryLabel,
  unit = "%",
  digits = 1,
  primaryColor = "#0f766e",
  secondaryColor = "#b45309",
  maxYears = 10,
  fromPeriod,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => {
    const periodSet = new Set([
      ...primary.map((p) => p.period),
      ...secondary.map((p) => p.period),
    ]);
    const periods = fromPeriod
      ? trimFromPeriod([...periodSet], fromPeriod)
      : trimToYears([...periodSet], maxYears);
    const primaryMap = new Map(primary.map((p) => [p.period, p.value]));
    const secondaryMap = new Map(secondary.map((p) => [p.period, p.value]));

    const values = periods.flatMap((period) => {
      const a = primaryMap.get(period);
      const b = secondaryMap.get(period);
      return [a, b].filter((v): v is number => v !== undefined);
    });
    if (periods.length === 0 || values.length === 0) return null;

    const width = 920;
    const height = 320;
    const pad = { top: 28, right: 24, bottom: 40, left: 52 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const span = maxV - minV || 1;
    const yMin = minV - span * 0.12;
    const yMax = maxV + span * 0.12;

    const xAt = (i: number) =>
      pad.left +
      (periods.length <= 1 ? innerW / 2 : (i / (periods.length - 1)) * innerW);
    const yAt = (v: number) =>
      pad.top + ((yMax - v) / (yMax - yMin || 1)) * innerH;

    const lineFor = (map: Map<string, number>) => {
      const pts: { x: number; y: number }[] = [];
      periods.forEach((period, i) => {
        const v = map.get(period);
        if (v === undefined) return;
        pts.push({ x: xAt(i), y: yAt(v) });
      });
      if (pts.length === 0) return "";
      return pts
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(" ");
    };

    const yTicks = 5;
    const yLabels = Array.from({ length: yTicks }, (_, i) => {
      const t = i / (yTicks - 1);
      const value = yMax - t * (yMax - yMin);
      return { value, y: yAt(value) };
    });

    const xLabelCount = Math.min(10, periods.length);
    const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
      const idx =
        xLabelCount === 1
          ? 0
          : Math.round((i / (xLabelCount - 1)) * (periods.length - 1));
      return { idx, period: periods[idx], x: xAt(idx) };
    });

    const zeroY = yMin < 0 && yMax > 0 ? yAt(0) : null;
    const slotW = periods.length > 0 ? innerW / periods.length : innerW;

    return {
      width,
      height,
      pad,
      innerW,
      innerH,
      periods,
      primaryMap,
      secondaryMap,
      primaryLine: lineFor(primaryMap),
      secondaryLine: lineFor(secondaryMap),
      yLabels,
      xLabels,
      zeroY,
      xAt,
      yAt,
      slotW,
    };
  }, [primary, secondary, maxYears, fromPeriod]);

  if (!chart) {
    return (
      <p className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
        표시할 시계열이 없습니다.
      </p>
    );
  }

  const focusIdx = hover ?? chart.periods.length - 1;
  const focusPeriod = chart.periods[focusIdx];
  const primaryValue = chart.primaryMap.get(focusPeriod);
  const secondaryValue = chart.secondaryMap.get(focusPeriod);
  const focusX = chart.xAt(focusIdx);
  const primaryY =
    primaryValue !== undefined ? chart.yAt(primaryValue) : null;
  const secondaryY =
    secondaryValue !== undefined ? chart.yAt(secondaryValue) : null;
  const tooltipLeft =
    focusX > chart.pad.left + chart.innerW * 0.65
      ? focusX - 168
      : focusX + 12;
  const showingHover = hover !== null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            {focusPeriod}
            {showingHover ? " · 선택" : ""}
          </p>
          <div className="mt-1 flex flex-wrap gap-4 text-sm tabular-nums">
            <p style={{ color: primaryColor }}>
              {primaryLabel}{" "}
              <span className="text-base font-semibold text-slate-900">
                {formatSigned(primaryValue, digits)}
                {unit}
              </span>
            </p>
            <p style={{ color: secondaryColor }}>
              {secondaryLabel}{" "}
              <span className="text-base font-semibold text-slate-900">
                {formatSigned(secondaryValue, digits)}
                {unit}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-3 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4"
                style={{ background: primaryColor }}
              />
              {primaryLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4"
                style={{ background: secondaryColor }}
              />
              {secondaryLabel}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            {chart.periods[0]} ~ {chart.periods[chart.periods.length - 1]}
            {fromPeriod
              ? ` · ${fromPeriod}~`
              : ` · 최대 ${maxYears}년`}{" "}
            · 그래프 위에 마우스를 올리면 증가율 표시
          </p>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-auto w-full min-w-[640px] cursor-crosshair"
          role="img"
          aria-label={`${primaryLabel}·${secondaryLabel} 시계열`}
          onMouseLeave={() => setHover(null)}
        >
          {chart.yLabels.map((tick) => (
            <g key={tick.value}>
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
                {formatValue(tick.value, digits)}
              </text>
            </g>
          ))}

          {chart.zeroY !== null ? (
            <line
              x1={chart.pad.left}
              x2={chart.pad.left + chart.innerW}
              y1={chart.zeroY}
              y2={chart.zeroY}
              stroke="#94a3b8"
              strokeWidth="1"
            />
          ) : null}

          <path
            d={chart.secondaryLine}
            fill="none"
            stroke={secondaryColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={chart.primaryLine}
            fill="none"
            stroke={primaryColor}
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

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

          {primaryY !== null ? (
            <circle
              cx={focusX}
              cy={primaryY}
              r={showingHover ? 5.5 : 4.5}
              fill="#fff"
              stroke={primaryColor}
              strokeWidth="2.4"
            />
          ) : null}
          {secondaryY !== null ? (
            <circle
              cx={focusX}
              cy={secondaryY}
              r={showingHover ? 5.5 : 4.5}
              fill="#fff"
              stroke={secondaryColor}
              strokeWidth="2.4"
            />
          ) : null}

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
            className="pointer-events-none absolute top-3 z-10 min-w-[150px] rounded-sm border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-sm backdrop-blur"
            style={{
              left: `clamp(0px, ${(tooltipLeft / chart.width) * 100}%, calc(100% - 160px))`,
            }}
          >
            <p className="font-medium text-slate-800">{focusPeriod}</p>
            <p className="mt-1 tabular-nums" style={{ color: primaryColor }}>
              {primaryLabel} {formatSigned(primaryValue, digits)}
              {unit}
            </p>
            <p className="tabular-nums" style={{ color: secondaryColor }}>
              {secondaryLabel} {formatSigned(secondaryValue, digits)}
              {unit}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
