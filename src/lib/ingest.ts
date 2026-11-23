import { buildSnapshots } from "@/lib/analysis";
import { sendUpdateEmail } from "@/lib/email";
import { loadEnvFiles } from "@/lib/env";
import { getIndicator, INDICATORS } from "@/lib/indicators";
import {
  fetchTrackedItemTrade,
  summarizeItemMovers,
} from "@/lib/sources/customs-items";
import { fetchConsumptionComponents } from "@/lib/sources/consumption-components";
import {
  describeSources,
  fetchConstructionInvestmentDual,
  fetchConsumptionDual,
  fetchFacilityInvestmentDual,
  fetchGdpDual,
  fetchGovConsumptionDual,
  fetchIndustrialDual,
  fetchIndicatorSeries,
  fetchIpInvestmentDual,
  fetchNaExportDual,
  fetchNaImportDual,
  fetchRetailDual,
  fetchTradeBundle,
} from "@/lib/sources/fetchers";
import { readStore, writeStore } from "@/lib/store";
import type { ChangeFactor, IndicatorId, Observation } from "@/lib/types";

export type IngestOptions = {
  history?: boolean;
  notify?: boolean;
  demoUpdate?: boolean;
  log?: (message: string) => void;
};

export type IngestResult = {
  sources: string;
  updated: IndicatorId[];
  skipped: { id: string; reason: string }[];
  updatedAt: string;
  notified?: boolean;
};

function demoCpiTick(existing: Observation[]): Observation {
  const last = existing[existing.length - 1];
  const [y, m] = (last?.period ?? "2026-02").split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const period = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  const value = Number((((last?.value ?? 2) + 0.1) % 3).toFixed(1));

  return {
    period,
    value: value === 0 ? 0.1 : value,
    releasedAt: new Date().toISOString().slice(0, 10),
    sourceUrl: "https://kostat.go.kr",
  };
}

