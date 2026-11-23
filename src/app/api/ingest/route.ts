import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await runIngest({
      history: false,
      notify: false,
      log: (message) => console.log(`[api/ingest] ${message}`),
    });
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/ingest]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
