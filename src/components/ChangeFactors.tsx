import type { IndicatorSnapshot } from "@/lib/analysis";

export function ChangeFactors({ snapshots }: { snapshots: IndicatorSnapshot[] }) {
  const withFactors = snapshots.filter((s) => s.factorHeadline);

  return (
    <section aria-labelledby="factors-heading" className="space-y-4">
      <div>
        <h2
          id="factors-heading"
          className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-slate-900"
        >
          주요 변화 요인
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          최신 발표에서 눈에 띄는 움직임만 모았습니다. 자동 초안은 원문 확인 후 다듬으면 됩니다.
        </p>
      </div>
      <ol className="divide-y divide-slate-200 border-y border-slate-200">
        {withFactors.map((item, index) => (
          <li key={item.id} className="grid gap-2 py-4 sm:grid-cols-[3rem_1fr]">
            <span className="font-[family-name:var(--font-display)] text-sm text-teal-800">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="text-xs text-slate-500">
                {item.groupKo}
                {item.subgroupKo ? ` · ${item.subgroupKo}` : ""} · {item.nameKo}{" "}
                · {item.agencyKo}
              </p>
              <p className="mt-1 font-medium text-slate-900">{item.factorHeadline}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {item.factorDetail}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
