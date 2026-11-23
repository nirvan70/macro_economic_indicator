import { fetchOverseasNews } from "@/lib/sources/overseas-news";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const news = await fetchOverseasNews(12);
    return Response.json({ ok: true, news });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
