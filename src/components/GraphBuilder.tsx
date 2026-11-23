"use client";

import { useMemo, useRef, useState } from "react";
import {
  MultiSeriesChart,
  SERIES_LINE_STYLES,
  type ChartSeries,
} from "@/components/MultiSeriesChart";
import type { IndicatorSnapshot } from "@/lib/analysis";
import {
  CHART_DATA_DOWNLOAD_FORMATS,
  downloadChartData,
  type ChartDataFormat,
} from "@/lib/chart-data-export";
import {
  CHART_DOWNLOAD_FORMATS,
  downloadChartSvg,
  type ChartImageFormat,
} from "@/lib/chart-export";
import type {
  DataStore,
  Frequency,
  IndicatorGroupMeta,
  IndicatorId,
  Observation,
} from "@/lib/types";

const FREQ_KO: Record<Frequency, string> = {
  daily: "일간",
  weekly: "주간",
  monthly: "월간",
  quarterly: "분기",
};

const SERIES_COLORS = [
  "#0f766e",
  "#b45309",
  "#1d4ed8",
  "#be123c",
  "#334155",
  "#047857",
  "#c2410c",
  "#0e7490",
];

type PeriodOption = {
  id: string;
  label: string;
  /** Approximate lookback in calendar years (fractions OK for daily). */
  years: number | null;
};

const PERIOD_BY_FREQ: Record<Frequency, PeriodOption[]> = {
  daily: [
    { id: "1m", label: "1개월", years: 1 / 12 },
    { id: "3m", label: "3개월", years: 0.25 },
    { id: "6m", label: "6개월", years: 0.5 },
    { id: "1y", label: "1년", years: 1 },
    { id: "3y", label: "3년", years: 3 },
    { id: "5y", label: "5년", years: 5 },
    { id: "all", label: "전체", years: null },
  ],
  weekly: [
    { id: "6m", label: "6개월", years: 0.5 },
    { id: "1y", label: "1년", years: 1 },
    { id: "3y", label: "3년", years: 3 },
    { id: "5y", label: "5년", years: 5 },
    { id: "all", label: "전체", years: null },
  ],
  monthly: [
    { id: "1y", label: "1년", years: 1 },
    { id: "3y", label: "3년", years: 3 },
    { id: "5y", label: "5년", years: 5 },
    { id: "10y", label: "10년", years: 10 },
    { id: "20y", label: "20년", years: 20 },
    { id: "all", label: "전체", years: null },
  ],
  quarterly: [
    { id: "5y", label: "5년", years: 5 },
    { id: "10y", label: "10년", years: 10 },
    { id: "20y", label: "20년", years: 20 },
    { id: "all", label: "전체", years: null },
  ],
};

type Step = "select" | "period" | "axis" | "chart";

/** National-accounts growth measure. */
type NaMeasure = "qoq" | "yoy";

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

const STEPS: { id: Step; label: string }[] = [
  { id: "select", label: "지표 선택" },
  { id: "period", label: "기간" },
  { id: "axis", label: "축" },
  { id: "chart", label: "그래프" },
];

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

function seriesForMeasure(
  store: DataStore,
  id: IndicatorId,
  measure: NaMeasure,
  isNaGroup: boolean,
): Observation[] {
  if (isNaGroup && NA_IDS.has(id) && measure === "yoy") {
    return naYoySeries(store, id) ?? [];
  }
  return store.observations[id] ?? [];
}

