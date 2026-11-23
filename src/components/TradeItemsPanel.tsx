import { formatSigned } from "@/lib/format";
import type { TradeItemAgg } from "@/lib/types";

function shiftMonth(period: string, delta: number): string | undefined {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return undefined;
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function deltaClass(value: number | undefined): string {
  if ((value ?? 0) > 0) return "text-rose-700";
  if ((value ?? 0) < 0) return "text-teal-700";
  return "text-slate-600";
}

function withPrev(current: number, previous: number | undefined) {
  if (previous === undefined) return current.toFixed(1);
  return (
    <>
      {current.toFixed(1)}{" "}
      <span className="text-slate-500">({previous.toFixed(1)})</span>
    </>
  );
}

export function TradeItemsPanel({
  items,
  period,
  loading = false,
  error = null,
}: {
  items: TradeItemAgg[];
  period: string;
  loading?: boolean;
  error?: string | null;
}) {
  const prev = shiftMonth(period, -1);
  const yoy = shiftMonth(period, -12);

  const latestRows = items
    .filter((i) => i.period === period)
    .sort((a, b) => b.expEok - a.expEok);
  const prevMap = new Map(
    items.filter((i) => i.period === prev).map((i) => [i.hsCode, i]),
  );
  const yoyMap = new Map(
    items.filter((i) => i.period === yoy).map((i) => [i.hsCode, i]),
  );

  return (
    <section aria-labelledby="trade-items-heading" className="space-y-4">
      <div>
        <h2
          id="trade-items-heading"
          className="font-[family-name:var(--font-display)] text-xl text-slate-900"
        >
          주요 품목별 수출입
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          관세청 품목별 API(HS 4단위 집계) · 기준{" "}
          <span className="font-medium text-teal-900">{period}</span>
          {prev ? ` · 전월 ${prev}` : ""}
          {yoy ? ` · 전년동월 ${yoy}` : ""}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">품목별 자료를 불러오는 중…</p>
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {!loading && !error && latestRows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {period} 품목별 자료가 없습니다. 다른 월을 선택해 보세요.
        </p>
      ) : null}

      {!loading && latestRows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">HS</th>
                <th className="py-2 pr-3 font-medium">품목</th>
                <th className="py-2 pr-3 font-medium">수출(억$, 전월)</th>
                <th className="py-2 pr-3 font-medium">수입(억$, 전월)</th>
                <th className="py-2 pr-3 font-medium">수지(억$, 전월)</th>
                <th className="py-2 pr-3 font-medium">수출 전월비</th>
                <th className="py-2 font-medium">수출 전년비</th>
              </tr>
            </thead>
            <tbody>
              {latestRows.map((row) => {
                const before = prevMap.get(row.hsCode);
                const yearAgo = yoyMap.get(row.hsCode);
                const dMom =
                  before !== undefined
                    ? Number((row.expEok - before.expEok).toFixed(1))
                    : undefined;
                const dYoy =
                  yearAgo !== undefined
                    ? Number((row.expEok - yearAgo.expEok).toFixed(1))
                    : undefined;
                return (
                  <tr key={row.hsCode} className="border-b border-slate-200">
                    <td className="py-2 pr-3 tabular-nums text-slate-600">
                      {row.hsCode}
                    </td>
                    <td className="py-2 pr-3 text-slate-900">{row.nameKo}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {withPrev(row.expEok, before?.expEok)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {withPrev(row.impEok, before?.impEok)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {withPrev(row.balEok, before?.balEok)}
                    </td>
                    <td className={`py-2 pr-3 tabular-nums ${deltaClass(dMom)}`}>
                      {formatSigned(dMom)}
                    </td>
                    <td className={`py-2 tabular-nums ${deltaClass(dYoy)}`}>
                      {formatSigned(dYoy)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
