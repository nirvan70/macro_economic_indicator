import { NextResponse } from "next/server";
import { refreshInstitutionOutlooks } from "@/lib/outlooks";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  try {
    const result = await refreshInstitutionOutlooks({
      force: true,
      log: (message) => console.log(`[api/outlook] ${message}`),
    });
    return NextResponse.json({
      ok: true,
      updated: result.updated,
      checkedAt: result.checkedAt,
      outlooks: result.outlooks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/outlook]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await refreshInstitutionOutlooks({
      force: false,
      log: (message) => console.log(`[api/outlook] ${message}`),
    });
    return NextResponse.json({
      ok: true,
      updated: result.updated,
      checkedAt: result.checkedAt,
      fromCache: result.fromCache,
      outlooks: result.outlooks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/outlook]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
