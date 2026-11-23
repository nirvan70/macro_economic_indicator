"use client";

import { useEffect, useRef, useState } from "react";
import type { NewsArticle } from "@/lib/sources/news";

function TickerItem({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noreferrer"
      className="inline-flex shrink-0 items-baseline gap-2.5 whitespace-nowrap px-5 text-[13px] leading-none tracking-tight text-[#f5e6c8] transition hover:text-white sm:text-[14px]"
    >
      <span className="font-semibold uppercase tracking-[0.14em] text-[#ff5a3c]">
        {article.source}
      </span>
      <span className="font-[family-name:var(--font-display)] font-medium">
        {article.title}
      </span>
      <span className="text-[#f5e6c8]/40" aria-hidden>
        ◆
      </span>
    </a>
  );
}

export function HeadlineTicker({ articles }: { articles: NewsArticle[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [durationSec, setDurationSec] = useState(70);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const measure = () => {
      // One copy is half the duplicated track.
      const half = el.scrollWidth / 2;
      // ~40px per second — slower, easier to read.
      const next = Math.max(36, Math.min(120, half / 40));
      setDurationSec(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [articles]);

  if (articles.length === 0) return null;

  // Build one wide segment, then duplicate it so translateX(-50%) loops cleanly.
  const repeats = Math.max(2, Math.ceil(8 / Math.max(articles.length, 1)));
  const segment = Array.from({ length: repeats }, () => articles).flat();

  return (
    <div
      role="region"
      aria-label="주요 기사 전광판"
      className="sticky top-0 z-50 border-b border-[#2a2118] bg-[#0a0a0a] text-[#f5e6c8] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.85)]"
    >
      <style>{`
        @keyframes kep-headline-ticker {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.45)_3px)]"
        aria-hidden
      />
      <div className="relative flex items-stretch">
        <div className="relative z-10 flex shrink-0 items-center gap-2 border-r border-[#3a2f24] bg-[#120e0c] px-3 py-2.5 sm:px-4">
          <span
            className="h-1.5 w-1.5 animate-pulse bg-[#ff5a3c]"
            aria-hidden
          />
          <span className="font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.22em] text-[#ffb347] sm:text-xs">
            Headlines
          </span>
        </div>

        <div
          className="relative min-w-0 flex-1 overflow-hidden py-2.5"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#0a0a0a] to-transparent sm:w-12"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#0a0a0a] to-transparent sm:w-12"
            aria-hidden
          />

          <div
            ref={trackRef}
            className="flex w-max flex-nowrap items-center will-change-transform"
            style={{
              animationName: "kep-headline-ticker",
              animationDuration: `${durationSec}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              animationPlayState: paused ? "paused" : "running",
            }}
          >
            <div className="flex flex-nowrap items-center">
              {segment.map((article, index) => (
                <TickerItem
                  key={`a-${article.id}-${index}`}
                  article={article}
                />
              ))}
            </div>
            <div className="flex flex-nowrap items-center" aria-hidden>
              {segment.map((article, index) => (
                <TickerItem
                  key={`b-${article.id}-${index}`}
                  article={article}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeadlineTickerFallback() {
  return (
    <div
      aria-label="주요 기사 전광판 로딩"
      className="sticky top-0 z-50 border-b border-[#2a2118] bg-[#0a0a0a] px-4 py-2.5"
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#ffb347]/70">
        Headlines loading…
      </p>
    </div>
  );
}
