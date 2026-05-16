import { Creative, TierStatus } from "./types";
import { CreativeRoas } from "./schools";

export const MAX_DIFF_CREATIVES = 4;
export const MIN_DIFF_CREATIVES = 2;

// Within-tolerance ties skip best/worst highlighting so a 100 vs 103 CPL
// pair doesn't get colored as if it were a meaningful gap.
const TIE_TOLERANCE = 0.05;

export type Direction = "higher" | "lower" | "neutral";

export type DiffItem = {
  creative: Creative;
  roas: CreativeRoas;
  status: TierStatus;
};

export type NumericRow = {
  key: string;
  label: string;
  direction: Direction;
  values: (number | null)[];
  bestIndex: number | null;
  worstIndex: number | null;
};

export type DiffResult = {
  keys: string[];
  numeric: NumericRow[];
};

type NumericSpec = {
  key: string;
  label: string;
  direction: Direction;
  get: (item: DiffItem) => number | null;
};

const NUMERIC_SPECS: NumericSpec[] = [
  { key: "spend", label: "Spend", direction: "neutral", get: (i) => i.creative.spend },
  { key: "results", label: "Leads", direction: "higher", get: (i) => i.creative.results },
  { key: "cpl", label: "CPL", direction: "lower", get: (i) => i.creative.cpl },
  { key: "rpl", label: "RPL", direction: "neutral", get: (i) => i.roas.rpl },
  { key: "revenue", label: "Revenue", direction: "higher", get: (i) => i.roas.revenue },
  { key: "roas", label: "ROAS", direction: "higher", get: (i) => i.roas.roas },
  { key: "ctr", label: "CTR", direction: "higher", get: (i) => i.creative.ctr },
  { key: "cpm", label: "CPM", direction: "lower", get: (i) => i.creative.cpm },
  { key: "frequency", label: "Frequency", direction: "lower", get: (i) => i.creative.frequency },
  { key: "impressions", label: "Impressions", direction: "neutral", get: (i) => i.creative.impressions },
  { key: "reach", label: "Reach", direction: "neutral", get: (i) => i.creative.reach },
];

export function diffKey(c: Pick<Creative, "adId" | "adName">): string {
  return c.adId || c.adName;
}

export function computeDiff(items: DiffItem[]): DiffResult {
  const keys = items.map((i) => diffKey(i.creative));
  const numeric: NumericRow[] = NUMERIC_SPECS.map((spec) => {
    const values = items
      .map(spec.get)
      .map((v) => (v != null && Number.isFinite(v) ? v : null));
    const { bestIndex, worstIndex } = bestWorst(values, spec.direction);
    return {
      key: spec.key,
      label: spec.label,
      direction: spec.direction,
      values,
      bestIndex,
      worstIndex,
    };
  });
  return { keys, numeric };
}

function bestWorst(
  values: (number | null)[],
  direction: Direction,
): { bestIndex: number | null; worstIndex: number | null } {
  if (direction === "neutral") return { bestIndex: null, worstIndex: null };

  const valid: { v: number; i: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v != null) valid.push({ v, i });
  }
  if (valid.length < 2) return { bestIndex: null, worstIndex: null };

  let minEntry = valid[0];
  let maxEntry = valid[0];
  for (const entry of valid) {
    if (entry.v < minEntry.v) minEntry = entry;
    if (entry.v > maxEntry.v) maxEntry = entry;
  }

  const reference = Math.max(Math.abs(maxEntry.v), Math.abs(minEntry.v));
  if (reference === 0) return { bestIndex: null, worstIndex: null };
  const spread = Math.abs(maxEntry.v - minEntry.v) / reference;
  if (spread < TIE_TOLERANCE) return { bestIndex: null, worstIndex: null };

  if (direction === "higher") {
    return { bestIndex: maxEntry.i, worstIndex: minEntry.i };
  }
  return { bestIndex: minEntry.i, worstIndex: maxEntry.i };
}
