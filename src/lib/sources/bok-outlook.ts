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
  title: "경제전망(2026년 11월)",
  publishedAt: "2026-11-26",
  sourceUrl:
    "https://www.bok.or.kr/portal/bbs/B0000502/view.do?menuNo=200690&nttId=11067101",
  growthThisYear: 3.9,
  growthNextYear: 4.1,
  cpiThisYear: 2.7,
  cpiNextYear: 2.4,
  thisYearLabel: "2026",
  nextYearLabel: "2027",
  fetchedAt: new Date().toISOString(),
};

const NEWS_LIST_URLS = [
  // 뉴스/정보 통합 보도자료 — 최신 경제전망 보도자료가 여기 노출됨
  "https://www.bok.or.kr/portal/singl/newsData/listCont.do?menuNo=200761&searchCnd=1&searchWrd=%EA%B2%BD%EC%A0%9C%EC%A0%84%EB%A7%9D",
  "https://www.bok.or.kr/portal/singl/newsData/listCont.do?menuNo=200761",
  // 통화정책 보도자료 목록
  "https://www.bok.or.kr/portal/bbs/B0000502/list.do?menuNo=200690",
];

const VIEW_FALLBACKS = [
  "https://www.bok.or.kr/portal/bbs/B0000502/view.do?menuNo=200690&nttId=11067101",
  "https://www.bok.or.kr/portal/bbs/B0000502/view.do?menuNo=200690&nttId=11064211",
];

function absBokUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `https://www.bok.or.kr${href}`;
  return `https://www.bok.or.kr/${href}`;
}

function firstMatch(
  text: string,
  patterns: RegExp[],
): RegExpMatchArray | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function parseOutlookHtml(
  html: string,
  sourceUrl: string,
): InstitutionOutlook | null {
  const text = stripHtml(html)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const growth = firstMatch(text, [
    /국내경제는\s*올해\s*([\d.]+)\s*%\s*,\s*내년\s*([\d.]+)\s*%/,
    /국내경제는\s*올해\s*([\d.]+)\s*%[^\d]{0,40}내년\s*([\d.]+)\s*%/,
    /성장률(?:은|을)?\s*올해\s*([\d.]+)\s*%\s*,\s*내년\s*([\d.]+)\s*%/,
    /올해\s*([\d.]+)\s*%\s*,\s*내년\s*([\d.]+)\s*%의\s*(?:높은\s*)?성장/,
  ]);
  const cpi = firstMatch(text, [
    /소비자물가는\s*올해\s*([\d.]+)\s*%\s*,\s*내년\s*([\d.]+)\s*%/,
    /소비자물가는\s*올해\s*([\d.]+)\s*%[^\d]{0,40}내년\s*([\d.]+)\s*%/,
    /소비자물가(?:\s*상승률)?(?:은|을)?\s*올해\s*([\d.]+)\s*%\s*,\s*내년\s*([\d.]+)\s*%/,
  ]);
  if (!growth || !cpi) return null;

  const titleMatch = text.match(/경제전망\((\d{4}년\s*\d+월)\)/);
  const title = titleMatch ? `경제전망(${titleMatch[1]})` : "한국은행 경제전망";
  const pubMatch = text.match(
    /등록일\s*(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/,
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

type PressCandidate = {
  title: string;
  url: string;
  publishedAt?: string;
};

/** Pull the newest 「경제전망(…년 …월)」 press links from BOK news/press lists. */
async function discoverOutlookFromPressLists(): Promise<PressCandidate[]> {
  const found: PressCandidate[] = [];
  const seen = new Set<string>();

  for (const listUrl of NEWS_LIST_URLS) {
    try {
      const html = await fetchHtml(listUrl);
      // <a href="...view.do?nttId=..."> ... 경제전망(2026년 11월) ... </a>
      const linkRe =
        /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match: RegExpExecArray | null;
      while ((match = linkRe.exec(html)) !== null) {
        const href = match[1];
        const inner = stripHtml(match[2]);
        const titleMatch = inner.match(/경제전망\(\d{4}년\s*\d+월\)/);
        if (!titleMatch) continue;
        if (!href.includes("view.do") || !href.includes("nttId=")) continue;
        const url = absBokUrl(href);
        if (seen.has(url)) continue;
        seen.add(url);

        // Prefer date near the anchor (list row).
        const windowStart = Math.max(0, match.index - 400);
        const windowEnd = Math.min(html.length, match.index + match[0].length + 200);
        const nearby = stripHtml(html.slice(windowStart, windowEnd));
        const dateMatch = nearby.match(
          /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/,
        );
        found.push({
          title: titleMatch[0],
          url,
          publishedAt: dateMatch
            ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
            : undefined,
        });
      }
    } catch {
      // try next list
    }
  }

  found.sort((a, b) => {
    const da = a.publishedAt ?? "";
    const db = b.publishedAt ?? "";
    if (da !== db) return db.localeCompare(da);
    return b.title.localeCompare(a.title);
  });
  return found;
}

export async function fetchBokOutlook(): Promise<InstitutionOutlook> {
  const fromLists = await discoverOutlookFromPressLists();
  const candidates = [
    ...fromLists.map((row) => row.url),
    ...VIEW_FALLBACKS,
  ];
  const tried = new Set<string>();
  let best: InstitutionOutlook | null = null;

  for (const url of candidates) {
    if (!url || tried.has(url)) continue;
    tried.add(url);
    try {
      const html = await fetchHtml(url);
      const parsed = parseOutlookHtml(html, url);
      if (!parsed) continue;
      if (
        !best ||
        parsed.publishedAt > best.publishedAt ||
        (parsed.publishedAt === best.publishedAt &&
          parsed.title > best.title)
      ) {
        best = parsed;
      }
      // Newest list hit usually comes first; accept immediately when list-sourced.
      if (fromLists.some((row) => row.url === url)) {
        return parsed;
      }
    } catch {
      // try next
    }
  }

  if (best) return best;
  return { ...FALLBACK, fetchedAt: new Date().toISOString() };
}
