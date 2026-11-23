import type { Observation } from "../types";

export type YahooIndexSymbol =
  | "^IXIC"
  | "^GSPC"
  | "DX-Y.NYB"
  | "CL=F"
  | "DBL=F";

type YahooChartResult = {
  meta?: {
    symbol?: string;
    regularMarketPrice?: number;
    regularMarketTime?: number;
    gmtoffset?: number;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>;
    }>;
  };
};

type YahooChartResponse = {
  chart?: {
    result?: YahooChartResult[] | null;
    error?: { description?: string } | null;
  };
};

function roundN(n: number, digits: number): number {
  return Number(n.toFixed(digits));
}

function nyDateFromUnix(sec: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(sec * 1000));
}

function quotePageUrl(symbol: YahooIndexSymbol): string {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
}

async function fetchYahooChart(
  symbol: YahooIndexSymbol,
  yearsBack: number,
): Promise<YahooChartResult> {
  // period1/period2 keeps daily bars; range=max often collapses to monthly.
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = Math.floor(period2 - yearsBack * 365.25 * 24 * 60 * 60);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&period1=${period1}&period2=${period2}&includePrePost=false`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; KoreaMacroDashboard/1.0; +https://finance.yahoo.com)",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Yahoo Finance HTTP ${res.status} for ${symbol}`);
  }
  const json = (await res.json()) as YahooChartResponse;
  const err = json.chart?.error?.description;
  if (err) throw new Error(`Yahoo Finance: ${err}`);
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo Finance: empty chart for ${symbol}`);
  return result;
}

/**
 * Daily closes from Yahoo Finance chart API, with the latest
 * regularMarketPrice stamped on today's NY session date when available.
 */
export async function fetchYahooIndexSeries(
  symbol: YahooIndexSymbol,
  opts: { yearsBack?: number; digits?: number } = {},
): Promise<Observation[]> {
  const yearsBack = opts.yearsBack ?? 20;
  const digits = opts.digits ?? 2;
  const result = await fetchYahooChart(symbol, yearsBack);
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const sourceUrl = quotePageUrl(symbol);
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - yearsBack);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const byPeriod = new Map<string, Observation>();
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = closes[i];
    if (close == null || !Number.isFinite(close)) continue;
    const period = nyDateFromUnix(timestamps[i]);
    if (period < cutoffIso) continue;
    byPeriod.set(period, {
      period,
      value: roundN(close, digits),
      releasedAt: period,
      sourceUrl,
    });
  }

  const livePrice = result.meta?.regularMarketPrice;
  const liveTime = result.meta?.regularMarketTime;
  if (
    livePrice != null &&
    Number.isFinite(livePrice) &&
    liveTime != null &&
    Number.isFinite(liveTime)
  ) {
    const period = nyDateFromUnix(liveTime);
    if (period >= cutoffIso) {
      byPeriod.set(period, {
        period,
        value: roundN(livePrice, digits),
        releasedAt: new Date(liveTime * 1000).toISOString(),
        sourceUrl,
      });
    }
  }

  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
}
