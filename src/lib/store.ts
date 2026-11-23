import { promises as fs } from "fs";
import path from "path";
import type { DataStore, IndicatorId, Observation } from "./types";

const STORE_PATH = path.join(process.cwd(), "data", "store.json");

export async function readStore(): Promise<DataStore> {
  const raw = await fs.readFile(STORE_PATH, "utf8");
  return JSON.parse(raw) as DataStore;
}

export async function writeStore(store: DataStore): Promise<void> {
  await fs.writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export function latestObservation(
  store: DataStore,
  id: IndicatorId,
): Observation | undefined {
  const series = store.observations[id] ?? [];
  // FedWatch outlook is ordered nearest meeting → later; headline uses the next FOMC.
  if (id === "fedwatchHike") return series[0];
  return series[series.length - 1];
}

export function previousObservation(
  store: DataStore,
  id: IndicatorId,
): Observation | undefined {
  const series = store.observations[id] ?? [];
  if (id === "fedwatchHike") {
    return series.length >= 2 ? series[1] : undefined;
  }
  return series.length >= 2 ? series[series.length - 2] : undefined;
}
