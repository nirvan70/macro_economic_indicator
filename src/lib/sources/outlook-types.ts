export type OutlookInstitution = "bok" | "kdi" | "oecd" | "imf";

export type InstitutionOutlook = {
  institution: OutlookInstitution;
  nameKo: string;
  nameEn: string;
  title: string;
  publishedAt: string;
  sourceUrl: string;
  growthThisYear: number;
  growthNextYear: number;
  cpiThisYear: number | null;
  cpiNextYear: number | null;
  thisYearLabel: string;
  nextYearLabel: string;
  fetchedAt: string;
};

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "korea-macro-dashboard/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}
