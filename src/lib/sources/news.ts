import { env } from "../env";
import type { IndicatorId } from "../types";

export type NewsArticle = {
  id: string;
  title: string;
  /** Original (e.g. English) title before translation */
  titleOriginal?: string;
  link: string;
  source: string;
  publishedAt: string;
  snippet?: string;
  topics: string[];
};

type NewsTopic = {
  id: string;
  label: string;
  indicatorIds: IndicatorId[];
  keywords: string[];
  /** Naver / Google search query */
  query: string;
};

const TOPICS: NewsTopic[] = [
  {
    id: "prices",
    label: "물가",
    indicatorIds: ["cpi"],
    keywords: ["물가", "소비자물가", "CPI", "인플레", "물가상승"],
    query: "소비자물가 OR CPI 한국",
  },
  {
    id: "activity",
    label: "실물경기",
    indicatorIds: [
      "industrial",
      "retail",
      "trade",
      "currentAccount",
      "consumerSentiment",
      "coincidentIndex",
      "leadingIndex",
    ],
    keywords: [
      "산업생산",
      "소매판매",
      "통관",
      "수출",
      "산업활동",
      "경상수지",
      "소비자심리",
      "경기동행",
      "경기선행",
      "선행지수",
    ],
    query:
      "산업생산 OR 소매판매 OR 수출 OR 경상수지 OR 소비자심리 OR 경기동행 OR 경기선행",
  },
  {
    id: "labor",
    label: "노동시장",
    indicatorIds: ["employment", "unemployment"],
    keywords: ["고용", "실업", "고용률", "실업률", "취업자"],
    query: "고용률 OR 실업률 한국",
  },
  {
    id: "national-accounts",
    label: "국민계정",
    indicatorIds: [
      "gdp",
      "consumption",
      "govConsumption",
      "facilityInvestment",
      "constructionInvestment",
      "ipInvestment",
      "naExport",
      "naImport",
    ],
    keywords: [
      "GDP",
      "국내총생산",
      "민간소비",
      "정부소비",
      "설비투자",
      "건설투자",
      "지식재산",
      "수출",
      "수입",
      "성장률",
      "경제성장",
    ],
    query: "GDP OR 민간소비 OR 설비투자 OR 건설투자 OR 지식재산 OR 수입",
  },
  {
    id: "financial-markets",
    label: "금융시장",
    indicatorIds: [
      "usdkrw",
      "usdjpy",
      "eurusd",
      "kospi",
      "kosdaq",
      "call",
      "ktb3y",
      "ktb10y",
    ],
    keywords: [
      "환율",
      "코스피",
      "코스닥",
      "금리",
      "국고채",
      "기준금리",
      "원달러",
      "엔달러",
      "유로달러",
    ],
    query: "원달러 환율 OR 엔달러 OR 유로달러 OR 코스피 OR 코스닥 OR 국고채 금리",
  },
  {
    id: "overseas",
    label: "해외",
    indicatorIds: [
      "ust1y",
      "ust10y",
      "ust30y",
      "fedwatchHike",
      "usgdp",
      "uscpi",
      "uspce",
      "usdIndex",
      "usnasdaq",
      "ussp500",
      "usdjia",
      "oilWti",
      "oilDubai",
    ],
    keywords: [
      "연준",
      "미국 금리",
      "미국 GDP",
      "달러 인덱스",
      "DXY",
      "나스닥",
      "S&P",
      "다우",
      "원유",
      "WTI",
      "두바이",
      "미 물가",
      "FOMC",
    ],
    query:
      "연준 OR 달러 인덱스 OR DXY OR 나스닥 OR S&P 500 OR 다우존스 OR WTI OR 두바이 원유 OR 미 국채",
  },
];

