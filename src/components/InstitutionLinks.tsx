const INSTITUTIONS: {
  id: string;
  nameKo: string;
  nameEn: string;
  href: string;
  note: string;
  logoSrc: string;
}[] = [
  {
    id: "bok",
    nameKo: "한국은행",
    nameEn: "Bank of Korea",
    href: "https://www.bok.or.kr",
    note: "통화정책·경제전망",
    logoSrc: "/institutions/bok.svg",
  },
  {
    id: "kdi",
    nameKo: "KDI",
    nameEn: "Korea Development Institute",
    href: "https://www.kdi.re.kr",
    note: "경제전망·정책연구",
    logoSrc: "/institutions/kdi.png",
  },
  {
    id: "kostat",
    nameKo: "통계청",
    nameEn: "Statistics Korea",
    href: "https://kostat.go.kr",
    note: "물가·고용·산업활동",
    logoSrc: "/institutions/kostat.png",
  },
  {
    id: "imf",
    nameKo: "IMF",
    nameEn: "International Monetary Fund",
    href: "https://www.imf.org",
    note: "세계경제전망(WEO)",
    logoSrc: "/institutions/imf.png",
  },
  {
    id: "oecd",
    nameKo: "OECD",
    nameEn: "OECD",
    href: "https://www.oecd.org",
    note: "경제전망·지표",
    logoSrc: "/institutions/oecd.svg",
  },
  {
    id: "bis",
    nameKo: "BIS",
    nameEn: "Bank for International Settlements",
    href: "https://www.bis.org",
    note: "국제금융·중앙은행",
    logoSrc: "/institutions/bis.svg",
  },
  {
    id: "fed",
    nameKo: "미 연준",
    nameEn: "Federal Reserve",
    href: "https://www.federalreserve.gov",
    note: "FOMC·통화정책",
    logoSrc: "/institutions/fed.png",
  },
  {
    id: "fred",
    nameKo: "FRED",
    nameEn: "St. Louis Fed",
    href: "https://fred.stlouisfed.org",
    note: "미국 매크로 통계",
    logoSrc: "/institutions/fred.svg",
  },
  {
    id: "fedwatch",
    nameKo: "CME FedWatch",
    nameEn: "CME Group",
    href: "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool",
    note: "금리 인상·인하 확률",
    logoSrc: "/institutions/cme.png",
  },
];

export function InstitutionLinks() {
  return (
    <section
      aria-labelledby="institution-links-heading"
      className="w-full max-h-[calc(100vh-3.5rem)] space-y-2.5 overflow-y-auto rounded-2xl border border-teal-900/15 bg-white/90 px-2.5 py-3 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur"
    >
      <div className="px-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-800">
          Quick links
        </p>
        <h2
          id="institution-links-heading"
          className="mt-0.5 font-[family-name:var(--font-display)] text-[15px] font-bold leading-snug tracking-tight text-slate-950"
        >
          주요 기관
          <br />
          바로가기
        </h2>
      </div>

      <ul className="flex flex-col">
        {INSTITUTIONS.map((item) => (
          <li key={item.id}>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start justify-between gap-1 border-b border-slate-200 px-0.5 py-2 transition hover:border-teal-700/40"
            >
              <span className="flex min-w-0 items-start gap-1.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-white ring-1 ring-slate-200/80">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.logoSrc}
                    alt=""
                    width={16}
                    height={16}
                    className="h-3.5 w-3.5 object-contain"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-slate-900 group-hover:text-teal-900">
                    {item.nameKo}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                    {item.note}
                  </span>
                </span>
              </span>
              <span
                className="shrink-0 pt-0.5 text-[10px] text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-teal-700"
                aria-hidden
              >
                ↗
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
