import { Creative, TierStatus, Thresholds } from "./types";

export function classify(
  c: Creative,
  t: Thresholds,
  roas: number | null = null,
): TierStatus {
  // Spending with zero leads is always a cut, regardless of ROAS source.
  if (c.spend > 0 && c.results === 0) return "cut";
  // Prefer ROAS classification when we have it (a school match + RPL).
  if (roas != null) {
    if (roas >= t.winnerRoas) return "winner";
    if (roas < t.cutRoas) return "cut";
    return "watch";
  }
  // Fallback to CPL when no ROAS is available (creative isn't tied to a school).
  if (c.cpl == null) return "watch";
  if (c.cpl <= t.winnerCpl) return "winner";
  if (c.cpl >= t.cutCpl) return "cut";
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

export type CplBand = {
  winnerCpl: number;
  cutCpl: number;
};

// Given a program's RPL and the global ROAS thresholds, derive the equivalent
// per-program CPL band. Equates the ROAS classifier's break points in CPL
// space so the user can see their target as a CPL number, not just a ROAS multiplier.
export function derivedCplBand(rpl: number, t: Thresholds): CplBand | null {
  if (!Number.isFinite(rpl) || rpl <= 0) return null;
  if (!Number.isFinite(t.winnerRoas) || t.winnerRoas <= 0) return null;
  if (!Number.isFinite(t.cutRoas) || t.cutRoas <= 0) return null;
  return {
    winnerCpl: rpl / t.winnerRoas,
    cutCpl: rpl / t.cutRoas,
  };
}

export function summarize(
  creatives: Creative[],
  t: Thresholds,
): TierSummary[] {
  const order: TierStatus[] = ["winner", "watch", "cut"];
  const buckets: Record<TierStatus, Creative[]> = {
    winner: [],
    watch: [],
    cut: [],
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
