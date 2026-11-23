import { fetchRelatedNews } from "@/lib/sources/news";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const news = await fetchRelatedNews(14);
    return Response.json({ ok: true, news });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
