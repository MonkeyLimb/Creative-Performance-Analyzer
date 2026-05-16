import { Creative } from "@/lib/types";

export type MergeReport = {
  added: number;
  updated: number;
  untouched: number;
};

export type MergeResult = {
  merged: Creative[];
  report: MergeReport;
};

// Fields the user owns (manual tags, notes, etc.). Preserved on the existing
// row even when a fresh CSV upload includes the field. Empty for now;
// Step 5 will populate this list.
const USER_FIELDS = new Set<keyof Creative>([]);

function key(c: Pick<Creative, "adId" | "adName">): string {
  return c.adId || c.adName;
}

function isNullish(v: unknown): boolean {
  return v === null || v === undefined;
}

function mergeOne(
  existing: Creative,
  incoming: Creative,
): { merged: Creative; changed: boolean } {
  const merged: Creative = { ...existing };
  let changed = false;
  for (const k of Object.keys(incoming) as (keyof Creative)[]) {
    if (USER_FIELDS.has(k)) continue;
    if (k === "raw") continue;
    const inV = incoming[k];
    if (isNullish(inV)) continue;
    if (existing[k] !== inV) {
      (merged as any)[k] = inV;
      changed = true;
    }
  }
  // `raw` is the snapshot of the source CSV row — always take the latest if
  // it's present and shaped like a record, since it backs the row-detail view.
  if (incoming.raw && typeof incoming.raw === "object") {
    const before = JSON.stringify(existing.raw ?? {});
    const after = JSON.stringify(incoming.raw);
    if (before !== after) {
      merged.raw = incoming.raw;
      changed = true;
    }
  }
  return { merged, changed };
}

export function mergeCreatives(
  existing: Creative[],
  incoming: Creative[],
): MergeResult {
  const byKey = new Map<string, Creative>(existing.map((c) => [key(c), c]));
  const touched = new Set<string>();
  let added = 0;
  let updated = 0;

  for (const inc of incoming) {
    const k = key(inc);
    touched.add(k);
    const prior = byKey.get(k);
    if (!prior) {
      byKey.set(k, inc);
      added++;
    } else {
      const { merged, changed } = mergeOne(prior, inc);
      byKey.set(k, merged);
      if (changed) updated++;
    }
  }

  const untouched = existing.filter((c) => !touched.has(key(c))).length;
  return {
    merged: Array.from(byKey.values()),
    report: { added, updated, untouched },
  };
}

export function summarizeReport(r: MergeReport): string {
  const parts: string[] = [];
  if (r.added) parts.push(`+${r.added} new`);
  if (r.updated) parts.push(`${r.updated} updated`);
  if (r.untouched) parts.push(`${r.untouched} untouched`);
  return parts.length ? parts.join(" · ") : "No changes";
}
