import { getGroup, INDICATORS } from "./indicators";
import { latestObservation, previousObservation } from "./store";
import { shiftMonth, shiftQuarter } from "./sources/ecos";
import type { DataStore, IndicatorId, Observation } from "./types";

export { formatSigned, formatValue } from "./format";

export interface IndicatorSnapshot {
  id: IndicatorId;
  nameKo: string;
  groupId: string;
  groupKo: string;
  subgroupKo?: string;
  agencyKo: string;
  frequency: string;
  unit: string;
  valueDigits: number;
  period?: string;
  value?: number;
  previousValue?: number;
  delta?: number;
  /** 전년동기 증가율 (%) — 수준 지표용 */
  yoyPct?: number;
  /** 전년동기 대비 증감 (동일 단위) */
  yoyDelta?: number;
  yearAgoValue?: number;
  releasedAt?: string;
  sourceUrl?: string;
  factorHeadline?: string;
  factorDetail?: string;
  /** FedWatch breakdown (optional). */
  hold?: number;
  hike25?: number;
  hike50Plus?: number;
  cut?: number;
  anyHike?: number;
  currentTarget?: string;
}

function yearAgoPeriod(period: string, frequency: string): string | null {
  if (frequency === "monthly" && /^\d{4}-\d{2}$/.test(period)) {
    return shiftMonth(period, -12);
  }
  if (frequency === "quarterly" && period.includes("-Q")) {
    return shiftQuarter(period, -4);
  }
  return null;
}

function findByPeriod(
  series: Observation[],
  period: string,
): Observation | undefined {
  return series.find((row) => row.period === period);
}

export function buildSnapshots(store: DataStore): IndicatorSnapshot[] {
  return INDICATORS.map((meta) => {
    const digits = meta.valueDigits ?? 1;
    const series = store.observations[meta.id] ?? [];
    const latest = latestObservation(store, meta.id);
    const previous = previousObservation(store, meta.id);
    const factor = store.factors.find((item) => item.indicatorId === meta.id);
    const delta =
      latest && previous !== undefined
        ? Number((latest.value - previous.value).toFixed(digits))
        : undefined;

    let yoyPct: number | undefined;
    let yoyDelta: number | undefined;
    let yearAgoValue: number | undefined;
    if (latest) {
      const agoPeriod = yearAgoPeriod(latest.period, meta.frequency);
      const yearAgo = agoPeriod ? findByPeriod(series, agoPeriod) : undefined;
      if (yearAgo && yearAgo.value !== 0) {
        yearAgoValue = yearAgo.value;
        yoyDelta = Number((latest.value - yearAgo.value).toFixed(digits));
        yoyPct = Number(
          (((latest.value / yearAgo.value) - 1) * 100).toFixed(1),
        );
      }
    }

    return {
      id: meta.id,
      nameKo: meta.nameKo,
      groupId: meta.groupId,
      groupKo: getGroup(meta.groupId)?.nameKo ?? meta.groupId,
      subgroupKo: meta.subgroupKo,
      agencyKo: meta.agencyKo,
      frequency: meta.frequency,
      unit: meta.unit,
      valueDigits: digits,
      period: latest?.period,
      value: latest?.value,
      previousValue: previous?.value,
      delta,
      yoyPct,
      yoyDelta,
      yearAgoValue,
      releasedAt: latest?.releasedAt,
      sourceUrl: latest?.sourceUrl,
      factorHeadline: factor?.headline,
      factorDetail: factor?.detail,
      hold: latest?.hold,
      hike25: latest?.hike25,
      hike50Plus: latest?.hike50Plus,
      cut: latest?.cut,
      anyHike: latest?.anyHike,
      currentTarget: latest?.currentTarget,
    };
  });
}

/** Cluster snapshots into ungrouped items first, then named subgroups. */
export function clusterBySubgroup(items: IndicatorSnapshot[]): {
  label?: string;
  items: IndicatorSnapshot[];
}[] {
  const ungrouped = items.filter((item) => !item.subgroupKo);
  const labels: string[] = [];
  for (const item of items) {
    if (item.subgroupKo && !labels.includes(item.subgroupKo)) {
      labels.push(item.subgroupKo);
    }
  }
  const clusters: { label?: string; items: IndicatorSnapshot[] }[] = [];
  if (ungrouped.length > 0) clusters.push({ items: ungrouped });
  for (const label of labels) {
    clusters.push({
      label,
      items: items.filter((item) => item.subgroupKo === label),
    });
  }
  return clusters;
}
