import Link from "next/link";
import type { IndicatorSnapshot } from "@/lib/analysis";
import {
  clusterBySubgroup,
  formatSigned,
  formatValue,
} from "@/lib/analysis";
import { MiniBarChart } from "@/components/MiniBarChart";
import { MiniDualSpark } from "@/components/MiniDualSpark";
import { MiniSpark } from "@/components/MiniSpark";
import { INDICATOR_GROUPS } from "@/lib/indicators";
import type { DataStore, Observation } from "@/lib/types";

const FREQ: Record<string, string> = {
  daily: "일간",
  weekly: "주간",
  monthly: "월간",
  quarterly: "분기",
};

function IndicatorCard({
  item,
  values,
  periods,
  yoyValue,
  yoySeries,
}: {
  item: IndicatorSnapshot;
  values: number[];
  periods: string[];
  /** 전년동월비·전년동기비 (%) — 산업활동·소매판매·국민계정 카드용 */
  yoyValue?: number;
  /** 국민계정 카드용 전년동기비 시계열 */
  yoySeries?: Observation[];
}) {
  const isMomYoyCard =
    item.id === "industrial" ||
    item.id === "retail" ||
    item.id === "serviceSales";
  const isNaCard =
    item.id === "gdp" ||
    item.id === "consumption" ||
    item.id === "govConsumption" ||
    item.id === "facilityInvestment" ||
    item.id === "constructionInvestment" ||
    item.id === "ipInvestment" ||
    item.id === "naExport" ||
    item.id === "naImport";
  const headlineValue =
    isNaCard && yoyValue !== undefined ? yoyValue : item.value;
  const change =
    item.id === "trade"
      ? (item.yoyPct ?? 0)
      : isMomYoyCard
        ? (item.value ?? 0)
        : isNaCard
          ? (yoyValue ?? item.value ?? 0)
          : (item.delta ?? 0);
  const up = change > 0;
  const down = change < 0;
  const stroke = up ? "#be123c" : down ? "#0f766e" : "#64748b";
  const yoyUp = (yoyValue ?? 0) > 0;
  const yoyDown = (yoyValue ?? 0) < 0;
  const tone = up ? "text-rose-700" : down ? "text-teal-700" : "text-slate-600";
  const yoyTone =
    yoyValue === undefined
      ? "text-slate-500"
      : yoyUp
        ? "text-rose-700"
        : yoyDown
          ? "text-teal-700"
          : "text-slate-600";
  const qoqTone =
    (item.value ?? 0) > 0
      ? "text-rose-700"
      : (item.value ?? 0) < 0
        ? "text-teal-700"
        : "text-slate-600";
  const qoqStroke =
    (item.value ?? 0) > 0
      ? "#be123c"
      : (item.value ?? 0) < 0
        ? "#0f766e"
        : "#64748b";
  const yoyStroke = yoyUp ? "#b45309" : yoyDown ? "#0e7490" : "#64748b";

  return (
    <Link
      href={`/indicator/${item.id}`}
      className="group block rounded-lg bg-white/75 px-2.5 py-2 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_24px_-16px_rgba(15,23,42,0.3)]"
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <h3 className="truncate font-[family-name:var(--font-display)] text-[15px] font-bold leading-snug tracking-tight text-slate-900 sm:text-base">
              {item.nameKo}
            </h3>
            <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-slate-500">
              {FREQ[item.frequency] ?? item.frequency}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">
            {item.agencyKo}
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-display)] text-lg tabular-nums leading-none text-slate-900">
            {formatValue(headlineValue, item.valueDigits)}
            {isMomYoyCard || isNaCard ? (
              <span className="ml-1 text-[11px] font-normal text-slate-500">
                %
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">
            {isMomYoyCard
              ? "% (전월비)"
              : isNaCard
                ? "% (전년동기비·원계열)"
                : item.unit}
          </p>
          {item.id === "fedwatchHike" ? (
            <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
              <p>차기 FOMC · 25bp 인상</p>
              {(item.hike50Plus != null && item.hike50Plus > 0) ||
              (item.hold != null && item.hold > 0) ||
              (item.cut != null && item.cut > 0) ? (
                <p className="tabular-nums text-slate-500">
                  {item.hike50Plus != null && item.hike50Plus > 0
                    ? `50bp+ ${item.hike50Plus.toFixed(1)}%`
                    : null}
                  {item.hike50Plus != null &&
                  item.hike50Plus > 0 &&
                  ((item.hold != null && item.hold > 0) ||
                    (item.cut != null && item.cut > 0))
                    ? " · "
                    : null}
                  {item.hold != null && item.hold > 0
                    ? `동결 ${item.hold.toFixed(1)}%`
                    : null}
                  {item.hold != null &&
                  item.hold > 0 &&
                  item.cut != null &&
                  item.cut > 0
                    ? " · "
                    : null}
                  {item.cut != null && item.cut > 0
                    ? `인하 ${item.cut.toFixed(1)}%`
                    : null}
                </p>
              ) : null}
            </div>
          ) : item.id === "trade" ? (
            <div className="mt-1 space-y-0.5 text-[11px] tabular-nums">
              <p
                className={
                  (item.yoyPct ?? 0) > 0
                    ? "text-rose-700"
                    : (item.yoyPct ?? 0) < 0
                      ? "text-teal-700"
                      : "text-slate-600"
                }
              >
                전년동월비 {formatSigned(item.yoyPct, 1)}%
              </p>
              <p
                className={
                  (item.yoyDelta ?? 0) > 0
                    ? "text-rose-700"
                    : (item.yoyDelta ?? 0) < 0
                      ? "text-teal-700"
                      : "text-slate-600"
                }
              >
                전년대비 증가액 {formatSigned(item.yoyDelta, item.valueDigits)}억$
              </p>
            </div>
          ) : item.id === "currentAccount" ? (
            <p
              className={`mt-1 text-[11px] tabular-nums ${
                (item.yoyDelta ?? 0) > 0
                  ? "text-rose-700"
                  : (item.yoyDelta ?? 0) < 0
                    ? "text-teal-700"
                    : "text-slate-600"
              }`}
            >
              전년대비 증가액{" "}
              {item.yoyDelta === undefined
                ? "—"
                : `${formatSigned(item.yoyDelta, item.valueDigits)}억$`}
            </p>
          ) : item.id === "usdkrw" ||
            item.id === "kospi" ||
            item.id === "kosdaq" ||
            item.id === "call" ||
            item.id === "ktb3y" ||
            item.id === "ktb10y" ||
            item.id === "usdjpy" ||
            item.id === "eurusd" ||
            item.id === "usdIndex" ||
            item.id === "usnasdaq" ||
            item.id === "ussp500" ||
            item.id === "usdjia" ||
            item.id === "oilWti" ||
            item.id === "oilDubai" ||
            item.id === "ust1y" ||
            item.id === "ust10y" ||
            item.id === "ust30y" ? (
            <p className={`mt-1 text-[11px] tabular-nums ${tone}`}>
              전일대비 {formatSigned(item.delta, item.valueDigits)}
            </p>
          ) : isMomYoyCard ? (
            <p className={`mt-1 text-[11px] tabular-nums ${yoyTone}`}>
              전년동월비{" "}
              {yoyValue === undefined
                ? "—"
                : `${formatSigned(yoyValue, item.valueDigits)}%`}
            </p>
          ) : isNaCard ? (
            <p className={`mt-1 text-[11px] tabular-nums ${qoqTone}`}>
              전분기비(SA) {formatSigned(item.value, item.valueDigits)}%
            </p>
          ) : item.id === "cpi" ? (
            <p className={`mt-1 text-[11px] tabular-nums ${tone}`}>
              전기비 {formatSigned(item.delta, item.valueDigits)}%
            </p>
          ) : item.id === "employment" || item.id === "unemployment" ? (
            <p className={`mt-1 text-[11px] tabular-nums ${tone}`}>
              전기비 {formatSigned(item.delta, item.valueDigits)}%p
            </p>
          ) : item.id === "consumerSentiment" ||
            item.id === "compositeIndex" ||
            item.id === "coincidentIndex" ||
            item.id === "leadingIndex" ? (
            <p className={`mt-1 text-[11px] tabular-nums ${tone}`}>
              전기비 {formatSigned(item.delta, item.valueDigits)}p
            </p>
          ) : (
            <p className={`mt-1 text-[11px] tabular-nums ${tone}`}>
              전기비 {formatSigned(item.delta, item.valueDigits)}
            </p>
          )}
          <p className="mt-0.5 truncate text-[10px] text-slate-400">
            {item.id === "fedwatchHike"
              ? `회의 ${item.period ?? "—"} · 기준 ${item.releasedAt ?? "—"}`
              : `${item.period ?? "—"} · ${item.releasedAt ?? "발표일 미상"}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between self-stretch pt-0.5">
          <div className="group/spark relative z-20 h-14 w-[6.75rem] shrink-0">
            <div className="absolute right-0 top-0 rounded-md p-0.5 transition-all duration-300 ease-out group-hover/spark:bg-white/95 group-hover/spark:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.4)] group-hover/spark:ring-1 group-hover/spark:ring-slate-900/8">
              {item.id === "fedwatchHike" ? (
                <MiniBarChart
                  values={values}
                  periods={periods}
                  barColor={stroke}
                  className="h-14 w-[6.75rem] transition-all duration-300 ease-out group-hover/spark:h-28 group-hover/spark:w-64"
                />
              ) : isNaCard ? (
                <MiniDualSpark
                  primary={{
                    values,
                    periods,
                    stroke: qoqStroke,
                  }}
                  secondary={{
                    values: (yoySeries ?? []).map((row) => row.value),
                    periods: (yoySeries ?? []).map((row) => row.period),
                    stroke: yoyStroke,
                  }}
                  className="h-14 w-[6.75rem] transition-all duration-300 ease-out group-hover/spark:h-28 group-hover/spark:w-64"
                />
              ) : (
                <MiniSpark
                  values={values}
                  periods={periods}
                  stroke={stroke}
                  className="h-14 w-[6.75rem] transition-all duration-300 ease-out group-hover/spark:h-28 group-hover/spark:w-64"
                />
              )}
            </div>
          </div>
          <p className="mt-1 text-[10px] font-medium text-teal-800 opacity-0 transition group-hover:opacity-100">
            {item.id === "fedwatchHike" ? "전망 →" : "추이 →"}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function SummaryCards({
  snapshots,
  store,
}: {
  snapshots: IndicatorSnapshot[];
  store: DataStore;
}) {
  const groups = INDICATOR_GROUPS.map((group) => ({
    ...group,
    items: snapshots.filter((item) => item.groupId === group.id),
  }));

  return (
    <section aria-label="주요 지표 요약" className="space-y-14 sm:space-y-16">
      {groups.map((group) => {
        const clusters = clusterBySubgroup(group.items);
        return (
          <div
            key={group.id}
            id={`group-${group.id}`}
            className="scroll-mt-24 space-y-2"
          >
            <div className="flex items-baseline gap-3 border-b border-slate-900/10 pb-1.5">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-slate-900">
                {group.nameKo}
                {group.freqEn ? (
                  <span className="ml-1.5 text-sm font-medium tracking-normal text-slate-500">
                    ({group.freqEn})
                  </span>
                ) : null}
              </h2>
              <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                {group.items.length}개 지표
              </span>
            </div>
            {group.items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-900/10 bg-white/50 px-3.5 py-4 text-sm text-slate-500">
                하위 지표를 곧 추가합니다.
              </div>
            ) : (
              <div className="space-y-2">
                {clusters.map((cluster, clusterIndex) => {
                  const spacedBlock =
                    cluster.label === "노동시장" ||
                    cluster.label === "물가" ||
                    cluster.label === "심리·경기종합" ||
                    cluster.label === "주식시장" ||
                    cluster.label === "금리" ||
                    cluster.label === "환율";
                  return (
                  <div
                    key={cluster.label ?? "__root"}
                    className={`space-y-1.5 ${
                      spacedBlock
                        ? "mt-3 border-t border-slate-900/10 pt-3"
                        : clusterIndex > 0
                          ? "mt-1.5"
                          : ""
                    }`}
                  >
                    {cluster.label ? (
                      <h3 className="pl-0.5 text-[15px] font-bold tracking-tight text-slate-700 sm:text-base">
                        {cluster.label}
                      </h3>
                    ) : null}
                    <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
                      {cluster.items.map((item) => {
                        const series = store.observations[item.id] ?? [];
                        const yoySeries =
                          item.id === "industrial"
                            ? store.industrialYoy
                            : item.id === "retail"
                              ? store.retailYoy
                              : item.id === "serviceSales"
                                ? store.serviceSalesYoy
                              : item.id === "gdp"
                                ? store.gdpYoy
                                : item.id === "consumption"
                                  ? store.consumptionYoy
                                  : item.id === "govConsumption"
                                    ? store.govConsumptionYoy
                                    : item.id === "facilityInvestment"
                                      ? store.facilityInvestmentYoy
                                      : item.id === "constructionInvestment"
                                        ? store.constructionInvestmentYoy
                                        : item.id === "ipInvestment"
                                          ? store.ipInvestmentYoy
                                          : item.id === "naExport"
                                            ? store.naExportYoy
                                            : item.id === "naImport"
                                              ? store.naImportYoy
                                              : undefined;
                        const yoyValue = item.period
                          ? yoySeries?.find((row) => row.period === item.period)
                              ?.value
                          : yoySeries?.at(-1)?.value;
                        return (
                        <IndicatorCard
                          key={item.id}
                          item={item}
                          values={series.map((row) => row.value)}
                          periods={series.map((row) => row.period)}
                          yoyValue={yoyValue}
                          yoySeries={yoySeries}
                        />
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
