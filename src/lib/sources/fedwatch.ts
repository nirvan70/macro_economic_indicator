import { spawn } from "node:child_process";
import path from "node:path";
import type { Observation } from "../types";

type FedwatchOutlookPoint = {
  period: string;
  value: number;
  contract?: string;
  probabilities?: Record<string, number>;
  hold?: number;
  hike25?: number;
  hike50Plus?: number;
  cut?: number;
  anyHike?: number;
};

type FedwatchSnapshot = {
  ok: boolean;
  error?: string;
  currentTarget?: string;
  meetingDate?: string;
  tradeDate?: string;
  hikeProbability?: number;
  hold?: number;
  hike25?: number;
  hike50Plus?: number;
  cut?: number;
  anyHike?: number;
  outlook?: FedwatchOutlookPoint[];
  sourceUrl?: string;
};

function runPythonSnapshot(): Promise<FedwatchSnapshot> {
  const script = path.join(process.cwd(), "scripts", "fedwatch-snapshot.py");
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [script], {
      cwd: process.cwd(),
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      try {
        const parsed = JSON.parse(stdout.trim()) as FedwatchSnapshot;
        resolve(parsed);
      } catch {
        reject(
          new Error(
            `fedwatch snapshot failed (exit ${code}): ${stderr || stdout || "empty"}`,
          ),
        );
      }
    });
  });
}

/**
 * Next-6-month FOMC +25bp probabilities (CME FedWatch headline metric).
 * Sorted ascending by meeting date; nearest meeting is first.
 */
export async function fetchFedwatchHikeSeries(
  _history: boolean,
): Promise<Observation[]> {
  const snap = await runPythonSnapshot();
  if (!snap.ok) {
    throw new Error(snap.error || "FedWatch unavailable");
  }
  const sourceUrl =
    snap.sourceUrl ??
    "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html";
  const asOf = snap.tradeDate ?? new Date().toISOString().slice(0, 10);
  const outlook = snap.outlook?.length
    ? snap.outlook
    : snap.meetingDate != null && snap.hikeProbability != null
      ? [{ period: snap.meetingDate, value: snap.hikeProbability }]
      : [];

  return outlook
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((p) => ({
      period: p.period,
      value: p.value,
      releasedAt: asOf,
      sourceUrl: `${sourceUrl}#meeting=${p.period}`,
      hold: p.hold,
      hike25: p.hike25 ?? p.value,
      hike50Plus: p.hike50Plus,
      cut: p.cut,
      anyHike: p.anyHike,
      currentTarget: snap.currentTarget,
    }));
}
