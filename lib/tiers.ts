import { Creative, TierStatus, Thresholds } from "./types";

export function classify(c: Creative, t: Thresholds): TierStatus {
  if (c.spend < t.minSpend) return "new";
  if (c.cpl == null) return "new";
  if (c.cpl <= t.targetCpl * t.winnerMultiplier) return "winner";
  if (c.cpl >= t.targetCpl * t.cutMultiplier) return "cut";
  return "watch";
}

export function classifyAll(
  creatives: Creative[],
  t: Thresholds,
): Map<string, TierStatus> {
  const out = new Map<string, TierStatus>();
  for (const c of creatives) {
    out.set(creativeKey(c), classify(c, t));
  }
  return out;
}

export function creativeKey(c: Creative): string {
  return c.adId || c.adName;
}

export type TierSummary = {
  status: TierStatus;
  count: number;
  spend: number;
  results: number;
  cpl: number | null;
};

export function summarize(
  creatives: Creative[],
  t: Thresholds,
): TierSummary[] {
  const order: TierStatus[] = ["winner", "watch", "cut", "new"];
  const buckets: Record<TierStatus, Creative[]> = {
    winner: [],
    watch: [],
    cut: [],
    new: [],
  };
  for (const c of creatives) buckets[classify(c, t)].push(c);
  return order.map((status) => {
    const items = buckets[status];
    const spend = items.reduce((s, c) => s + c.spend, 0);
    const results = items.reduce((s, c) => s + c.results, 0);
    return {
      status,
      count: items.length,
      spend,
      results,
      cpl: results > 0 ? spend / results : null,
    };
  });
}
