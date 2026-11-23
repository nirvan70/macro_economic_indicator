import { ForecastBanner } from "@/components/ForecastBanner";
import { fetchBokOutlook } from "@/lib/sources/bok-outlook";
import { fetchImfOutlook } from "@/lib/sources/imf-outlook";
import { fetchOecdOutlook } from "@/lib/sources/oecd-outlook";

export async function ForecastSection() {
  const [bok, imf, oecd] = await Promise.all([
    fetchBokOutlook(),
    fetchImfOutlook(),
    fetchOecdOutlook(),
  ]);
  return <ForecastBanner outlooks={[bok, imf, oecd]} />;
}

export function ForecastSectionFallback() {
  return (
    <aside
      aria-label="경제전망 로딩"
      className="rounded-xl border border-teal-900/15 bg-teal-900/90 px-4 py-5 sm:px-6"
    >
      <p className="text-sm text-teal-100">
        한국은행·IMF·OECD 경제전망을 불러오는 중…
      </p>
    </aside>
  );
}
