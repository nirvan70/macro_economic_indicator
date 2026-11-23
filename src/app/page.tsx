import { Suspense } from "react";
import {
  ForecastSection,
  ForecastSectionFallback,
} from "@/components/ForecastSection";
import { GroupJumpNav } from "@/components/GroupJumpNav";
import {
  HeadlineTickerFallback,
  HeadlineTickerSection,
} from "@/components/HeadlineTickerSection";
import { InstitutionLinks } from "@/components/InstitutionLinks";
import { MoversSummary } from "@/components/MoversSummary";
import { NewsSection, NewsSectionFallback } from "@/components/NewsSection";
import { SummaryCards } from "@/components/SummaryCards";
import { UpdateDataButton } from "@/components/UpdateDataButton";
import { buildSnapshots } from "@/lib/analysis";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const store = await readStore();
  const snapshots = buildSnapshots(store);
  const updatedLabel = new Date(store.updatedAt).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.14),transparent_42%),radial-gradient(circle_at_80%_0%,rgba(15,23,42,0.08),transparent_35%),linear-gradient(180deg,#f4f7f6_0%,#eef2f0_45%,#f7f8f6_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.03)_1px,transparent_1px)] [background-size:28px_28px]" />

      <Suspense fallback={<HeadlineTickerFallback />}>
        <HeadlineTickerSection />
      </Suspense>

      <header className="relative border-b border-slate-900/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 sm:py-14">
          <Suspense fallback={<ForecastSectionFallback />}>
            <ForecastSection />
          </Suspense>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-teal-800">
              Korea Macro Pulse
            </p>
            <UpdateDataButton />
          </div>
          <div className="max-w-3xl">
            <h1 className="font-[family-name:var(--font-display)] text-[2.35rem] font-black leading-[1.15] tracking-[-0.035em] text-slate-950 sm:text-5xl">
              Korea Economic Perspective
            </h1>
            <div
              className="mt-5 h-px w-16 bg-gradient-to-r from-teal-700 to-transparent"
              aria-hidden
            />
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              국내 및 해외 주요 경제지표를 모아 한눈에 보고, 관련 변화추이를
              확인할 수 있습니다.
            </p>
          </div>
          <GroupJumpNav />
          <p className="text-xs text-slate-500">데이터 갱신 · {updatedLabel}</p>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_7.75rem] lg:gap-5">
          <MoversSummary
            snapshots={snapshots}
            store={store}
          />
          <aside className="w-full justify-self-end lg:sticky lg:top-12 lg:z-40 lg:row-span-2 lg:w-[7.75rem] lg:justify-self-end lg:self-start">
            <InstitutionLinks />
          </aside>
          <div className="flex min-w-0 flex-col gap-14">
            <SummaryCards snapshots={snapshots} store={store} />
            <div id="related-news" className="scroll-mt-24">
              <Suspense fallback={<NewsSectionFallback />}>
                <NewsSection />
              </Suspense>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative border-t border-slate-900/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 py-6 text-xs text-slate-500 sm:px-8">
          <p>개인 모니터링용 MVP · 수치 검증 후 대외 공유를 권장합니다.</p>
          <p>알림 수신: byoungho.bae@bok.or.kr</p>
        </div>
      </footer>
    </div>
  );
}
