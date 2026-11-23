import Link from "next/link";
import { HistoryTeasers } from "@/components/HistoryTeasers";
import { buildSnapshots } from "@/lib/analysis";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const store = await readStore();
  const snapshots = buildSnapshots(store);

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.14),transparent_42%),linear-gradient(180deg,#f4f7f6_0%,#eef2f0_50%,#f7f8f6_100%)]" />

      <header className="relative border-b border-slate-900/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-8 sm:px-8">
          <Link
            href="/"
            className="w-fit text-sm text-teal-900 underline-offset-4 hover:underline"
          >
            ← 대시보드로
          </Link>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-teal-900">
              Long-run series
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-tight text-slate-950">
              장기시계열
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              2000년 1분기(월별·일별은 2000년 1월)부터의 장기 추이를 보여 줍니다.
              지표를 누르면 과거 추이 그래프와 최근 관측표를 볼 수 있습니다.
            </p>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
        <HistoryTeasers snapshots={snapshots} store={store} />
      </main>
    </div>
  );
}
