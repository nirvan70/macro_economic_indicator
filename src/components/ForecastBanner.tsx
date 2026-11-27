import { UpdateForecastButton } from "@/components/UpdateForecastButton";
import type { InstitutionOutlook } from "@/lib/sources/outlook-types";
import { formatValue } from "@/lib/format";

function Pair({
  label,
  thisYear,
  nextYear,
  thisYearLabel,
  nextYearLabel,
}: {
  label: string;
  thisYear: number | null;
  nextYear: number | null;
  thisYearLabel: string;
  nextYearLabel: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-teal-100/80">
        {label}
      </p>
      <div className="mt-1.5 flex items-end gap-3">
        <div>
          <p className="text-[10px] text-teal-100/70">{thisYearLabel}</p>
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums leading-none text-white">
            {thisYear == null ? "—" : formatValue(thisYear, 1)}
            {thisYear != null && (
              <span className="ml-0.5 text-sm font-medium text-teal-100">%</span>
            )}
          </p>
        </div>
        <div className="h-6 w-px bg-white/15" aria-hidden />
        <div>
          <p className="text-[10px] text-teal-100/70">{nextYearLabel}</p>
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold tabular-nums leading-none text-white/95">
            {nextYear == null ? "—" : formatValue(nextYear, 1)}
            {nextYear != null && (
              <span className="ml-0.5 text-xs font-medium text-teal-100/90">
                %
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function InstitutionCard({ outlook }: { outlook: InstitutionOutlook }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-3.5 backdrop-blur-[2px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-200">
            {outlook.nameEn}
          </p>
          <h3 className="mt-0.5 font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-white">
            {outlook.nameKo}
          </h3>
          <p className="mt-1 text-[11px] leading-snug text-teal-100/80">
            {outlook.title} · {outlook.publishedAt}
          </p>
        </div>
        <a
          href={outlook.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-medium text-white transition hover:bg-white/20"
        >
          원문
        </a>
      </div>
      <div className="mt-3 grid gap-3">
        <Pair
          label="성장률"
          thisYear={outlook.growthThisYear}
          nextYear={outlook.growthNextYear}
          thisYearLabel={outlook.thisYearLabel}
          nextYearLabel={outlook.nextYearLabel}
        />
        <Pair
          label="소비자물가"
          thisYear={outlook.cpiThisYear}
          nextYear={outlook.cpiNextYear}
          thisYearLabel={outlook.thisYearLabel}
          nextYearLabel={outlook.nextYearLabel}
        />
      </div>
    </article>
  );
}

export function ForecastBanner({
  outlooks,
}: {
  outlooks: InstitutionOutlook[];
}) {
  return (
    <aside
      aria-label="주요 기관 경제전망"
      className="relative overflow-hidden rounded-xl border border-teal-900/20 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 px-4 py-4 shadow-[0_12px_40px_-24px_rgba(15,118,110,0.55)] sm:px-6 sm:py-5"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_12%_20%,rgba(255,255,255,0.18),transparent_42%),radial-gradient(circle_at_88%_0%,rgba(45,212,191,0.18),transparent_40%)]"
        aria-hidden
      />
      <div className="relative space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-200">
              Macro Outlook
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-white sm:text-xl">
              주요 기관 한국 경제전망
            </h2>
            <p className="mt-1 text-xs text-teal-100/85">
              한국은행 · IMF의 성장률·소비자물가 전망치
            </p>
          </div>
          <UpdateForecastButton />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {outlooks.map((outlook) => (
            <InstitutionCard
              key={outlook.institution}
              outlook={outlook}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
