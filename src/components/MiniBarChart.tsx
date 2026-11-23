function shortMeetingLabel(period: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) return period;
  const [, m, d] = period.split("-");
  return `${Number(m)}.${Number(d)}`;
}

/** Compact horizontal bar chart for card teasers (e.g. FedWatch outlook). */
export function MiniBarChart({
  values,
  periods,
  className = "h-14 w-[6.75rem]",
  barColor = "#0f766e",
}: {
  values: number[];
  periods?: string[];
  className?: string;
  barColor?: string;
}) {
  if (values.length === 0) return null;

  const width = 140;
  const height = 56;
  const padL = 2;
  const padR = 2;
  const padT = 4;
  const padB = 14;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const n = values.length;
  const gap = n > 1 ? Math.min(4, plotW / (n * 4)) : 0;
  const barW = (plotW - gap * (n - 1)) / n;
  const maxVal = Math.max(100, ...values.map((v) => Math.abs(v)));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="향후 회의별 확률 막대그래프"
    >
      {values.map((value, i) => {
        const h = Math.max(1, (Math.abs(value) / maxVal) * plotH);
        const x = padL + i * (barW + gap);
        const y = padT + plotH - h;
        return (
          <g key={periods?.[i] ?? i}>
            <rect
              x={x}
              y={y}
              width={Math.max(2, barW)}
              height={h}
              rx={1.5}
              fill={barColor}
              opacity={0.55 + (0.45 * (i + 1)) / n}
            />
            {periods?.[i] ? (
              <text
                x={x + barW / 2}
                y={height - 3}
                textAnchor="middle"
                className="fill-slate-500"
                style={{ fontSize: 7 }}
              >
                {shortMeetingLabel(periods[i])}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
