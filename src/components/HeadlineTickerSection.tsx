import {
  HeadlineTicker,
  HeadlineTickerFallback,
} from "@/components/HeadlineTicker";
import type { NewsArticle } from "@/lib/sources/news";
import { fetchRelatedNews } from "@/lib/sources/news";
import { fetchOverseasNews } from "@/lib/sources/overseas-news";

function dedupeHeadlines(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const out: NewsArticle[] = [];
  for (const article of articles) {
    const key = article.title.replace(/\s+/g, "").slice(0, 36);
    if (seen.has(key) || seen.has(article.link)) continue;
    seen.add(key);
    seen.add(article.link);
    out.push(article);
  }
  return out;
}

export async function HeadlineTickerSection() {
  const [domestic, overseas] = await Promise.all([
    fetchRelatedNews(10).catch(() => ({
      updatedAt: new Date().toISOString(),
      sourceNote: "",
      articles: [] as NewsArticle[],
    })),
    fetchOverseasNews(10).catch(() => ({
      updatedAt: new Date().toISOString(),
      sourceNote: "",
      articles: [] as NewsArticle[],
    })),
  ]);

  const merged = dedupeHeadlines([
    ...domestic.articles,
    ...overseas.articles,
  ]).sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return <HeadlineTicker articles={merged.slice(0, 18)} />;
}

export { HeadlineTickerFallback };
