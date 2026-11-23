import { NewsPanel } from "@/components/NewsPanel";
import { fetchRelatedNews } from "@/lib/sources/news";
import { fetchOverseasNews } from "@/lib/sources/overseas-news";

export async function NewsSection() {
  const [domestic, overseas] = await Promise.all([
    fetchRelatedNews(12).catch(() => ({
      updatedAt: new Date().toISOString(),
      sourceNote: "기사 수집 실패",
      articles: [],
    })),
    fetchOverseasNews(12).catch(() => ({
      updatedAt: new Date().toISOString(),
      sourceNote: "해외 기사 수집 실패",
      articles: [],
    })),
  ]);

  return <NewsPanel domestic={domestic} overseas={overseas} />;
}

export function NewsSectionFallback() {
  return (
    <section
      aria-label="최신 기사 로딩"
      className="rounded-sm bg-white/75 px-3 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur sm:px-5"
    >
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-slate-900">
        최신 기사
      </h2>
      <p className="mt-3 text-sm text-slate-500">
        국내·해외 경제 기사를 불러오는 중…
      </p>
      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        <p className="text-sm text-slate-400">국내경제…</p>
        <p className="text-sm text-slate-400">해외경제…</p>
      </div>
    </section>
  );
}
