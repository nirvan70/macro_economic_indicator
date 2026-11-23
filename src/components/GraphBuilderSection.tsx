"use client";

import { useMemo, useState } from "react";
import { GraphBuilder } from "@/components/GraphBuilder";
import type { IndicatorSnapshot } from "@/lib/analysis";
import { INDICATOR_GROUPS } from "@/lib/indicators";
import type { DataStore, IndicatorGroupId } from "@/lib/types";

export function GraphBuilderSection({
  snapshots,
  store,
}: {
  snapshots: IndicatorSnapshot[];
  store: DataStore;
}) {
  const groups = useMemo(
    () =>
      INDICATOR_GROUPS.filter((group) =>
        snapshots.some((item) => item.groupId === group.id),
      ),
    [snapshots],
  );

  const preferredDefault: IndicatorGroupId | null =
    groups.find((g) => g.id === "activity")?.id ??
    groups.find((g) => g.id === "national-accounts")?.id ??
    groups[0]?.id ??
    null;

  const [activeId, setActiveId] = useState<IndicatorGroupId | null>(
    preferredDefault,
  );

  const activeGroup =
    groups.find((g) => g.id === activeId) ?? groups[0] ?? null;

  if (!activeGroup) return null;

  return (
    <section
      aria-labelledby="graph-builder-heading"
      className="space-y-4 rounded-sm bg-white/75 px-3 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur sm:px-5"
    >
      <div className="sr-only">
        <h2 id="graph-builder-heading">그래프 그리기 및 다운로드</h2>
      </div>

      <div
        role="tablist"
        aria-label="지표 그룹"
        className="flex flex-wrap gap-1.5 border-b border-slate-900/10 pb-3"
      >
        {groups.map((group) => {
          const selected = group.id === activeGroup.id;
          const count = snapshots.filter((s) => s.groupId === group.id).length;
          return (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(group.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                selected
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {group.nameKo}
              <span
                className={`ml-1.5 text-[10px] tabular-nums ${
                  selected ? "text-white/70" : "text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={activeGroup.nameKo}>
        <GraphBuilder
          key={activeGroup.id}
          group={activeGroup}
          snapshots={snapshots}
          store={store}
          defaultOpen
          compactHeader
        />
      </div>
    </section>
  );
}
