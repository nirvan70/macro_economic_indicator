import { DualHistoryChart } from "@/components/DualHistoryChart";
import type { ConsumptionComponentBundle } from "@/lib/types";

export function ConsumptionBreakdown({
  components,
}: {
  components: ConsumptionComponentBundle[];
}) {
  if (components.length === 0) {
    return (
      <p className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
        형태별 소비 시계열이 아직 없습니다. 데이터 업데이트를 실행해 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-slate-900">
          형태별 민간소비
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          내구재·준내구재·비내구재의 전기비(계절조정·실질)와 전년동기비(원계열·실질)를
          최근 10년 기준으로 함께 표시합니다. 그래프에 마우스를 올리면 해당 분기의
          증가율이 나타납니다.
        </p>
      </div>
      {components.map((component) => (
        <section
          key={component.id}
          className="rounded-sm bg-white/75 px-3 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur sm:px-5"
        >
          <h3 className="mb-4 font-[family-name:var(--font-display)] text-lg text-slate-900">
            {component.nameKo}
          </h3>
          <DualHistoryChart
            primary={component.qoq}
            secondary={component.yoy}
            primaryLabel="전기비"
            secondaryLabel="전년동기비"
            unit="%"
            digits={1}
            maxYears={10}
            primaryColor="#0f766e"
            secondaryColor="#b45309"
          />
        </section>
      ))}
    </div>
  );
}
