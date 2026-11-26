"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type OutlookResponse = {
  ok: boolean;
  updated?: string[];
  checkedAt?: string;
  fromCache?: boolean;
  error?: string;
};

const INSTITUTION_KO: Record<string, string> = {
  bok: "한국은행",
  imf: "IMF",
  oecd: "OECD",
};

export function UpdateForecastButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const startupChecked = useRef(false);

  async function refresh(force: boolean) {
    if (status === "loading") return;
    setStatus("loading");
    setMessage(
      force
        ? "한은·IMF·OECD 전망 자료를 확인하는 중…"
        : "앱 시작 시 전망 자료 갱신 여부 확인 중…",
    );
    try {
      const res = await fetch("/api/outlook", {
        method: force ? "POST" : "GET",
        cache: "no-store",
      });
      const data = (await res.json()) as OutlookResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const updated = data.updated ?? [];
      setStatus("done");
      if (updated.length > 0) {
        setMessage(
          `${updated.map((id) => INSTITUTION_KO[id] ?? id).join(" · ")} 전망이 갱신되었습니다.`,
        );
        router.refresh();
      } else if (data.fromCache) {
        setMessage("최근 확인한 전망을 유지합니다.");
      } else {
        setMessage("새 전망 발표는 없고 기존 수치를 확인했습니다.");
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    if (startupChecked.current) return;
    startupChecked.current = true;
    void refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  return (
    <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={() => {
          void refresh(true);
        }}
        disabled={status === "loading"}
        className="rounded-md border border-white/20 bg-white/15 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/25 disabled:cursor-wait disabled:opacity-70"
      >
        {status === "loading" ? "확인 중…" : "전망자료 업데이트"}
      </button>
      {message ? (
        <p
          className={`max-w-[16rem] text-right text-[10px] leading-snug ${
            status === "error" ? "text-rose-200" : "text-teal-100/80"
          }`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
