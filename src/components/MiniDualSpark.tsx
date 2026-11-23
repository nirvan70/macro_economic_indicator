function formatAxisPeriod(period: string | undefined): string {
  if (!period) return "—";
  if (period.includes("-Q")) {
    const [y, q] = period.split("-Q");
    return `${y.slice(2)}.${q}Q`;
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-");
    return `${y.slice(2)}.${Number(m)}`;
  }
  return period.slice(2);
}

type SeriesInput = {
  values: number[];
  periods: string[];
  stroke: string;
};

function sampleAligned(
  primary: SeriesInput,
  secondary: SeriesInput,
  maxPoints: number,
): {
  periods: string[];
  a: (number | null)[];
  b: (number | null)[];
} {
  const mapA = new Map(
    primary.periods.map((p, i) => [p, primary.values[i]] as const),
  );
  const mapB = new Map(
    secondary.periods.map((p, i) => [p, secondary.values[i]] as const),
  );
  const periods = [
    ...new Set([...primary.periods, ...secondary.periods]),
  ].sort((x, y) => x.localeCompare(y));

  // Card sparklines stay readable with a recent window.
  const windowed =
    periods.length > maxPoints ? periods.slice(-maxPoints) : periods;

  return {
    periods: windowed,
    a: windowed.map((p) => mapA.get(p) ?? null),
    b: windowed.map((p) => mapB.get(p) ?? null),
  };
}

function linePath(
  values: (number | null)[],
  xAt: (i: number) => number,
  yAt: (v: number) => number,
): string {
  const parts: string[] = [];
  let started = false;
  values.forEach((v, i) => {
    if (v === null) {
      started = false;
      return;
    }
    const cmd = started ? "L" : "M";
    parts.push(`${cmd}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`);
    started = true;
  });
  return parts.join(" ");
}

/** Compact dual-line sparkline (e.g. QoQ + YoY on national-accounts cards). */
export function MiniDualSpark({
  primary,
  secondary,
  width = 120,
  height = 56,
  className = "h-14 w-[7.5rem]",
  maxPoints = 24,
}: {
  primary: SeriesInput;
  secondary: SeriesInput;
  width?: number;
  height?: number;
  className?: string;
  maxPoints?: number;
}) {
  if (primary.values.length < 2 && secondary.values.length < 2) return null;

  const aligned = sampleAligned(primary, secondary, maxPoints);
  const nums = [...aligned.a, ...aligned.b].filter(
    (v): v is number => v !== null,
  );
  if (nums.length < 2) return null;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;

  const compact = height < 44;
  const pad = compact
    ? { top: 3, right: 4, bottom: 3, left: 4 }
    : { top: 6, right: 8, bottom: 14, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const n = Math.max(aligned.periods.length, 2);

  const xAt = (i: number) => pad.left + (i / (n - 1)) * innerW;
  const yAt = (v: number) => pad.top + ((max - v) / span) * innerH;

  const axis = "#94a3b8";
  const label = "#64748b";
  const zeroY = min < 0 && max > 0 ? yAt(0) : null;
  const pathA = linePath(aligned.a, xAt, yAt);
  const pathB = linePath(aligned.b, xAt, yAt);

  let lastAi = -1;
  let lastA: number | undefined;
  aligned.a.forEach((v, i) => {
    if (v !== null) {
      lastAi = i;
      lastA = v;
    }
  });
  let lastBi = -1;
  let lastB: number | undefined;
  aligned.b.forEach((v, i) => {
    if (v !== null) {
      lastBi = i;
      lastB = v;
    }
  });

  const formatTick = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 100) return v.toFixed(0);
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
          <text
            x={pad.left}
            y={height - 2}
            textAnchor="start"
            fontSize="7"
            fill={label}
          >
            {formatAxisPeriod(aligned.periods[0])}
          </text>
          <text
            x={pad.left + innerW}
            y={height - 2}
            textAnchor="end"
            fontSize="7"
            fill={label}
          >
            {formatAxisPeriod(aligned.periods[aligned.periods.length - 1])}
          </text>
        </>
      ) : null}

      {pathB ? (
        <path
          d={pathB}
          fill="none"
          stroke={secondary.stroke}
          strokeWidth={compact ? 1.3 : 1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      {pathA ? (
        <path
          d={pathA}
          fill="none"
          stroke={primary.stroke}
          strokeWidth={compact ? 1.4 : 1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}

      {lastA !== undefined && lastAi >= 0 ? (
        <circle
          cx={xAt(lastAi)}
          cy={yAt(lastA)}
          r={compact ? 1.5 : 2}
          fill={primary.stroke}
        />
      ) : null}
      {lastB !== undefined && lastBi >= 0 ? (
        <circle
          cx={xAt(lastBi)}
          cy={yAt(lastB)}
          r={compact ? 1.5 : 2}
          fill={secondary.stroke}
        />
      ) : null}
    </svg>
  );
}
