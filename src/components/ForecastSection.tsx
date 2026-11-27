import { ForecastBanner } from "@/components/ForecastBanner";
import { getOutlooksForDisplay } from "@/lib/outlooks";

export async function ForecastSection() {
  // Server-side startup check (throttled): refresh store when stale.
  const outlooks = await getOutlooksForDisplay();
  return <ForecastBanner outlooks={outlooks} />;
}

export function ForecastSectionFallback() {
  return (
    <aside
      aria-label="경제전망 로딩"
      className="rounded-xl border border-teal-900/15 bg-teal-900/90 px-4 py-5 sm:px-6"
    >
      <p className="text-sm text-teal-100">
        한국은행·IMF 경제전망을 불러오는 중…
      </p>
    </aside>
  );
}
