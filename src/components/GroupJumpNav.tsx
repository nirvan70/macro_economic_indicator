"use client";

import type { ReactNode } from "react";

const ICON_CLASS =
  "h-[2.65rem] w-[2.65rem] drop-shadow-[0_2px_2px_rgba(15,23,42,0.18)] transition duration-300 ease-out group-hover:drop-shadow-[0_4px_6px_rgba(13,148,136,0.35)] group-active:drop-shadow-[0_4px_6px_rgba(13,148,136,0.35)] sm:h-[2.9rem] sm:w-[2.9rem]";

const NAV: {
  id: string;
  targetId: string;
  label: ReactNode;
  icon: ReactNode;
}[] = [
  {
    id: "financial-markets",
    targetId: "group-financial-markets",
    label: "금융시장",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden className={ICON_CLASS}>
        {/* stacked coins */}
        <ellipse
          cx="20"
          cy="30.5"
          rx="8.5"
          ry="3.2"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M11.5 30.5v4.2c0 1.8 3.8 3.2 8.5 3.2s8.5-1.4 8.5-3.2V30.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <ellipse
          cx="20"
          cy="26.2"
          rx="8.5"
          ry="3.2"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M11.5 26.2v4.3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M28.5 26.2v4.3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* banknote */}
        <rect
          x="22"
          y="12"
          width="16"
          height="11"
          rx="1.8"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          cx="30"
          cy="17.5"
          r="2.4"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M24.5 14.2h2M33.5 14.2h2M24.5 20.8h2M33.5 20.8h2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "activity",
    targetId: "group-activity",
    label: "국내경기",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden className={ICON_CLASS}>
        <path
          d="M12 34V20l6-5 5 4 6-6 7 6v15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 34v-7h5v7M28 34V22h5v12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="34.5"
          cy="34.5"
          r="5.2"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="#e8edf8"
        />
        <path
          d="M32.2 34.5h4.6M34.5 32.2v4.6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "national-accounts",
    targetId: "group-national-accounts",
    label: "국민계정",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden className={ICON_CLASS}>
        <path
          d="M14 18.5h20a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M12 22.5h24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="18" cy="28.5" r="1.6" fill="currentColor" />
        <path
          d="M24 28.5h7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "overseas",
    targetId: "group-overseas",
    label: "해외지표",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden className={ICON_CLASS}>
        <path
          d="M16 31.5c0-1.4.8-2.7 2.1-3.3l5.4-2.4a3.2 3.2 0 0 1 2.6 0l.7.3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14.5 33.5c1.2 2.4 4.4 4 8.2 4 5.4 0 9.8-3.1 9.8-7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="28.5" cy="20" r="7" stroke="currentColor" strokeWidth="2" />
        <path
          d="M21.5 20h14M28.5 13c2 2.1 3 4.4 3 7s-1 4.9-3 7c-2-2.1-3-4.4-3-7s1-4.9 3-7Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "related-news",
    targetId: "related-news",
    label: "최신 기사",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden className={ICON_CLASS}>
        <path
          d="M16 13h14.5A3.5 3.5 0 0 1 34 16.5V35H18.5A2.5 2.5 0 0 1 16 32.5V13Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M16 17H13.8A2.3 2.3 0 0 0 11.5 19.3v13.2A3.5 3.5 0 0 0 15 36h19"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20.5 20.5h9M20.5 25h9M20.5 29.5h6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "graph-builder",
    targetId: "graph-builder",
    label: (
      <>
        그래프 그리기
        <br />
        및 다운로드
      </>
    ),
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden className={ICON_CLASS}>
        {/* chart axes */}
        <path
          d="M10 34h24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M10 14v20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* drawn line on chart */}
        <path
          d="M14 29 19.5 23.5l5 4.5 7.5-10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="18" r="1.6" fill="currentColor" />
        {/* pencil at top-right */}
        <g transform="translate(33.5 9.5) rotate(38)">
          <rect
            x="0"
            y="0"
            width="4.2"
            height="14"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.7"
            fill="#e8edf8"
          />
          <path
            d="M0.4 14 2.1 17.6 3.8 14Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="currentColor"
          />
          <path
            d="M0.3 2.4h3.6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </svg>
    ),
  },
  {
    id: "history-longrun",
    targetId: "history-longrun",
    label: "장기시계열",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden className={ICON_CLASS}>
        <path
          d="M12 34h24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M14 28V18M20 28v-6M26 28V14M32 28v-9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M14 22.5 20 19l6-7 8 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="34" cy="17" r="1.8" fill="currentColor" />
      </svg>
    ),
  },
];

const navItemClass =
  "group flex w-full max-w-[6rem] touch-manipulation flex-col items-center gap-2 text-center transition select-none";

const iconShellClass =
  "relative z-0 flex h-[3.95rem] w-[3.95rem] origin-center items-center justify-center rounded-full text-slate-800 transition-all duration-300 ease-out group-hover:z-10 group-hover:-translate-y-1.5 group-hover:scale-[1.28] group-hover:text-teal-900 group-active:z-10 group-active:-translate-y-1.5 group-active:scale-[1.22] group-active:text-teal-900 sm:h-[4.3rem] sm:w-[4.3rem]";

const iconShellStyleIdle = {
  background:
    "radial-gradient(circle at 32% 28%, #f7f9fd 0%, #dce5f4 46%, #b8c6de 100%)",
  boxShadow:
    "inset 0 2px 3px rgba(255,255,255,0.85), inset 0 -6px 10px rgba(71,85,105,0.22), 0 8px 14px -8px rgba(15,23,42,0.35), 0 2px 3px rgba(15,23,42,0.12)",
} as const;

function NavIconShell({ icon }: { icon: ReactNode }) {
  return (
    <span
      className={`${iconShellClass} group-hover:[background:radial-gradient(circle_at_32%_28%,#ecfdf5_0%,#99f6e4_48%,#0d9488_100%)] group-hover:[box-shadow:inset_0_2px_3px_rgba(255,255,255,0.7),inset_0_-6px_10px_rgba(13,148,136,0.28),0_12px_18px_-8px_rgba(13,148,136,0.45)] group-active:[background:radial-gradient(circle_at_32%_28%,#ecfdf5_0%,#99f6e4_48%,#0d9488_100%)] group-active:[box-shadow:inset_0_2px_3px_rgba(255,255,255,0.7),inset_0_-6px_10px_rgba(13,148,136,0.28),0_12px_18px_-8px_rgba(13,148,136,0.45)]`}
      style={iconShellStyleIdle}
    >
      <span
        className="pointer-events-none absolute inset-[7%] rounded-full opacity-70 transition group-hover:opacity-95 group-active:opacity-95"
        style={{
          background:
            "radial-gradient(circle at 30% 22%, rgba(255,255,255,0.75) 0%, transparent 42%)",
        }}
        aria-hidden
      />
      <span className="relative z-[1] transition duration-300 group-hover:scale-105 group-active:scale-105">
        {icon}
      </span>
    </span>
  );
}

export function GroupJumpNav() {
  function jumpTo(targetId: string) {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${targetId}`);
  }

  return (
    <nav aria-label="지표 그룹 바로가기" className="w-full">
      <ul className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-7 sm:gap-x-3">
        {NAV.map((item) => (
          <li key={item.id} className="flex justify-center">
            <button
              type="button"
              onClick={() => jumpTo(item.targetId)}
              className={navItemClass}
            >
              <NavIconShell icon={item.icon} />
              <span className="text-[13px] font-medium leading-snug text-slate-800 transition group-hover:text-teal-900 group-active:text-teal-900">
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