function periodFloor(latest: string, years: number): string | null {
  if (years <= 0) return null;
  if (latest.includes("-Q")) {
    const [y, q] = latest.split("-Q").map(Number);
    const back = Math.max(1, Math.round(years * 4)) - 1;
    let yy = y;
    let qq = q;
    for (let i = 0; i < back; i += 1) {
      qq -= 1;
      if (qq < 1) {
        qq = 4;
        yy -= 1;
      }
    }
    return `${yy}-Q${qq}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(latest)) {
    const [y, m, d] = latest.split("-").map(Number);
    const end = Date.UTC(y, m - 1, d);
    const start = new Date(end);
    start.setUTCFullYear(start.getUTCFullYear() - Math.floor(years));
    const remMonths = Math.round((years % 1) * 12);
    if (remMonths > 0) start.setUTCMonth(start.getUTCMonth() - remMonths);
    return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}$/.test(latest)) {
    const [y, m] = latest.split("-").map(Number);
    const end = new Date(Date.UTC(y, m - 1, 1));
    const start = new Date(end);
    start.setUTCFullYear(start.getUTCFullYear() - Math.floor(years));
    const remMonths = Math.round((years % 1) * 12);
    if (remMonths > 0) start.setUTCMonth(start.getUTCMonth() - remMonths);
    return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return null;
}

function trimSeries(
  observations: Observation[],
  years: number | null,
): Observation[] {
  if (observations.length === 0) return [];
  if (years === null) return observations;
  const latest = observations[observations.length - 1]?.period;
  if (!latest) return observations;
  const floor = periodFloor(latest, years);
  if (!floor) return observations;
  return observations.filter((o) => o.period >= floor);
}

function defaultRightAxisIds(
  selected: IndicatorSnapshot[],
): IndicatorId[] {
  if (selected.length < 2) return [];
  const units = new Set(selected.map((s) => s.unit));
  if (units.size > 1) {
    const firstUnit = selected[0].unit;
    return selected
      .filter((s) => s.unit !== firstUnit)
      .map((s) => s.id);
  }
  return [selected[1].id];
}

export function GraphBuilder({
  group,
  snapshots,
  store,
  defaultOpen = false,
  compactHeader = false,
}: {
  group: IndicatorGroupMeta;
  snapshots: IndicatorSnapshot[];
  store: DataStore;
  /** Start with the wizard expanded. */
  defaultOpen?: boolean;
  /** Hide the outer start/close chrome when embedded in a section. */
  compactHeader?: boolean;
}) {
  const items = snapshots.filter((s) => s.groupId === group.id);
  const frequencies = useMemo(() => {
    const set = new Set(items.map((i) => i.frequency as Frequency));
    return (["daily", "weekly", "monthly", "quarterly"] as Frequency[]).filter(
      (f) => set.has(f),
    );
  }, [items]);

  const isNaGroup = group.id === "national-accounts";

  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState<Step>("select");
  const [frequency, setFrequency] = useState<Frequency | null>(
    frequencies[0] ?? null,
  );
  const [selectedIds, setSelectedIds] = useState<IndicatorId[]>([]);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [dualAxis, setDualAxis] = useState(false);
  const [rightAxisIds, setRightAxisIds] = useState<IndicatorId[]>([]);
  const [naMeasure, setNaMeasure] = useState<NaMeasure>("yoy");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => items.filter((i) => selectedIds.includes(i.id)),
    [items, selectedIds],
  );

  const periodOptions =
    frequency != null ? PERIOD_BY_FREQ[frequency] : [];
  const activePeriod =
    periodOptions.find((p) => p.id === periodId) ?? periodOptions[0] ?? null;

  const measureLabel =
    !isNaGroup
      ? null
      : naMeasure === "yoy"
        ? "전년동기비(원계열)"
        : "전분기비(계절조정)";

  const chartSeries: ChartSeries[] = useMemo(() => {
    if (step !== "chart" || !activePeriod) return [];
    return selected.map((item, index) => {
      const raw = seriesForMeasure(store, item.id, naMeasure, isNaGroup);
      const trimmed = trimSeries(raw, activePeriod.years);
      const label =
        isNaGroup && NA_IDS.has(item.id)
          ? `${item.nameKo} · ${naMeasure === "yoy" ? "전년동기비" : "전분기비"}`
          : item.nameKo;
      return {
        id: item.id,
        label,
        unit: isNaGroup && NA_IDS.has(item.id) ? "%" : item.unit,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
        dasharray:
          SERIES_LINE_STYLES[index % SERIES_LINE_STYLES.length].dash,
        digits: item.valueDigits,
        observations: trimmed,
        axis: dualAxis && rightAxisIds.includes(item.id) ? "right" : "left",
      };
    });
  }, [
    step,
    activePeriod,
    selected,
    store,
    dualAxis,
    rightAxisIds,
    naMeasure,
    isNaGroup,
  ]);

  function resetWizard() {
    setStep("select");
    setSelectedIds([]);
    setPeriodId(null);
    setDualAxis(false);
    setRightAxisIds([]);
    setFrequency(frequencies[0] ?? null);
    setNaMeasure("yoy");
  }

  function toggleIndicator(id: IndicatorId) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function goPeriod() {
    if (selectedIds.length < 1) return;
    const opts = frequency ? PERIOD_BY_FREQ[frequency] : [];
    const preferred =
      opts.find((o) => o.id === "5y") ??
      opts.find((o) => o.id === "1y") ??
      opts[0];
    setPeriodId(preferred?.id ?? null);
    setStep("period");
  }

  function goAxis() {
    if (!periodId) return;
    const defaults = defaultRightAxisIds(selected);
    setRightAxisIds(defaults);
    setDualAxis(defaults.length > 0 && selected.length >= 2);
    setStep("axis");
  }

  function goChart() {
    if (dualAxis) {
      const leftCount = selectedIds.filter((id) => !rightAxisIds.includes(id))
        .length;
      if (leftCount === 0 || rightAxisIds.length === 0) return;
    }
    setDownloadError(null);
    setStep("chart");
  }

  function exportBasename() {
    return [
      group.nameKo,
      ...selected.map((s) => s.nameKo),
      measureLabel,
      activePeriod?.label,
    ]
      .filter(Boolean)
      .join("_");
  }

  function exportMeta() {
    return [
      { label: "그룹", value: group.nameKo },
      ...(measureLabel ? [{ label: "증가율 기준", value: measureLabel }] : []),
      { label: "기간", value: activePeriod?.label ?? "—" },
      { label: "축", value: dualAxis ? "복수 축" : "단일 축" },
      {
        label: "지표",
        value: selected.map((s) => s.nameKo).join(", "),
      },
    ];
  }

  async function handleDownload(format: ChartImageFormat) {
    const svg = chartRef.current?.querySelector("svg");
    if (!svg) {
      setDownloadError("그래프를 찾을 수 없습니다.");
      return;
    }

    setDownloadBusy(true);
    setDownloadError(null);
    try {
      await downloadChartSvg(svg, format, exportBasename());
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "다운로드에 실패했습니다.",
      );
    } finally {
      setDownloadBusy(false);
    }
  }

  function handleDataDownload(format: ChartDataFormat) {
    if (chartSeries.length === 0) {
      setDownloadError("내보낼 데이터가 없습니다.");
      return;
    }
    setDownloadError(null);
    try {
      downloadChartData(chartSeries, format, exportBasename(), exportMeta());
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "자료 다운로드에 실패했습니다.",
      );
    }
  }

  if (items.length === 0) return null;

  return (
    <div
      className={
        compactHeader
          ? "space-y-4"
          : "rounded-sm border border-slate-900/10 bg-white/70 px-3 py-3 backdrop-blur sm:px-4"
      }
    >
      {compactHeader ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight text-slate-900">
            {group.nameKo}
            {group.freqEn ? (
              <span className="ml-1.5 text-xs font-medium tracking-normal text-slate-500">
                ({group.freqEn})
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-slate-500">
            같은 주기 지표만 함께 선택할 수 있습니다
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight text-slate-900">
              {group.nameKo} · 그래프 그리기 및 다운로드
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              같은 주기 지표를 골라 기간·축을 지정한 뒤 비교 그래프를 만듭니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (open) {
                setOpen(false);
                return;
              }
              setOpen(true);
              if (step === "chart") return;
              resetWizard();
            }}
            className="rounded-md border border-slate-900/15 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 transition hover:border-teal-700/40 hover:text-teal-900"
          >
            {open ? "닫기" : "시작하기"}
          </button>
        </div>
      )}

      {open || compactHeader ? (
        <div className={compactHeader ? "space-y-4" : "mt-3 space-y-4"}>
          <ol className="flex flex-wrap gap-1.5">
            {STEPS.map((s, index) => {
              const active = step === s.id;
              const done =
                STEPS.findIndex((x) => x.id === step) > index;
              return (
                <li
                  key={s.id}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] ${
                    active
                      ? "bg-teal-800 text-white"
                      : done
                        ? "bg-teal-800/10 text-teal-900"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <span className="tabular-nums opacity-80">{index + 1}</span>
                  {s.label}
                </li>
              );
            })}
          </ol>

          {step === "select" ? (
            <div className="space-y-3">
              {frequencies.length > 1 ? (
                <div className="flex flex-wrap gap-1.5">
                  {frequencies.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setFrequency(f);
                        setSelectedIds([]);
                      }}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        frequency === f
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {FREQ_KO[f]}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  주기 · {frequency ? FREQ_KO[frequency] : "—"}
                </p>
              )}

              {isNaGroup ? (
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-600">
                    증가율 기준을 고르세요. 선택한 기준으로 모든 지표를
                    그립니다.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNaMeasure("yoy")}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        naMeasure === "yoy"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      전년동기비 (원계열)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNaMeasure("qoq")}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        naMeasure === "qoq"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      전분기비 (계절조정)
                    </button>
                  </div>
                </div>
              ) : null}

              <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {items
                  .filter((item) => item.frequency === frequency)
                  .map((item) => {
                    const checked = selectedIds.includes(item.id);
                    const series = seriesForMeasure(
                      store,
                      item.id,
                      naMeasure,
                      isNaGroup,
                    );
                    const hasData = series.length > 0;
                    return (
                      <li key={item.id}>
                        <label
                          className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs transition ${
                            checked
                              ? "border-teal-700/50 bg-teal-50/80 text-slate-900"
                              : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300"
                          } ${!hasData ? "opacity-50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-teal-800"
                            checked={checked}
                            disabled={!hasData}
                            onChange={() => toggleIndicator(item.id)}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {item.nameKo}
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                              {isNaGroup
                                ? naMeasure === "yoy"
                                  ? "% (전년동기비·원계열)"
                                  : "% (전분기비·계절조정)"
                                : item.unit}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">
                  {selectedIds.length}개 선택 · 같은 주기만 함께 그릴 수 있습니다
                </p>
                <button
                  type="button"
                  disabled={selectedIds.length < 1}
                  onClick={goPeriod}
                  className="rounded-md bg-teal-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음 · 기간 선택
                </button>
              </div>
            </div>
          ) : null}

          {step === "period" ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                그래프에 표시할 시계열 기간을 고르세요.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {periodOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPeriodId(opt.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      periodId === opt.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setStep("select")}
                  className="rounded-md px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  ← 지표 선택
                </button>
                <button
                  type="button"
                  disabled={!periodId}
                  onClick={goAxis}
                  className="rounded-md bg-teal-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음 · 축 설정
                </button>
              </div>
            </div>
          ) : null}

          {step === "axis" ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                단위·스케일이 다르면 복수 축을 쓰면 비교가 쉽습니다.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDualAxis(false);
                    setRightAxisIds([]);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    !dualAxis
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  단일 축
                </button>
                <button
                  type="button"
                  disabled={selectedIds.length < 2}
                  onClick={() => {
                    setDualAxis(true);
                    if (rightAxisIds.length === 0) {
                      setRightAxisIds(defaultRightAxisIds(selected));
                    }
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    dualAxis
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  복수 축 (좌·우)
                </button>
              </div>

              {dualAxis ? (
                <div className="space-y-2 rounded-md border border-slate-200 bg-white/80 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-slate-700">
                    오른쪽 축에 둘 지표를 고르세요 (나머지는 왼쪽)
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {selected.map((item) => {
                      const onRight = rightAxisIds.includes(item.id);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setRightAxisIds((prev) =>
                                prev.includes(item.id)
                                  ? prev.filter((x) => x !== item.id)
                                  : [...prev, item.id],
                              );
                            }}
                            className={`rounded-md border px-2.5 py-1 text-xs transition ${
                              onRight
                                ? "border-amber-700/40 bg-amber-50 text-amber-950"
                                : "border-teal-700/30 bg-teal-50/70 text-teal-950"
                            }`}
                          >
                            {item.nameKo}
                            <span className="ml-1 text-[10px] opacity-70">
                              {onRight ? "우" : "좌"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {selectedIds.filter((id) => !rightAxisIds.includes(id))
                    .length === 0 || rightAxisIds.length === 0 ? (
                    <p className="text-[11px] text-rose-700">
                      왼쪽·오른쪽에 각각 1개 이상 필요합니다.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setStep("period")}
                  className="rounded-md px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  ← 기간
                </button>
                <button
                  type="button"
                  disabled={
                    dualAxis &&
                    (rightAxisIds.length === 0 ||
                      selectedIds.filter((id) => !rightAxisIds.includes(id))
                        .length === 0)
                  }
                  onClick={goChart}
                  className="rounded-md bg-teal-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  그래프 완성
                </button>
              </div>
            </div>
          ) : null}

          {step === "chart" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <p>
                  {selected.map((s) => s.nameKo).join(" · ")}
                  {measureLabel ? ` · ${measureLabel}` : ""}
                  {" · "}
                  {activePeriod?.label ?? "—"}
                  {" · "}
                  {dualAxis ? "복수 축" : "단일 축"}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("axis")}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    설정 수정
                  </button>
                  <button
                    type="button"
                    onClick={resetWizard}
                    className="font-medium text-teal-800 hover:text-teal-950"
                  >
                    다시 그리기
                  </button>
                </div>
              </div>
              <MultiSeriesChart
                ref={chartRef}
                series={chartSeries}
                dualAxis={dualAxis}
                hint={`${measureLabel ? `${measureLabel} · ` : ""}${activePeriod?.label ?? ""} · ${dualAxis ? "좌·우 축" : "단일 축"}`}
              />
              <div className="space-y-2 border-t border-slate-200/80 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-medium text-slate-600">
                    그림 저장
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {CHART_DOWNLOAD_FORMATS.map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        disabled={downloadBusy}
                        onClick={() => void handleDownload(fmt.id)}
                        className="rounded-md border border-slate-900/15 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 transition hover:border-teal-700/40 hover:text-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-medium text-slate-600">
                    자료 저장
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {CHART_DATA_DOWNLOAD_FORMATS.map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        disabled={downloadBusy || chartSeries.length === 0}
                        onClick={() => handleDataDownload(fmt.id)}
                        className="rounded-md border border-slate-900/15 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 transition hover:border-teal-700/40 hover:text-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {downloadBusy ? (
                  <span className="text-[11px] text-slate-500">저장 중…</span>
                ) : null}
                {downloadError ? (
                  <span className="text-[11px] text-rose-700">
                    {downloadError}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