function stripHtml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function hashId(link: string, title: string): string {
  const raw = `${link}|${title}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) {
    h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `n${h.toString(16)}`;
}

function matchTopics(title: string, snippet: string): string[] {
  const hay = `${title} ${snippet}`;
  const matched = TOPICS.filter((topic) =>
    topic.keywords.some((kw) => hay.includes(kw)),
  ).map((t) => t.label);
  return matched.length > 0 ? matched : ["경제일반"];
}

function parseRssItems(
  xml: string,
  sourceFallback: string,
): Omit<NewsArticle, "topics">[] {
  const chunks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const out: Omit<NewsArticle, "topics">[] = [];
  for (const chunk of chunks) {
    const title = stripHtml(
      chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
    );
    const link = stripHtml(
      chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "",
    );
    const pubRaw =
      chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ??
      chunk.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i)?.[1] ??
      "";
    const desc = stripHtml(
      chunk.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? "",
    );
    if (!title || !link) continue;
    const sourceMatch = title.match(/\s[-–—]\s*([^-–—]+)$/);
    const source = sourceMatch?.[1]?.trim() || sourceFallback;
    const cleanTitle = sourceMatch
      ? title.slice(0, sourceMatch.index).trim()
      : title;
    out.push({
      id: hashId(link, cleanTitle),
      title: cleanTitle,
      link,
      source,
      publishedAt: parseRssDate(stripHtml(pubRaw)),
      snippet: desc.slice(0, 160) || undefined,
    });
  }
  return out;
}

async function fetchYonhapEconomyRss(): Promise<NewsArticle[]> {
  const res = await fetch("https://www.yna.co.kr/rss/economy.xml", {
    headers: { "User-Agent": "korea-macro-dashboard/1.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Yonhap RSS HTTP ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml, "연합뉴스").map((item) => ({
    ...item,
    source: "연합뉴스",
    topics: matchTopics(item.title, item.snippet ?? ""),
  }));
}

async function fetchGoogleNewsRss(
  query: string,
  topicLabel: string,
): Promise<NewsArticle[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  const res = await fetch(url, {
    headers: { "User-Agent": "korea-macro-dashboard/1.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google News RSS HTTP ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml, "뉴스").map((item) => ({
    ...item,
    topics: Array.from(
      new Set([topicLabel, ...matchTopics(item.title, item.snippet ?? "")]),
    ),
  }));
}

type NaverNewsItem = {
  title: string;
  originallink?: string;
  link: string;
  description: string;
  pubDate: string;
};

async function fetchNaverNews(
  query: string,
  topicLabel: string,
  display = 5,
): Promise<NewsArticle[]> {
  const clientId = env("NAVER_CLIENT_ID");
  const clientSecret = env("NAVER_CLIENT_SECRET");
  if (!clientId || !clientSecret) return [];

  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(display));
  url.searchParams.set("sort", "date");

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Naver News HTTP ${res.status}`);
  const data = (await res.json()) as { items?: NaverNewsItem[] };
  return (data.items ?? []).map((item) => {
    const title = stripHtml(item.title);
    const link = item.originallink || item.link;
    const snippet = stripHtml(item.description).slice(0, 160);
    return {
      id: hashId(link, title),
      title,
      link,
      source: "네이버뉴스",
      publishedAt: parseRssDate(item.pubDate),
      snippet,
      topics: Array.from(
        new Set([topicLabel, ...matchTopics(title, snippet)]),
      ),
    };
  });
}

function dedupe(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const out: NewsArticle[] = [];
  for (const article of articles) {
    const key = article.title.replace(/\s+/g, "").slice(0, 40);
    if (seen.has(key) || seen.has(article.link)) continue;
    seen.add(key);
    seen.add(article.link);
    out.push(article);
  }
  return out;
}

/** Prefer articles that mention dashboard-related keywords. */
function scoreArticle(article: NewsArticle): number {
  let score = 0;
  if (article.source.includes("연합")) score += 3;
  if (article.source.includes("네이버")) score += 1;
  if (article.topics.some((t) => t !== "경제일반")) score += 4;
  const ageH =
    (Date.now() - new Date(article.publishedAt).getTime()) / 3_600_000;
  score += Math.max(0, 48 - ageH) / 12;
  return score;
}

export type NewsBundle = {
  updatedAt: string;
  sourceNote: string;
  articles: NewsArticle[];
};

export async function fetchRelatedNews(
  limit = 14,
): Promise<NewsBundle> {
  const notes: string[] = [];
  const collected: NewsArticle[] = [];

  try {
    const yonhap = await fetchYonhapEconomyRss();
    collected.push(...yonhap);
    notes.push("연합뉴스 경제 RSS");
  } catch (error) {
    notes.push(
      `연합뉴스 RSS 실패: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const hasNaver = Boolean(env("NAVER_CLIENT_ID") && env("NAVER_CLIENT_SECRET"));
  if (hasNaver) {
    notes.push("네이버 뉴스 검색 API");
    for (const topic of TOPICS) {
      try {
        const items = await fetchNaverNews(topic.query, topic.label, 4);
        collected.push(...items);
      } catch {
        // keep going with other topics
      }
    }
  } else {
    notes.push("네이버 API 미설정 → Google 뉴스 RSS 보조");
    for (const topic of TOPICS.slice(0, 4)) {
      try {
        const items = await fetchGoogleNewsRss(topic.query, topic.label);
        collected.push(...items.slice(0, 4));
      } catch {
        // ignore
      }
    }
  }

  const unique = dedupe(collected);
  const relevant = unique.filter((a) =>
    a.topics.some((t) => t !== "경제일반"),
  );
  const general = unique.filter((a) =>
    a.topics.every((t) => t === "경제일반"),
  );
  const ranked = [
    ...relevant.sort((a, b) => scoreArticle(b) - scoreArticle(a)),
    ...general.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    ),
  ].slice(0, limit);

  const articles = ranked.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return {
    updatedAt: new Date().toISOString(),
    sourceNote: notes.join(" · "),
    articles,
  };
}
