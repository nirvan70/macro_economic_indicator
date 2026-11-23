import {
  fetchHtml,
  stripHtml,
  type InstitutionOutlook,
} from "@/lib/sources/outlook-types";

const FALLBACK: InstitutionOutlook = {
  institution: "imf",
  nameKo: "IMF",
  nameEn: "IMF",
  title: "연례협의 스태프 미션(2026년 11월)",
  publishedAt: "2026-11-17",
  sourceUrl: "https://www.imf.org/en/countries/kor",
  growthThisYear: 3.9,
  growthNextYear: 3.3,
  cpiThisYear: 2.7,
  cpiNextYear: 2.3,
  thisYearLabel: "2026",
  nextYearLabel: "2027",
  fetchedAt: new Date().toISOString(),
};

const CANDIDATE_URLS = [
  "https://www.korea.net/NewsFocus/Business/view?articleId=303057",
  "https://biz.chosun.com/en/en-policy/2026/11/17/TROR75RXKBBAFOVJU46GPMJZUE/",
  "https://www.koreatimes.co.kr/economy/20261117/imf-raises-koreas-2026-growth-forecast-to-39-on-chip-boom",
];

function parseImfArticle(
  html: string,
  sourceUrl: string,
): InstitutionOutlook | null {
  const text = stripHtml(html);

  const growthPair =
    text.match(
      /(?:grow|growth|GDP would grow|경제성장률)\s*(?:of |at |to )?([\d.]+)\s*%\s*(?:this year|in 2026|올해)[^.\d]{0,40}([\d.]+)\s*%\s*(?:next year|in 2027|내년)/i,
    ) ??
    text.match(
      /([\d.]+)%\s*this year and\s*([\d.]+)%\s*next year/i,
    ) ??
    text.match(
      /raised (?:its |Korea(?:'s)? |South Korea(?:'s)? )?(?:2026 )?growth (?:forecast )?to\s*([\d.]+)\s*%[\s\S]{0,120}?([\d.]+)\s*%\s*in 2027/i,
    );

  if (!growthPair) return null;

  const g1 = Number(growthPair[1]);
  const g2 = Number(growthPair[2]);
  if (!Number.isFinite(g1) || !Number.isFinite(g2)) return null;

  const cpiPair =
    text.match(
      /(?:inflation|consumer prices?|물가(?:상승률)?)\s*(?:of |at |to |reach |forecast(?:ing)? )?([\d.]+)\s*%\s*(?:this year|in 2026|올해)[^.\d]{0,40}([\d.]+)\s*%\s*(?:(?:in )?2027|next year|내년)/i,
    ) ??
    text.match(
      /inflation (?:of |at )?([\d.]+)\s*%\s*this year and\s*([\d.]+)\s*%\s*in 2027/i,
    );

  const c1 = cpiPair ? Number(cpiPair[1]) : 2.7;
  const c2 = cpiPair ? Number(cpiPair[2]) : 2.3;

  return {
    institution: "imf",
    nameKo: "IMF",
    nameEn: "IMF",
    title: "연례협의 스태프 미션(2026년 11월)",
    publishedAt: "2026-11-17",
    sourceUrl,
    growthThisYear: g1,
    growthNextYear: g2,
    cpiThisYear: Number.isFinite(c1) ? c1 : 2.7,
    cpiNextYear: Number.isFinite(c2) ? c2 : 2.3,
    thisYearLabel: "2026",
    nextYearLabel: "2027",
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchImfOutlook(): Promise<InstitutionOutlook> {
  for (const url of CANDIDATE_URLS) {
    try {
      const html = await fetchHtml(url);
      const parsed = parseImfArticle(html, url);
      if (parsed) return parsed;
    } catch {
      // try next
    }
  }
  return { ...FALLBACK, fetchedAt: new Date().toISOString() };
}
