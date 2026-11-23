"use client";

import { useEffect, useState } from "react";
import type { NewsArticle, NewsBundle } from "@/lib/sources/news";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ArticleRow({ article }: { article: NewsArticle }) {
  return (
    <li className="border-b border-slate-200/80 last:border-b-0">
      <a
        href={article.link}
        target="_blank"
        rel="noreferrer"
        className="group block py-3 transition hover:bg-white/60"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
          <span className="font-medium text-slate-700">{article.source}</span>
          <span aria-hidden>·</span>
          <time dateTime={article.publishedAt}>
            {formatWhen(article.publishedAt)}
          </time>
          {article.topics.slice(0, 2).map((topic) => (
            <span
              key={topic}
              className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] tracking-wide text-slate-600"
            >
              {topic}
            </span>
          ))}
        </div>
        <p className="mt-1.5 font-[family-name:var(--font-display)] text-[15px] leading-snug text-slate-900 group-hover:text-teal-900">
          {article.title}
        </p>
        {article.titleOriginal && article.titleOriginal !== article.title ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-slate-400">
            {article.titleOriginal}
          </p>
        ) : null}
        {article.snippet ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
            {article.snippet}
          </p>
        ) : null}
      </a>
    </li>
  );
}

function Column({
  heading,
  news,
  emptyHint,
}: {
  heading: string;
  news: NewsBundle;
  emptyHint?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-900/10 pb-2">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-slate-900">
          {heading}
        </h3>
        <p className="text-[11px] text-slate-500">
          {new Date(news.updatedAt).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
          })}
          <span className="mx-1.5 text-slate-300">·</span>
          {news.sourceNote}
        </p>
      </div>
      {news.articles.length === 0 ? (
        <p className="mt-4 rounded border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
          기사를 불러오지 못했습니다.
          {emptyHint ? (
            <span className="mt-1 block text-xs text-slate-400">{emptyHint}</span>
          ) : null}
        </p>
      ) : (
        <ul className="mt-1">
          {news.articles.map((article) => (
            <ArticleRow key={article.id} article={article} />
          ))}
        </ul>
      )}
    </div>
  );
}

type NewsPanelProps = {
  domestic: NewsBundle;
  overseas: NewsBundle;
};

export function NewsPanel({
  domestic: initialDomestic,
  overseas: initialOverseas,
}: NewsPanelProps) {
  const [domestic, setDomestic] = useState(initialDomestic);
  const [overseas, setOverseas] = useState(initialOverseas);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDomestic(initialDomestic);
    setOverseas(initialOverseas);
  }, [initialDomestic, initialOverseas]);

  async function refreshNews() {
    if (status === "loading") return;
    setStatus("loading");
    setMessage("최신 기사를 불러오는 중…");
    try {
      const [domRes, ovsRes] = await Promise.all([
        fetch("/api/news", { cache: "no-store" }),
        fetch("/api/news/overseas", { cache: "no-store" }),
      ]);
      const [domData, ovsData] = (await Promise.all([
        domRes.json(),
        ovsRes.json(),
      ])) as [
        { ok: boolean; news?: NewsBundle; error?: string },
        { ok: boolean; news?: NewsBundle; error?: string },
      ];
      if (!domRes.ok || !domData.ok || !domData.news) {
        throw new Error(domData.error || `국내 기사 HTTP ${domRes.status}`);
      }
      if (!ovsRes.ok || !ovsData.ok || !ovsData.news) {
        throw new Error(ovsData.error || `해외 기사 HTTP ${ovsRes.status}`);
      }
      setDomestic(domData.news);
      setOverseas(ovsData.news);
      setStatus("done");
      setMessage(
        `국내 ${domData.news.articles.length}건 · 해외 ${ovsData.news.articles.length}건 갱신`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section
      aria-label="최신 기사"
      className="rounded-sm bg-white/75 px-3 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur sm:px-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-900/10 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-slate-900">
              최신 기사
            </h2>
            <button
              type="button"
              onClick={() => {
                void refreshNews();
              }}
              disabled={status === "loading"}
              className="rounded-lg border border-teal-800/20 bg-teal-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-900 disabled:cursor-wait disabled:opacity-70"
            >
              {status === "loading" ? "업데이트 중…" : "업데이트"}
            </button>
            {message ? (
              <p
                className={`text-xs ${
                  status === "error" ? "text-rose-700" : "text-slate-600"
                }`}
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            국내·해외 경제 기사를 양쪽에 모아 보여 줍니다. 앱을 열 때마다 새로
            가져오며, 버튼으로도 즉시 갱신할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-8 lg:grid-cols-2 lg:gap-10">
        <Column
          heading="국내경제"
          news={domestic}
          emptyHint="네이버 검색 API를 쓰려면 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET을 설정하면 됩니다."
        />
        <Column heading="해외경제" news={overseas} />
      </div>
    </section>
  );
}
