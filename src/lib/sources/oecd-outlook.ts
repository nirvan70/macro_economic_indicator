import {
  fetchHtml,
  stripHtml,
  type InstitutionOutlook,
} from "@/lib/sources/outlook-types";

const FALLBACK: InstitutionOutlook = {
  institution: "oecd",
  nameKo: "OECD",
  nameEn: "OECD",
  title: "중간 경제전망(2026년 9월)",
  publishedAt: "2026-09-23",
  sourceUrl:
    "https://www.oecd.org/en/publications/oecd-economic-outlook-interim-report-september-2026_f751d02b-en.html",
  growthThisYear: 3.7,
  growthNextYear: 2.6,
  cpiThisYear: 3.0,
  cpiNextYear: 2.7,
  thisYearLabel: "2026",
  nextYearLabel: "2027",
  fetchedAt: new Date().toISOString(),
};

const CANDIDATE_URLS = [
  "https://news.sbs.co.kr/english/article.do?news_id=N1008768163",
  "https://www.koreatimes.co.kr/economy/20260923/oecd-raises-koreas-2026-growth-forecast-to-37",
];

function firstNumber(
  text: string,
  patterns: RegExp[],
): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const n = Number(match[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function parseOecdArticle(
  html: string,
  sourceUrl: string,
): InstitutionOutlook | null {
  const text = stripHtml(html);

  const growthThisYear = firstNumber(text, [
    /growth rate for this year at\s*([\d.]+)\s*%/i,
    /2026 growth forecast to\s*([\d.]+)\s*%/i,
    /this year at\s*([\d.]+)%\. The projection in June/i,
    /올해(?: 한국)? 성장률(?: 전망(?:치)?)?\s*([\d.]+)\s*%/,
  ]);
  const growthNextYear = firstNumber(text, [
    /growth rate for next year at\s*([\d.]+)\s*%/i,
    /2027(?: growth forecast)? to\s*([\d.]+)\s*%/i,
    /next year at\s*([\d.]+)%\. This is also/i,
    /내년(?: 성장률(?: 전망(?:치)?)?)?\s*([\d.]+)\s*%/,
  ]);
  if (growthThisYear == null || growthNextYear == null) return null;

  const cpiThisYear =
    firstNumber(text, [
      /inflation forecast for this year was revised upward to\s*([\d.]+)\s*%/i,
      /inflation outlook has been adjusted upward to\s*([\d.]+)\s*%/i,
      /consumer prices would rise\s*([\d.]+)\s*%\s*in 2026/i,
      /올해(?: 물가(?:상승률)?(?: 전망(?:치)?)?)?\s*([\d.]+)\s*%/,
    ]) ?? 3.0;
  const cpiNextYear =
    firstNumber(text, [
      /Next year's inflation outlook was presented at\s*([\d.]+)\s*%/i,
      /inflation forecast for 2027 stood at\s*([\d.]+)\s*%/i,
      /([\d.]+)%, up 0\.5 percentage points compared to the June/i,
      /내년(?: 물가(?:상승률)?(?: 전망(?:치)?)?)?\s*([\d.]+)\s*%/,
    ]) ?? 2.7;

  return {
    institution: "oecd",
    nameKo: "OECD",
    nameEn: "OECD",
    title: "중간 경제전망(2026년 9월)",
    publishedAt: "2026-09-23",
    sourceUrl,
    growthThisYear,
    growthNextYear,
    cpiThisYear,
    cpiNextYear: Number.isFinite(cpiNextYear) ? cpiNextYear : 2.7,
    thisYearLabel: "2026",
    nextYearLabel: "2027",
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchOecdOutlook(): Promise<InstitutionOutlook> {
  for (const url of CANDIDATE_URLS) {
    try {
      const html = await fetchHtml(url);
      const parsed = parseOecdArticle(html, url);
      if (parsed) return parsed;
    } catch {
      // try next
    }
  }
  return { ...FALLBACK, fetchedAt: new Date().toISOString() };
}
