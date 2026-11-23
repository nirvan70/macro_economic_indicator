import { getGroup, getIndicator } from "@/lib/indicators";
import type { UpcomingRelease } from "@/lib/types";

export function ReleaseCalendar({ upcoming }: { upcoming: UpcomingRelease[] }) {
  const sorted = [...upcoming].sort((a, b) =>
    a.expectedDate.localeCompare(b.expectedDate),
  );

  return (
    <section aria-labelledby="calendar-heading" className="space-y-4">
      <div>
        <h2
          id="calendar-heading"
          className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-slate-900"
        >
          발표 일정
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          앞으로의 주·월·분기 공표 예정입니다.
        </p>
      </div>
      <ul className="space-y-2">
        {sorted.map((item) => {
          const meta = getIndicator(item.indicatorId);
          return (
            <li
              key={`${item.indicatorId}-${item.expectedDate}`}
              className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-slate-200 py-3 text-sm"
            >
              <time
                dateTime={item.expectedDate}
                className="tabular-nums text-teal-900"
              >
                {item.expectedDate}
              </time>
              <div>
                <p className="font-medium text-slate-900">{item.label}</p>
                <p className="text-slate-500">
                  {meta ? `${getGroup(meta.groupId)?.nameKo} · ${meta.nameKo}` : item.indicatorId}
                  {" · "}
                  {meta?.agencyKo}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
