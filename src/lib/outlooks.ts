import { fetchBokOutlook } from "@/lib/sources/bok-outlook";
import { fetchImfOutlook } from "@/lib/sources/imf-outlook";
import type { InstitutionOutlook } from "@/lib/sources/outlook-types";
import { readStore, writeStore } from "@/lib/store";

/** Skip automatic startup re-check if last check was within this window. */
export const OUTLOOK_CHECK_TTL_MS = 60 * 60 * 1000;

function outlookFingerprint(o: InstitutionOutlook): string {
  return [
    o.institution,
    o.title,
    o.publishedAt,
    o.growthThisYear,
    o.growthNextYear,
    o.cpiThisYear ?? "",
    o.cpiNextYear ?? "",
    o.sourceUrl,
  ].join("|");
}

function sameOutlook(
  a: InstitutionOutlook | undefined,
  b: InstitutionOutlook,
): boolean {
  if (!a) return false;
  return outlookFingerprint(a) === outlookFingerprint(b);
}

export type OutlookRefreshResult = {
  outlooks: InstitutionOutlook[];
  updated: string[];
  checkedAt: string;
  fromCache: boolean;
};

function orderOutlooks(
  list: InstitutionOutlook[],
): InstitutionOutlook[] {
  const rank: Record<string, number> = { bok: 0, imf: 1 };
  return list
    .filter((row) => row.institution === "bok" || row.institution === "imf")
    .sort((a, b) => (rank[a.institution] ?? 9) - (rank[b.institution] ?? 9));
}

export async function readStoredOutlooks(): Promise<{
  outlooks: InstitutionOutlook[];
  checkedAt?: string;
}> {
  const store = await readStore();
  return {
    outlooks: orderOutlooks(store.outlooks ?? []),
    checkedAt: store.outlooksCheckedAt,
  };
}

/**
 * Fetch BOK / IMF outlooks and persist when values change.
 * `force` ignores the startup TTL and always re-fetches.
 */
export async function refreshInstitutionOutlooks(opts?: {
  force?: boolean;
  log?: (message: string) => void;
}): Promise<OutlookRefreshResult> {
  const force = Boolean(opts?.force);
  const log = opts?.log ?? (() => undefined);
  const store = await readStore();
  const checkedAt = store.outlooksCheckedAt;
  const cached = orderOutlooks(store.outlooks ?? []);

  if (!force && checkedAt) {
    const age = Date.now() - Date.parse(checkedAt);
    if (Number.isFinite(age) && age >= 0 && age < OUTLOOK_CHECK_TTL_MS) {
      log(`[outlook] skip re-check (age ${Math.round(age / 1000)}s)`);
      return {
        outlooks: cached,
        updated: [],
        checkedAt,
        fromCache: true,
      };
    }
  }

  log("[outlook] fetching BOK · IMF…");
  const [bok, imf] = await Promise.all([fetchBokOutlook(), fetchImfOutlook()]);
  const fresh = orderOutlooks([bok, imf]);
  const prevById = new Map(cached.map((row) => [row.institution, row]));
  const updated: string[] = [];
  for (const row of fresh) {
    if (!sameOutlook(prevById.get(row.institution), row)) {
      updated.push(row.institution);
    }
  }

  const now = new Date().toISOString();
  store.outlooks = fresh;
  store.outlooksCheckedAt = now;
  if (updated.length > 0) {
    store.outlooksUpdatedAt = now;
  }
  await writeStore(store);

  log(
    updated.length > 0
      ? `[outlook] updated: ${updated.join(", ")}`
      : "[outlook] no change",
  );

  return {
    outlooks: fresh,
    updated,
    checkedAt: now,
    fromCache: false,
  };
}

/** Startup / page-load: check once per TTL, else return stored (or live seed). */
export async function getOutlooksForDisplay(): Promise<InstitutionOutlook[]> {
  const result = await refreshInstitutionOutlooks({ force: false });
  if (result.outlooks.length > 0) return result.outlooks;

  const [bok, imf] = await Promise.all([fetchBokOutlook(), fetchImfOutlook()]);
  return orderOutlooks([bok, imf]);
}
