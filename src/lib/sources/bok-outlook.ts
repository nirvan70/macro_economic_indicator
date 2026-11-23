import {
  fetchHtml,
  stripHtml,
  type InstitutionOutlook,
} from "@/lib/sources/outlook-types";

export type BokOutlookForecast = InstitutionOutlook;

const FALLBACK: InstitutionOutlook = {
  institution: "bok",
  nameKo: "한국은행",
  nameEn: "BOK",
  title: "경제전망(2026년 8월)",
  publishedAt: "2026-08-27",
  sourceUrl:
    "https://www.bok.or.kr/portal/bbs/B0000502/view.do?menuNo=200690&nttId=11064211",
  growthThisYear: 3.3,
  growthNextYear: 2.9,
  cpiThisYear: 2.7,
  cpiNextYear: 2.3,
  thisYearLabel: "2026",
  nextYearLabel: "2027",
  fetchedAt: new Date().toISOString(),
};

const KNOWN_URLS = [
  "https://www.bok.or.kr/portal/bbs/B0000502/view.do?menuNo=200690&nttId=11064211",
];

function parseOutlookHtml(
  html: string,
  sourceUrl: string,
): InstitutionOutlook | null {
  const text = stripHtml(html);
  const growth = text.match(
    /국내경제는\s*올해\s*([\d.]+)%,\s*내년\s*([\d.]+)%/,
  );
  const cpi = text.match(
    /소비자물가는\s*올해\s*([\d.]+)%,\s*내년\s*([\d.]+)%/,
  );
  if (!growth || !cpi) return null;

  const titleMatch = text.match(/경제전망\((\d{4}년\s*\d+월)\)/);
  const title = titleMatch ? `경제전망(${titleMatch[1]})` : "한국은행 경제전망";
  const pubMatch = text.match(
    /등록일\s*(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/,
  );
  const publishedAt = pubMatch
    ? `${pubMatch[1]}-${pubMatch[2].padStart(2, "0")}-${pubMatch[3].padStart(2, "0")}`
    : new Date().toISOString().slice(0, 10);

  const yearMatch = title.match(/(\d{4})년/);
  const baseYear = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

  return {
    institution: "bok",
    nameKo: "한국은행",
    nameEn: "BOK",
    title,
    publishedAt,
    sourceUrl,
    growthThisYear: Number(growth[1]),
    growthNextYear: Number(growth[2]),
    cpiThisYear: Number(cpi[1]),
    cpiNextYear: Number(cpi[2]),
    thisYearLabel: String(baseYear),
    nextYearLabel: String(baseYear + 1),
    fetchedAt: new Date().toISOString(),
  };
}

/** Discover candidate BOK outlook URLs via Google News RSS. */
async function discoverOutlookUrls(): Promise<string[]> {
  const q = "한국은행 경제전망 site:bok.or.kr";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "korea-macro-dashboard/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const links = [...xml.matchAll(/<link>([^<]+)<\/link>/g)].map((m) =>
      m[1].trim(),
    );
    return links.filter(
      (href) =>
        href.includes("bok.or.kr") &&
        (href.includes("B0000502") ||
          href.includes("P0002359") ||
          href.includes("경제전망") ||
          href.includes("nttId=")),
    );
  } catch {
    return [];
  }
}

export async function fetchBokOutlook(): Promise<InstitutionOutlook> {
  const candidates = [...(await discoverOutlookUrls()), ...KNOWN_URLS];
  const tried = new Set<string>();

  for (const url of candidates) {
    if (!url || tried.has(url)) continue;
    tried.add(url);
    try {
      const html = await fetchHtml(url);
      const parsed = parseOutlookHtml(html, url);
      if (parsed) return parsed;
    } catch {
      // try next
    }
  }

  // Last resort: known press release parse, else static fallback.
  try {
    const html = await fetchHtml(FALLBACK.sourceUrl);
    const parsed = parseOutlookHtml(html, FALLBACK.sourceUrl);
    if (parsed) return parsed;
  } catch {
    // ignore
  }

  return { ...FALLBACK, fetchedAt: new Date().toISOString() };
}
