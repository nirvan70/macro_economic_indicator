"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { Observation } from "@/lib/types";
import { formatValue } from "@/lib/format";

type Props = {
  series: Observation[];
  unit: string;
  accent?: string;
  digits?: number;
  /** Controlled selected period (YYYY-MM, YYYY-Qn, or YYYY-MM-DD). */
  selectedPeriod?: string | null;
  onPeriodSelect?: (period: string) => void;
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

export function HistoryChart({
  series,
  unit,
  accent = "#0f766e",
  digits = 1,
  selectedPeriod = null,
  onPeriodSelect,
  hint,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const fillId = `histFill-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    if (!selectedPeriod) {
      setSelected(null);
      return;
    }
    const idx = series.findIndex((s) => s.period === selectedPeriod);
    setSelected(idx >= 0 ? idx : null);
  }, [selectedPeriod, series]);

  const chart = useMemo(() => {
    const width = 920;
    const height = 360;
    const pad = { top: 24, right: 20, bottom: 40, left: 52 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const values = series.map((s) => s.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const span = maxV - minV || 1;
    const yMin = minV - span * 0.12;
    const yMax = maxV + span * 0.12;

    const xAt = (i: number) =>
      pad.left + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
    const yAt = (v: number) =>
      pad.top + ((yMax - v) / (yMax - yMin || 1)) * innerH;

    const points = series.map((obs, i) => ({
      ...obs,
      x: xAt(i),
      y: yAt(obs.value),
    }));

    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");

    const area =
      points.length > 0
        ? `${line} L${points[points.length - 1].x.toFixed(2)} ${(pad.top + innerH).toFixed(2)} L${points[0].x.toFixed(2)} ${(pad.top + innerH).toFixed(2)} Z`
        : "";

    const yTicks = 5;
    const yLabels = Array.from({ length: yTicks }, (_, i) => {
      const t = i / (yTicks - 1);
      const value = yMax - t * (yMax - yMin);
      return { value, y: yAt(value) };
    });

    const xLabelCount = Math.min(8, series.length);
    const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
      const idx =
        xLabelCount === 1
          ? 0
          : Math.round((i / (xLabelCount - 1)) * (series.length - 1));
      return { idx, period: series[idx].period, x: xAt(idx) };
    });

    const zeroY = yMin < 0 && yMax > 0 ? yAt(0) : null;

    return {
      width,
      height,
      pad,
      innerW,
      innerH,
      points,
      line,
      area,
      yLabels,
      xLabels,
      zeroY,
    };
  }, [series]);

  if (series.length === 0) {
    return (
      <p className="rounded border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
        표시할 시계열이 없습니다.
      </p>
    );
  }

  const focusIdx =
    hover !== null
      ? hover
      : selected !== null
        ? selected
        : chart.points.length - 1;
  const active = chart.points[focusIdx];
  const selectedPoint = selected !== null ? chart.points[selected] : null;
  const selectable = Boolean(onPeriodSelect);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            {active.period}
            {selectedPoint && selectedPoint.period === active.period
              ? " · 선택됨"
              : ""}
          </p>
          <p className="font-[family-name:var(--font-display)] text-3xl tabular-nums text-slate-900">
            {formatValue(active.value, digits)}
            <span className="ml-2 text-sm font-normal text-slate-500">{unit}</span>
          </p>
        </div>
        <p className="text-xs text-slate-500">
          {hint ??
            `${series[0].period} ~ ${series[series.length - 1].period} · ${series.length}개 관측`}
        </p>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className={`h-auto w-full min-w-[640px] ${selectable ? "cursor-crosshair" : ""}`}
          role="img"
          aria-label="시계열 그래프"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
            </linearGradient>
          </defs>

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
                className="fill-slate-500"
                fontSize="11"
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

          <path d={chart.area} fill={`url(#${fillId})`} />
          <path
            d={chart.line}
            fill="none"
            stroke={accent}
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {selectedPoint ? (
            <line
              x1={selectedPoint.x}
              x2={selectedPoint.x}
              y1={chart.pad.top}
              y2={chart.pad.top + chart.innerH}
              stroke={accent}
              strokeOpacity="0.35"
              strokeDasharray="4 4"
            />
          ) : null}

          {chart.xLabels.map((tick) => (
            <text
              key={`${tick.period}-${tick.idx}`}
              x={tick.x}
              y={chart.height - 14}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize="11"
            >
              {formatTick(tick.period)}
            </text>
          ))}

          {chart.points.map((point, i) => (
            <rect
              key={point.period}
              x={point.x - chart.innerW / series.length / 2}
              y={chart.pad.top}
              width={Math.max(chart.innerW / series.length, 4)}
              height={chart.innerH}
              fill="transparent"
              className={selectable ? "cursor-pointer" : undefined}
              onMouseEnter={() => setHover(i)}
              onClick={() => {
                if (!onPeriodSelect) return;
                setSelected(i);
                onPeriodSelect(point.period);
              }}
            />
          ))}

          <circle
            cx={active.x}
            cy={active.y}
            r="5"
            fill="#fff"
            stroke={accent}
            strokeWidth="2.5"
          />
          {selectedPoint ? (
            <circle
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r="7"
              fill="none"
              stroke={accent}
              strokeWidth="2"
            />
          ) : null}
        </svg>
      </div>
      {selectable ? (
        <p className="text-xs text-slate-500">
          그래프 위에서 월을 가리킨 뒤 클릭하면 해당 월 품목별 수출입이 아래에 표시됩니다.
        </p>
      ) : null}
    </div>
  );
}
