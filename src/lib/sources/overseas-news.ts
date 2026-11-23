import type { NewsArticle, NewsBundle } from "./news";

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
  return `o${h.toString(16)}`;
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
    // Google News: "Headline - Publisher". Yahoo titles often use em dashes mid-sentence — only strip short publisher-like suffixes.
    const sourceMatch = title.match(/\s[-–—]\s*([^-–—]+)$/);
    const candidate = sourceMatch?.[1]?.trim() ?? "";
    const looksLikePublisher =
      candidate.length > 0 &&
      candidate.length <= 48 &&
      !/[?]/.test(candidate) &&
      !/\b(or|and|the|a|an|to|for|of|in|on|with|from)\b/i.test(candidate);
    const source = looksLikePublisher ? candidate : sourceFallback;
    const cleanTitle =
      looksLikePublisher && sourceMatch?.index != null
        ? title.slice(0, sourceMatch.index).trim()
        : title;
    out.push({
      id: hashId(link, cleanTitle),
      title: cleanTitle,
      link,
      source,
      publishedAt: parseRssDate(stripHtml(pubRaw)),
      snippet: desc.slice(0, 180) || undefined,
    });
  }
  return out;
}

async function fetchRss(
  url: string,
  source: string,
): Promise<Omit<NewsArticle, "topics">[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "korea-macro-dashboard/1.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${source} HTTP ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml, source);
}

const OVERSEAS_TOPIC_RULES: { label: string; pattern: RegExp }[] = [
  { label: "연준·금리", pattern: /fed|fomc|powell|treasury|yield|rate hike|rate cut|interest rate/i },
  { label: "성장·물가", pattern: /gdp|inflation|cpi|pce|recession|growth/i },
  { label: "주식시장", pattern: /nasdaq|s&p|dow|stock|equity|wall street|rally|selloff/i },
  { label: "환율·달러", pattern: /dollar|fx|currency|yen|euro|exchange/i },
  { label: "FRED·연준", pattern: /fred|st\.?\s*louis fed|stlouisfed/i },
];

function classifyTopics(title: string, snippet: string): string[] {
  const hay = `${title} ${snippet}`;
  const hits = OVERSEAS_TOPIC_RULES.filter((r) => r.pattern.test(hay)).map(
    (r) => r.label,
  );
  return hits.length > 0 ? hits : ["해외경제"];
}

const PREFERRED_OUTLETS =
  /bloomberg|financial times|\bft\b|reuters|wall street journal|\bwsj\b/i;

function scoreOverseas(title: string, snippet: string, source: string): number {
  const hay = `${title} ${snippet}`;
  let score = 0;
  if (/fed|fomc|powell|treasury|yield|inflation|cpi|pce|gdp|recession/i.test(hay))
    score += 5;
  if (/dollar|currency|employment|payroll|jobless|labor/i.test(hay)) score += 3;
  if (/nasdaq|s&p|dow|wall street|stock/i.test(hay)) score += 2;
  if (/fred|st\.?\s*louis fed/i.test(hay) || source.includes("FRED")) score += 4;
  if (PREFERRED_OUTLETS.test(source) || PREFERRED_OUTLETS.test(hay)) score += 6;
  if (/ipo|anthropic|nvidia|nvda|crypto|bitcoin/i.test(hay)) score -= 2;
  return score;
}

