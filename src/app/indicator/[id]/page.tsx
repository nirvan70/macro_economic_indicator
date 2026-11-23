import Link from "next/link";
import { notFound } from "next/navigation";
import { ConsumptionBreakdown } from "@/components/ConsumptionBreakdown";
import { DualHistoryChart } from "@/components/DualHistoryChart";
import { FedwatchBarChart } from "@/components/FedwatchBarChart";
import { HistoryChart } from "@/components/HistoryChart";
import { TradeExplore } from "@/components/TradeExplore";
import { formatSigned, formatValue } from "@/lib/analysis";
import { getIndicator, INDICATORS } from "@/lib/indicators";
import { shiftMonth } from "@/lib/sources/ecos";
import { previousObservation, readStore } from "@/lib/store";
import type { IndicatorId } from "@/lib/types";

export const dynamic = "force-dynamic";

const IDS: IndicatorId[] = INDICATORS.map((item) => item.id);

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function IndicatorHistoryPage({ params }: PageProps) {
  const { id } = await params;
  if (!IDS.includes(id as IndicatorId)) notFound();

  const indicatorId = id as IndicatorId;
  const meta = getIndicator(indicatorId);
  if (!meta) notFound();

  const store = await readStore();
  const series = store.observations[indicatorId] ?? [];
  const chartSeries =
    indicatorId === "fedwatchHike"
      ? series
      : series.filter((row) => {
          const year = Number(row.period.slice(0, 4));
          if (!Number.isFinite(year) || year < 2000) return false;
          if (row.period.includes("-Q")) return row.period >= "2000-Q1";
          if (/^\d{4}-\d{2}-\d{2}$/.test(row.period)) {
            return row.period >= "2000-01-01";
          }
          return row.period >= "2000-01";
        });
  const chartFromPeriod = meta.frequency === "quarterly" ? "2000-Q1" : "2000-01";
  const latest = series[series.length - 1];
  const previous = previousObservation(store, indicatorId);
  const digits = meta.valueDigits ?? 1;
  const delta =
    latest && previous !== undefined
      ? Number((latest.value - previous.value).toFixed(digits))
      : undefined;

  const years =
    chartSeries.length > 0
      ? `${chartSeries[0].period} ~ ${chartSeries[chartSeries.length - 1].period}`
      : series.length > 0
        ? `${series[0].period} ~ ${series[series.length - 1].period}`
        : "—";

  const valueByPeriod = new Map(series.map((row) => [row.period, row.value]));
  const tradeYoyPct = (period: string, value: number): number | undefined => {
    if (indicatorId !== "trade") return undefined;
    const yearAgo = valueByPeriod.get(shiftMonth(period, -12));
    if (yearAgo === undefined || yearAgo === 0) return undefined;
    return Number((((value / yearAgo) - 1) * 100).toFixed(1));
  };

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.14),transparent_42%),linear-gradient(180deg,#f4f7f6_0%,#eef2f0_50%,#f7f8f6_100%)]" />

      <header className="relative border-b border-slate-900/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-8 sm:px-8">
          <Link
            href="/"
            className="w-fit text-sm text-teal-900 underline-offset-4 hover:underline"
          >
            ← 대시보드로
          </Link>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-teal-900">
              {meta.agencyKo}
              {meta.subgroupKo ? ` · ${meta.subgroupKo}` : ""}
              {indicatorId === "fedwatchHike"
                ? " · 향후 6개월 전망"
                : " · 2000년~ 시계열"}
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-tight text-slate-950">
              {meta.subgroupKo
                ? `${meta.subgroupKo} ${meta.nameKo}`
                : meta.nameKo}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {meta.sourceHint} · {meta.unit}
            </p>
          </div>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="border-b border-slate-200 pb-3">
            <dt className="text-xs text-slate-500">최신</dt>
            <dd className="mt-1 font-[family-name:var(--font-display)] text-2xl tabular-nums">
              {formatValue(latest?.value, digits)}
            </dd>
          </div>
          <div className="border-b border-slate-200 pb-3">
            <dt className="text-xs text-slate-500">
              {indicatorId === "fedwatchHike" ? "다음 회의" : "전기비"}
            </dt>
            <dd className="mt-1 font-[family-name:var(--font-display)] text-2xl tabular-nums">
              {indicatorId === "fedwatchHike"
                ? (series[1]
                    ? `${formatValue(series[1].value, digits)}%`
                    : "—")
                : formatSigned(delta, digits)}
            </dd>
          </div>
          <div className="border-b border-slate-200 pb-3">
            <dt className="text-xs text-slate-500">기간</dt>
            <dd className="mt-1 text-sm text-slate-800">{years}</dd>
          </div>
          <div className="border-b border-slate-200 pb-3">
            <dt className="text-xs text-slate-500">
              {indicatorId === "fedwatchHike" ? "회의 수" : "관측 수"}
            </dt>
            <dd className="mt-1 text-sm text-slate-800">{series.length}개</dd>
          </div>
        </dl>

        {indicatorId === "trade" ? (
          <TradeExplore
            exportSeries={series}
            exportUnit={meta.unit}
            initialItems={store.tradeItems ?? []}
          />
        ) : indicatorId === "fedwatchHike" ? (
          <section className="rounded-sm bg-white/75 px-3 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur sm:px-5">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl text-slate-900">
              향후 6개월 · 회의별 +25bp 인상 확률
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              차기부터 약 6개월 내 FOMC 회의별로, 현 목표구간보다 금리가 높아질
              확률을 막대로 표시합니다.
            </p>
            <FedwatchBarChart series={series} unit="%" digits={digits} />
          </section>
        ) : indicatorId === "industrial" || indicatorId === "retail" ? (
          <section className="rounded-sm bg-white/75 px-3 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur sm:px-5">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl text-slate-900">
              과거 추이
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              전월비(계절조정)와 전년동월비
              {indicatorId === "retail" ? "(불변지수)" : "(원계열)"}를 함께
              표시합니다.
            </p>
            <DualHistoryChart
              primary={chartSeries}
              secondary={
                indicatorId === "industrial"
                  ? (store.industrialYoy ?? [])
                  : (store.retailYoy ?? [])
              }
              primaryLabel="전월비"
              secondaryLabel="전년동월비"
              unit="%"
              digits={digits}
              fromPeriod={chartFromPeriod}
              primaryColor="#0f766e"
              secondaryColor="#b45309"
            />
          </section>
        ) : indicatorId === "gdp" ||
          indicatorId === "consumption" ||
          indicatorId === "govConsumption" ||
          indicatorId === "facilityInvestment" ||
          indicatorId === "constructionInvestment" ||
          indicatorId === "ipInvestment" ||
          indicatorId === "naExport" ||
          indicatorId === "naImport" ? (
          <section className="rounded-sm bg-white/75 px-3 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur sm:px-5">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl text-slate-900">
              과거 추이
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              전분기비는 계절조정, 전년동기비는 원계열 기준이며 2000년 1분기부터
              표시합니다.
            </p>
            <DualHistoryChart
              primary={chartSeries}
              secondary={
                indicatorId === "gdp"
                  ? (store.gdpYoy ?? [])
                  : indicatorId === "consumption"
                    ? (store.consumptionYoy ?? [])
                    : indicatorId === "govConsumption"
                      ? (store.govConsumptionYoy ?? [])
                      : indicatorId === "facilityInvestment"
                        ? (store.facilityInvestmentYoy ?? [])
                        : indicatorId === "constructionInvestment"
                          ? (store.constructionInvestmentYoy ?? [])
                          : indicatorId === "ipInvestment"
                            ? (store.ipInvestmentYoy ?? [])
                            : indicatorId === "naExport"
                              ? (store.naExportYoy ?? [])
                              : (store.naImportYoy ?? [])
              }
              primaryLabel="전분기비(SA)"
              secondaryLabel="전년동기비(원계열)"
              unit="%"
              digits={digits}
              fromPeriod="2000-Q1"
              primaryColor="#0f766e"
              secondaryColor="#b45309"
            />
          </section>
        ) : (
          <section className="rounded-sm bg-white/75 px-3 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur sm:px-5">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl text-slate-900">
              과거 추이
            </h2>
            <HistoryChart
              series={chartSeries}
              unit={meta.unit}
              digits={digits}
            />
          </section>
        )}

        {indicatorId === "consumption" ? (
          <ConsumptionBreakdown
            components={store.consumptionComponents ?? []}
          />
        ) : null}

        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-slate-900">
            {indicatorId === "fedwatchHike" ? "회의별 전망" : "최근 관측값"}
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">
                    {indicatorId === "fedwatchHike" ? "회의일" : "기간"}
                  </th>
                  <th className="py-2 pr-4 font-medium">
                    {indicatorId === "trade"
                      ? "값 (전년동월비)"
                      : indicatorId === "fedwatchHike"
                        ? "25bp 인상(%)"
                        : "값"}
                  </th>
                  <th className="py-2 pr-4 font-medium">
                    {indicatorId === "fedwatchHike" ? "정산일" : "발표일"}
                  </th>
                  <th className="py-2 font-medium">출처</th>
                </tr>
              </thead>
              <tbody>
                {[...series]
                  .slice(-18)
                  .reverse()
                  .map((row) => {
                    const yoy = tradeYoyPct(row.period, row.value);
                    return (
                    <tr key={row.period} className="border-b border-slate-200">
                      <td className="py-2 pr-4 tabular-nums text-slate-800">
                        {row.period}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-slate-900">
                        {formatValue(row.value, digits)}
                        {yoy !== undefined ? (
                          <span className="ml-1 text-slate-500">
                            ({formatSigned(yoy, 1)}%)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{row.releasedAt}</td>
                      <td className="py-2">
                        {row.sourceUrl ? (
                          <a
                            href={row.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-teal-800 underline-offset-4 hover:underline"
                          >
                            열기
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>

        <nav aria-label="다른 지표" className="flex flex-wrap gap-2 border-t border-slate-200 pt-6">
          {IDS.filter((other) => other !== indicatorId).map((other) => {
            const otherMeta = getIndicator(other);
            return (
              <Link
                key={other}
                href={`/indicator/${other}`}
                className="border border-slate-300 bg-white/70 px-3 py-1.5 text-sm text-slate-700 transition hover:border-teal-700 hover:text-teal-900"
              >
                {otherMeta?.nameKo}
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
