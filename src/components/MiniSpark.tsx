function formatAxisPeriod(period: string | undefined): string {
  if (!period) return "—";
  if (period.includes("-Q")) {
    const [y, q] = period.split("-Q");
    return `${y.slice(2)}.${q}Q`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-");
    return `${y.slice(2)}.${m}`;
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-");
    return `${y.slice(2)}.${Number(m)}`;
  }
  return period.slice(2);
}

/** Compact sparkline with axes for card / list teasers. */
export function MiniSpark({
  values,
  periods,
  width = 120,
  height = 56,
  stroke = "#0f766e",
  className = "h-14 w-[7.5rem]",
}: {
  values: number[];
  /** Period labels aligned with `values` (YYYY-Qn, YYYY-MM, or YYYY-MM-DD). */
  periods?: string[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
}) {
  if (values.length < 2) return null;

  // Keep the spark readable when daily series are long.
  const maxPoints = 72;
  const step = Math.max(1, Math.ceil(values.length / maxPoints));
  const sampled = values.filter(
    (_, i) => i % step === 0 || i === values.length - 1,
  );
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = max - min || 1;

  const compact = height < 44;
  const pad = compact
    ? { top: 3, right: 4, bottom: 3, left: 4 }
    : { top: 6, right: 8, bottom: 14, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const xAt = (i: number) =>
    pad.left + (i / (sampled.length - 1)) * innerW;
  const yAt = (v: number) =>
    pad.top + ((max - v) / span) * innerH;

  const points = sampled
    .map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
    .join(" ");

  const last = sampled[sampled.length - 1];
  const axis = "#94a3b8";
  const label = "#64748b";

  const startLabel = formatAxisPeriod(periods?.[0] ?? undefined);
  const endLabel = formatAxisPeriod(
    periods?.[periods.length - 1] ?? undefined,
  );

  const formatTick = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 100) return v.toFixed(0);
    if (abs >= 10) return v.toFixed(1);
    return v.toFixed(1);
  };

  const yTicks = [
    { value: max, y: yAt(max) },
    { value: min, y: yAt(min) },
  ];
  if (span > 0 && Math.abs(max - min) > 1e-9) {
    const mid = (max + min) / 2;
    yTicks.splice(1, 0, { value: mid, y: yAt(mid) });
  }

  const zeroY = min < 0 && max > 0 ? yAt(0) : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <line
        x1={pad.left}
        y1={pad.top}
        x2={pad.left}
        y2={pad.top + innerH}
        stroke={axis}
        strokeWidth="1"
      />
      <line
        x1={pad.left}
        y1={pad.top + innerH}
        x2={pad.left + innerW}
        y2={pad.top + innerH}
        stroke={axis}
        strokeWidth="1"
      />

      {zeroY !== null ? (
        <line
          x1={pad.left}
          x2={pad.left + innerW}
          y1={zeroY}
          y2={zeroY}
          stroke="#cbd5e1"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      ) : null}

      {!compact
        ? yTicks.map((tick) => (
            <g key={`y-${tick.value}`}>
              <line
                x1={pad.left - 3}
                x2={pad.left}
                y1={tick.y}
                y2={tick.y}
                stroke={axis}
                strokeWidth="1"
              />
              <text
                x={pad.left - 5}
                y={tick.y + 2.5}
                textAnchor="end"
                fontSize="7"
                fill={label}
              >
                {formatTick(tick.value)}
              </text>
            </g>
          ))
        : null}

      {!compact ? (
        <>
          <line
            x1={pad.left}
            x2={pad.left}
            y1={pad.top + innerH}
            y2={pad.top + innerH + 3}
            stroke={axis}
            strokeWidth="1"
          />
          <line
            x1={pad.left + innerW}
            x2={pad.left + innerW}
            y1={pad.top + innerH}
            y2={pad.top + innerH + 3}
            stroke={axis}
            strokeWidth="1"
          />
          <text
            x={pad.left}
            y={height - 2}
            textAnchor="start"
            fontSize="7"
            fill={label}
          >
            {startLabel}
          </text>
          <text
            x={pad.left + innerW}
            y={height - 2}
            textAnchor="end"
            fontSize="7"
            fill={label}
          >
            {endLabel}
          </text>
        </>
      ) : null}

      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={compact ? 1.4 : 1.7}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
      <circle
        cx={xAt(sampled.length - 1)}
        cy={yAt(last)}
        r={compact ? 1.6 : 2.2}
        fill={stroke}
      />
    </svg>
  );
}
