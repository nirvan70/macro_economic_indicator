"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type IngestResponse = {
  ok: boolean;
  updated?: string[];
  skipped?: { id: string; reason: string }[];
  updatedAt?: string;
  error?: string;
};

export function UpdateDataButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    if (status === "loading") return;
    setStatus("loading");
    setMessage("기관 API에서 최신 자료를 받아오는 중…");
    try {
      const res = await fetch("/api/ingest", { method: "POST" });
      const data = (await res.json()) as IngestResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const count = data.updated?.length ?? 0;
      setStatus("done");
      setMessage(
        count > 0
          ? `${count}개 지표가 갱신되었습니다.`
          : "새 발표는 없고 기존 최신값을 확인했습니다.",
      );
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => {
          void onClick();
        }}
        disabled={status === "loading"}
        className="rounded-lg bg-teal-800 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-teal-900 disabled:cursor-wait disabled:opacity-70"
      >
        {status === "loading" ? "업데이트 중…" : "데이터 업데이트"}
      </button>
      {message ? (
        <p
          className={`text-xs ${
            status === "error" ? "text-rose-700" : "text-slate-600"
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
