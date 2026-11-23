import { env } from "../env";

export type CustomsTradeRow = {
  year: string;
  balPayments: string | number;
  expDlr?: string | number;
  impDlr?: string | number;
};

type CustomsJson = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      items?: { item?: CustomsTradeRow | CustomsTradeRow[] };
    };
  };
};

export function customsServiceKey(): string {
  return env("DATA_GO_KR_SERVICE_KEY", env("CUSTOMS_API_KEY"));
}

function asItems(
  item: CustomsTradeRow | CustomsTradeRow[] | undefined,
): CustomsTradeRow[] {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

/** 관세청 수출입총괄 (공공데이터포털). balPayments = 무역수지(달러). */
export async function fetchCustomsTrade(
  startYymm: string,
  endYymm: string,
): Promise<CustomsTradeRow[]> {
  const serviceKey = customsServiceKey();
  if (!serviceKey) {
    throw new Error(
      "DATA_GO_KR_SERVICE_KEY (or CUSTOMS_API_KEY) is not set — skip trade",
    );
  }

  const url = new URL(
    "https://apis.data.go.kr/1220000/Newtrade/getNewtradeList",
  );
  // Portal keys are often already URL-encoded; pass through as-is.
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("strtYymm", startYymm);
  url.searchParams.set("endYymm", endYymm);
  url.searchParams.set("type", "json");
  url.searchParams.set("numOfRows", "120");
  url.searchParams.set("pageNo", "1");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Customs HTTP ${res.status}`);
  }

  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    // XML fallback
    const rows: CustomsTradeRow[] = [];
    const blocks = text.split(/<item>/i).slice(1);
    for (const block of blocks) {
      const year = block.match(/<year>([^<]*)<\/year>/i)?.[1]?.trim();
      const bal = block.match(/<balPayments>([^<]*)<\/balPayments>/i)?.[1]?.trim();
      const expDlr = block.match(/<expDlr>([^<]*)<\/expDlr>/i)?.[1]?.trim();
      const impDlr = block.match(/<impDlr>([^<]*)<\/impDlr>/i)?.[1]?.trim();
      if (year && bal && !year.includes("총계")) {
        rows.push({ year, balPayments: bal, expDlr, impDlr });
      }
    }
    if (rows.length === 0) {
      throw new Error(`Customs XML parse empty. Snippet: ${text.slice(0, 200)}`);
    }
    return rows;
  }

  const data = JSON.parse(text) as CustomsJson;
  const code = data.response?.header?.resultCode;
  if (code && code !== "00" && code !== "0") {
    throw new Error(
      `Customs API ${code}: ${data.response?.header?.resultMsg ?? ""}`,
    );
  }
  return asItems(data.response?.body?.items?.item).filter(
    (row) => row.year && !String(row.year).includes("총계"),
  );
}

export function periodFromCustomsYear(year: string): string {
  // "2026.01" or "202601"
  const cleaned = year.replace(".", "");
  if (/^\d{6}$/.test(cleaned)) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}`;
  }
  const m = year.match(/(\d{4})\D?(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  return year;
}

/** Convert USD balance to 억 달러. */
export function toEokUsd(balPayments: string | number): number {
  const n = typeof balPayments === "number" ? balPayments : Number(balPayments);
  if (!Number.isFinite(n)) return NaN;
  return Number((n / 100_000_000).toFixed(1));
}
