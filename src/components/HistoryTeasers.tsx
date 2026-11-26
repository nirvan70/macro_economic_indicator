import Link from "next/link";
import type { IndicatorSnapshot } from "@/lib/analysis";
import { clusterBySubgroup } from "@/lib/analysis";
import { MiniBarChart } from "@/components/MiniBarChart";
import { MiniDualSpark } from "@/components/MiniDualSpark";
import { MiniSpark } from "@/components/MiniSpark";
import { INDICATOR_GROUPS } from "@/lib/indicators";
import type { DataStore, IndicatorId, Observation } from "@/lib/types";

const NA_IDS = new Set<IndicatorId>([
  "gdp",
  "consumption",
  "govConsumption",
  "facilityInvestment",
  "constructionInvestment",
  "ipInvestment",
  "naExport",
  "naImport",
]);

function naYoySeries(
  store: DataStore,
  id: IndicatorId,
): Observation[] | undefined {
  if (id === "gdp") return store.gdpYoy;
  if (id === "consumption") return store.consumptionYoy;
  if (id === "govConsumption") return store.govConsumptionYoy;
  if (id === "facilityInvestment") return store.facilityInvestmentYoy;
  if (id === "constructionInvestment") return store.constructionInvestmentYoy;
  if (id === "ipInvestment") return store.ipInvestmentYoy;
  if (id === "naExport") return store.naExportYoy;
  if (id === "naImport") return store.naImportYoy;
  return undefined;
}

/** Long-run teaser charts always start at 2000Q1 / 2000-01. */
function from2000(series: Observation[]): Observation[] {
  return series.filter((row) => {
    const year = Number(row.period.slice(0, 4));
    if (!Number.isFinite(year) || year < 2000) return false;
    if (row.period.includes("-Q")) return row.period >= "2000-Q1";
    if (/^\d{4}-\d{2}-\d{2}$/.test(row.period)) return row.period >= "2000-01-01";
    return row.period >= "2000-01";
  });
}

export function HistoryTeasers({
  snapshots,
  store,
}: {
  snapshots: IndicatorSnapshot[];
  store: DataStore;
}) {
  return (
    <section
      id="history-longrun"
      aria-labelledby="history-heading"
      className="scroll-mt-24 space-y-3 rounded-sm bg-white/75 px-3 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur sm:px-5"
    >
      <div>
        <h2
          id="history-heading"
          className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-slate-900"
        >
          데이터 장기시계열(2000년~)
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          2000년 1분기(월별·일별은 2000년 1월)부터의 장기 추이를 보여 줍니다.
          지표를 누르면 과거 추이 그래프와 최근 관측표를 볼 수 있습니다.
        </p>
      </div>
      <div className="space-y-5">
        {INDICATOR_GROUPS.map((group) => {
          const items = snapshots.filter((item) => item.groupId === group.id);
          if (items.length === 0) return null;
          return (
            <div key={group.id}>
              <p className="mb-2 font-[family-name:var(--font-display)] text-base font-bold tracking-tight text-slate-900">
                {group.nameKo}
                {group.freqEn ? (
                  <span className="ml-1.5 text-[11px] font-medium tracking-normal text-slate-500">
                    ({group.freqEn})
                  </span>
                ) : null}
              </p>
              <div className="space-y-3">
                {clusterBySubgroup(items).map((cluster) => (
                  <div key={cluster.label ?? "__root"}>
                    {cluster.label ? (
                      <p className="mb-1.5 text-xs font-semibold text-slate-600">
                        {cluster.label}
                      </p>
                    ) : null}
                    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {cluster.items.map((item) => {
                        const series = from2000(
                          store.observations[item.id] ?? [],
                        );
                        const values = series.map((row) => row.value);
                        const yoy = NA_IDS.has(item.id)
                          ? from2000(naYoySeries(store, item.id) ?? [])
                          : [];
                        const title = cluster.label
                          ? `${cluster.label} ${item.nameKo}`
                          : item.nameKo;
                        return (
                          <li key={item.id}>
                            <Link
                              href={`/indicator/${item.id}`}
                              className="group flex h-full flex-col gap-1.5 border-b border-slate-200 px-1 py-2 transition hover:border-teal-700/35 hover:bg-white/50"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium leading-snug text-slate-900 group-hover:text-teal-900">
                                  {title}
                                </p>
                                <p className="mt-0.5 truncate text-[10px] tabular-nums text-slate-500">
                                  {series[0]?.period ?? "—"}–
                                  {series[series.length - 1]?.period ?? "—"} ·{" "}
                                  {series.length}
                                </p>
                              </div>
                              <div className="mt-auto flex items-end justify-between gap-1">
                                <div className="h-9 w-[5.25rem] shrink-0 overflow-hidden">
                                  {item.id === "fedwatchHike" ? (
                                    <MiniBarChart
                                      values={values}
                                      periods={series.map((row) => row.period)}
                                      className="h-9 w-[5.25rem]"
                                    />
                                  ) : NA_IDS.has(item.id) ? (
                                    <MiniDualSpark
                                      primary={{
                                        values,
                                        periods: series.map((row) => row.period),
                                        stroke: "#0f766e",
                                      }}
                                      secondary={{
                                        values: yoy.map((row) => row.value),
                                        periods: yoy.map((row) => row.period),
                                        stroke: "#b45309",
                                      }}
                                      width={84}
                                      height={36}
                                      className="h-9 w-[5.25rem]"
                                    />
                                  ) : (
                                    <MiniSpark
                                      values={values}
                                      periods={series.map((row) => row.period)}
                                      width={84}
                                      height={36}
                                      className="h-9 w-[5.25rem]"
                                    />
                                  )}
                                </div>
                                <span className="shrink-0 text-[10px] text-teal-800 opacity-80 group-hover:opacity-100">
                                  →
                                </span>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