function mergeSeries(
  existing: Observation[],
  incoming: Observation[],
  replace: boolean,
): { series: Observation[]; changedPeriods: string[] } {
  if (replace && incoming.length > 0) {
    const same =
      existing.length === incoming.length &&
      existing.every(
        (row, i) =>
          row.period === incoming[i].period && row.value === incoming[i].value,
      );
    return {
      series: incoming,
      changedPeriods: same ? [] : incoming.slice(-3).map((row) => row.period),
    };
  }

  const map = new Map(existing.map((row) => [row.period, row]));
  const changedPeriods: string[] = [];
  for (const row of incoming) {
    const prev = map.get(row.period);
    if (!prev || prev.value !== row.value) {
      changedPeriods.push(row.period);
    }
    map.set(row.period, row);
  }

  const officialLatest = [...incoming]
    .sort((a, b) => a.period.localeCompare(b.period))
    .at(-1)?.period;
  let series = [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
  if (officialLatest) {
    const before = series.length;
    series = series.filter((row) => row.period <= officialLatest);
    if (series.length !== before) {
      changedPeriods.push(`trimmed>${officialLatest}`);
    }
  }
  return { series, changedPeriods };
}

function draftFactor(id: IndicatorId, obs: Observation): ChangeFactor {
  const meta = getIndicator(id);
  return {
    indicatorId: id,
    headline: `${meta?.nameKo ?? id} ${obs.period} 수치 갱신`,
    detail:
      "공식 API 반영 자동 초안입니다. 원문 보도자료·기여도표를 확인한 뒤 요인을 다듬어 확정하세요.",
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
}

/** Refresh store.json from ECOS / customs / FRED APIs. */
export async function runIngest(
  options: IngestOptions = {},
): Promise<IngestResult> {
  const history = Boolean(options.history);
  const demoUpdate = Boolean(options.demoUpdate);
  const notify = Boolean(options.notify);
  const log = options.log ?? (() => undefined);

  await loadEnvFiles();
  const sources = describeSources();
  log(`Sources: ${sources}`);
  if (history) log("Mode: history refresh");

  const store = await readStore();
  const updated: IndicatorId[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const ids = INDICATORS.map((item) => item.id);
  for (const id of ids) {
    if (!store.observations[id]) store.observations[id] = [];
  }

  // One-time: old `trade` may still hold balance while exports live in tradeExports.
  const tradeExports = store.tradeExports ?? [];
  if (tradeExports.length > 0 && (store.observations.trade?.length ?? 0) > 0) {
    const sample = store.observations.trade.at(-1)?.value ?? 0;
    // Export levels are typically hundreds of 억$; a small sample suggests old balance series.
    if (Math.abs(sample) < 80 && tradeExports.length > 12) {
      store.observations.trade = tradeExports;
      log("[migrate] trade(balance) → trade(exports)");
    }
  }

  // Drop retired 무역수지 series if present.
  if ("tradeBalance" in store.observations) {
    delete (store.observations as Record<string, unknown>).tradeBalance;
  }

  // One-time: old `employment` held unemployment; move to `unemployment`.
  if (
    (store.observations.unemployment?.length ?? 0) === 0 &&
    (store.observations.employment?.length ?? 0) > 0
  ) {
    const sample = store.observations.employment.at(-1)?.value ?? 0;
    // Unemployment rates are typically single-digit; employment rates ~60%.
    if (sample < 20) {
      store.observations.unemployment = store.observations.employment;
      store.observations.employment = [];
      log("[migrate] employment(실업률) → unemployment");
    }
  }

  let tradeBundle:
    | Awaited<ReturnType<typeof fetchTradeBundle>>
    | null = null;
  let industrialDual:
    | Awaited<ReturnType<typeof fetchIndustrialDual>>
    | null = null;
  let retailDual: Awaited<ReturnType<typeof fetchRetailDual>> | null = null;
  type NaDualId =
    | "gdp"
    | "consumption"
    | "govConsumption"
    | "facilityInvestment"
    | "constructionInvestment"
    | "ipInvestment"
    | "naExport"
    | "naImport";
  const naDualCache: Partial<
    Record<NaDualId, Awaited<ReturnType<typeof fetchGdpDual>>>
  > = {};

  for (const id of ids) {
    try {
      let incoming: Observation[];
      if (id === "trade") {
        if (!tradeBundle) tradeBundle = await fetchTradeBundle(history);
        incoming = tradeBundle.exports;
        store.tradeExports = incoming;
      } else if (id === "industrial") {
        if (!industrialDual) industrialDual = await fetchIndustrialDual(history);
        incoming = industrialDual.mom;
        store.industrialYoy = industrialDual.yoy;
        log(
          `[industrial-yoy] ${industrialDual.yoy.length} pts` +
            (industrialDual.yoy.length
              ? `, latest ${industrialDual.yoy.at(-1)?.period}=${industrialDual.yoy.at(-1)?.value}`
              : ""),
        );
      } else if (id === "retail") {
        if (!retailDual) retailDual = await fetchRetailDual(history);
        incoming = retailDual.mom;
        store.retailYoy = retailDual.yoy;
        log(
          `[retail-yoy] ${retailDual.yoy.length} pts` +
            (retailDual.yoy.length
              ? `, latest ${retailDual.yoy.at(-1)?.period}=${retailDual.yoy.at(-1)?.value}`
              : ""),
        );
      } else if (
        id === "gdp" ||
        id === "consumption" ||
        id === "govConsumption" ||
        id === "facilityInvestment" ||
        id === "constructionInvestment" ||
        id === "ipInvestment" ||
        id === "naExport" ||
        id === "naImport"
      ) {
        if (!naDualCache[id]) {
          naDualCache[id] =
            id === "gdp"
              ? await fetchGdpDual(history)
              : id === "consumption"
                ? await fetchConsumptionDual(history)
                : id === "govConsumption"
                  ? await fetchGovConsumptionDual(history)
                  : id === "facilityInvestment"
                    ? await fetchFacilityInvestmentDual(history)
                    : id === "constructionInvestment"
                      ? await fetchConstructionInvestmentDual(history)
                      : id === "ipInvestment"
                        ? await fetchIpInvestmentDual(history)
                        : id === "naExport"
                          ? await fetchNaExportDual(history)
                          : await fetchNaImportDual(history);
        }
        const dual = naDualCache[id]!;
        incoming = dual.qoq;
        if (id === "gdp") store.gdpYoy = dual.yoy;
        if (id === "consumption") store.consumptionYoy = dual.yoy;
        if (id === "govConsumption") store.govConsumptionYoy = dual.yoy;
        if (id === "facilityInvestment") store.facilityInvestmentYoy = dual.yoy;
        if (id === "constructionInvestment") {
          store.constructionInvestmentYoy = dual.yoy;
        }
        if (id === "ipInvestment") store.ipInvestmentYoy = dual.yoy;
        if (id === "naExport") store.naExportYoy = dual.yoy;
        if (id === "naImport") store.naImportYoy = dual.yoy;
        log(
          `[${id}-yoy] ${dual.yoy.length} pts` +
            (dual.yoy.length
              ? `, latest ${dual.yoy.at(-1)?.period}=${dual.yoy.at(-1)?.value}`
              : ""),
        );
      } else {
        incoming = await fetchIndicatorSeries(id, history);
      }

      // FedWatch outlook is a rolling 6-month meeting set — always replace.
      const replaceSeries = history || id === "fedwatchHike";

      if (incoming.length === 0 && demoUpdate && id === "cpi") {
        incoming = [demoCpiTick(store.observations[id])];
      }
      if (incoming.length === 0) {
        log(`[${id}] no rows`);
        skipped.push({ id, reason: "no rows" });
        continue;
      }

      const { series, changedPeriods } = mergeSeries(
        store.observations[id],
        incoming,
        replaceSeries,
      );
      store.observations[id] = series;

      const latest =
        id === "fedwatchHike" ? series[0] : series[series.length - 1];
      log(
        `[${id}] ${series.length} pts, latest ${latest.period}=${latest.value}` +
          (changedPeriods.length
            ? ` (changed: ${changedPeriods.slice(-5).join(",")})`
            : " (unchanged)"),
      );

      if (changedPeriods.length > 0) {
        updated.push(id);
        const others = store.factors.filter((f) => f.indicatorId !== id);
        store.factors = [draftFactor(id, latest), ...others];
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`[${id}] skip: ${message}`);
      skipped.push({ id, reason: message });
      if (demoUpdate && id === "cpi") {
        const tick = demoCpiTick(store.observations[id]);
        const { series } = mergeSeries(store.observations[id], [tick], false);
        store.observations[id] = series;
        updated.push(id);
      }
    }
  }

  try {
    const tradeItems = await fetchTrackedItemTrade(history ? 6 : 3);
    if (tradeItems.length > 0) {
      store.tradeItems = tradeItems;
      store.tradeItemsUpdatedAt = new Date().toISOString();
      log(
        `[trade-items] ${tradeItems.length} rows across ${new Set(tradeItems.map((t) => t.period)).size} months`,
      );
      const summary = summarizeItemMovers(tradeItems);
      if (summary) {
        const others = store.factors.filter((f) => f.indicatorId !== "trade");
        const tradeFactor = store.factors.find((f) => f.indicatorId === "trade");
        store.factors = [
          {
            indicatorId: "trade",
            headline: summary.headline,
            detail: `${summary.detail}${tradeFactor ? ` / ${tradeFactor.detail}` : ""}`,
            status: "draft",
            updatedAt: new Date().toISOString(),
          },
          ...others,
        ];
        if (!updated.includes("trade")) updated.push("trade");
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`[trade-items] skip: ${message}`);
    skipped.push({ id: "trade-items", reason: message });
  }

  const activityYoyTouched = Boolean(
    industrialDual?.yoy.length || retailDual?.yoy.length,
  );

  let consumptionComponentsTouched = false;
  try {
    const components = await fetchConsumptionComponents(history);
    const usable = components.filter(
      (c) => c.qoq.length > 0 || c.yoy.length > 0,
    );
    if (usable.length > 0) {
      store.consumptionComponents = usable;
      store.consumptionComponentsUpdatedAt = new Date().toISOString();
      consumptionComponentsTouched = true;
      log(
        `[consumption-components] ${usable
          .map((c) => `${c.nameKo} qoq=${c.qoq.length} yoy=${c.yoy.length}`)
          .join(", ")}`,
      );
    } else {
      log("[consumption-components] no rows");
      skipped.push({ id: "consumption-components", reason: "no rows" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`[consumption-components] skip: ${message}`);
    skipped.push({ id: "consumption-components", reason: message });
  }

  if (
    updated.length > 0 ||
    store.tradeItemsUpdatedAt ||
    consumptionComponentsTouched ||
    activityYoyTouched
  ) {
    store.updatedAt = new Date().toISOString();
    if (updated.length > 0) {
      store.pendingNotifications = Array.from(
        new Set([...(store.pendingNotifications ?? []), ...updated]),
      );
    }
    await writeStore(store);
    log(
      updated.length
        ? `Updated indicators: ${updated.join(", ")}`
        : consumptionComponentsTouched
          ? "Consumption components refreshed."
          : activityYoyTouched
            ? "Activity YoY series refreshed."
            : "Trade items refreshed.",
    );
  } else {
    log("No new releases detected.");
  }

  let notified = false;
  if (notify) {
    const latestStore = await readStore();
    const pending = latestStore.pendingNotifications ?? [];
    if (pending.length > 0) {
      const snapshots = buildSnapshots(latestStore);
      const result = await sendUpdateEmail(snapshots, pending);
      log(`Notify result: ${JSON.stringify(result)}`);
      if (result.sent || result.mode === "dry-run") {
        latestStore.pendingNotifications = [];
        latestStore.lastNotifiedAt = new Date().toISOString();
        await writeStore(latestStore);
        notified = true;
      }
    } else {
      log("Nothing to notify.");
    }
  }

  const latest = await readStore();
  return {
    sources,
    updated,
    skipped,
    updatedAt: latest.updatedAt,
    notified,
  };
}
