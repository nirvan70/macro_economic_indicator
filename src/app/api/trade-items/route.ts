import { NextRequest, NextResponse } from "next/server";
import { fetchTrackedItemTradeAroundPeriod } from "@/lib/sources/customs-items";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period")?.trim() ?? "";
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json(
      { error: "period must be YYYY-MM" },
      { status: 400 },
    );
  }

  try {
    const items = await fetchTrackedItemTradeAroundPeriod(period);
    return NextResponse.json({ period, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