async function translateToKo(text: string): Promise<string> {
  const trimmed = text.slice(0, 450);
  if (!trimmed) return text;
  // Skip if already mostly Hangul.
  const hangul = (trimmed.match(/[\uac00-\ud7a3]/g) ?? []).length;
  if (hangul / Math.max(trimmed.length, 1) > 0.25) return trimmed;

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|ko`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return text;
    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
    };
    const translated = data.responseData?.translatedText?.trim();
    if (!translated || /MYMEMORY WARNING/i.test(translated)) return text;
    return translated;
  } catch {
    return text;
  }
}

function dedupe(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const out: NewsArticle[] = [];
  for (const article of articles) {
    const key = article.titleOriginal
      ? article.titleOriginal.replace(/\s+/g, "").slice(0, 48)
      : article.title.replace(/\s+/g, "").slice(0, 48);
    if (seen.has(key) || seen.has(article.link)) continue;
    seen.add(key);
    seen.add(article.link);
    out.push(article);
  }
  return out;
}

/** US / overseas economy headlines (Yahoo, Google News, FT/Bloomberg/Reuters/WSJ, FRED), translated to Korean. */
export async function fetchOverseasNews(limit = 12): Promise<NewsBundle> {
  const notes: string[] = [];
  const collected: Omit<NewsArticle, "topics">[] = [];

  const feeds: { url: string; source: string; take?: number }[] = [
    {
      url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US",
      source: "Yahoo Finance",
    },
    {
      url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EIXIC&region=US&lang=en-US",
      source: "Yahoo Finance",
    },
    {
      url: "https://news.google.com/rss/search?q=Federal+Reserve+OR+US+inflation+OR+US+GDP&hl=en-US&gl=US&ceid=US:en",
      source: "Google News",
    },
    {
      url: "https://news.google.com/rss/search?q=Nasdaq+OR+Wall+Street+stocks&hl=en-US&gl=US&ceid=US:en",
      source: "Google News",
    },
    // Preferred wire/broadsheet outlets via Google News (direct FT/Bloomberg RSS is often gated).
    {
      url: "https://news.google.com/rss/search?q=site:ft.com+(economy+OR+markets+OR+%22Federal+Reserve%22+OR+inflation+OR+GDP)&hl=en-US&gl=US&ceid=US:en",
      source: "Financial Times",
      take: 10,
    },
    {
      url: "https://news.google.com/rss/search?q=site:bloomberg.com+(economy+OR+markets+OR+Fed+OR+inflation+OR+GDP+OR+Treasury)&hl=en-US&gl=US&ceid=US:en",
      source: "Bloomberg",
      take: 10,
    },
    {
      url: "https://news.google.com/rss/search?q=site:reuters.com+(Federal+Reserve+OR+US+economy+OR+inflation+OR+Treasury)&hl=en-US&gl=US&ceid=US:en",
      source: "Reuters",
      take: 8,
    },
    {
      url: "https://news.google.com/rss/search?q=site:wsj.com+(Federal+Reserve+OR+economy+OR+inflation+OR+markets)&hl=en-US&gl=US&ceid=US:en",
      source: "WSJ",
      take: 8,
    },
    {
      url: "https://news.google.com/rss/search?q=%22Financial+Times%22+OR+Bloomberg+(Fed+OR+inflation+OR+%22US+economy%22)&hl=en-US&gl=US&ceid=US:en",
      source: "Google News",
      take: 8,
    },
    {
      url: "https://fredblog.stlouisfed.org/feed/",
      source: "FRED Blog",
    },
  ];

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const items = await fetchRss(feed.url, feed.source);
      return { feed, items: items.slice(0, feed.take ?? 8) };
    }),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { feed, items } = result.value;
    if (items.length === 0) continue;
    collected.push(...items);
    notes.push(feed.source);
  }

  const uniqueNotes = [...new Set(notes)];
  const ranked = dedupe(
    collected.map((item) => ({
      ...item,
      topics: classifyTopics(item.title, item.snippet ?? ""),
    })),
  )
    .sort((a, b) => {
      const scoreDiff =
        scoreOverseas(b.title, b.snippet ?? "", b.source) -
        scoreOverseas(a.title, a.snippet ?? "", a.source);
      if (scoreDiff !== 0) return scoreDiff;
      return (
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    })
    .slice(0, limit);

  const translated: NewsArticle[] = [];
  for (const article of ranked) {
    const titleKo = await translateToKo(article.title);
    translated.push({
      ...article,
      title: titleKo,
      titleOriginal: article.title,
      // Keep a short English snippet; titles are translated for the board.
      snippet: article.snippet,
      topics: article.topics,
    });
    // Soft throttle for free translation API.
    await new Promise((r) => setTimeout(r, 80));
  }

  return {
    updatedAt: new Date().toISOString(),
    sourceNote:
      uniqueNotes.length > 0
        ? `${uniqueNotes.join(" · ")} · 영문→한국어 번역`
        : "해외 기사 수집 실패",
    articles: translated,
  };
}
