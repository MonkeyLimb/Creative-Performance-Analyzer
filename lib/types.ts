export type DeliveryStatus =
  | "active"
  | "inactive"
  | "paused"
  | "completed"
  | "rejected"
  | "in_review"
  | "unknown";

export type QualityRanking =
  | "above_average"
  | "average"
  | "below_average_35"
  | "below_average_20"
  | "below_average_10"
  | "unknown";

export type TierStatus = "winner" | "watch" | "cut" | "new";

export type Creative = {
  adName: string;
  adId?: string;
  campaignName?: string;
  adSetName?: string;
  spend: number;
  results: number;
  cpl: number | null;
  impressions: number;
  reach: number;
  frequency: number | null;
  ctr: number | null;
  cpm: number | null;
  delivery: DeliveryStatus;
  quality: QualityRanking;
  engagement: QualityRanking;
  conversion: QualityRanking;
  raw: Record<string, string>;
};

export type Thresholds = {
  targetCpl: number;
  winnerMultiplier: number;
  cutMultiplier: number;
  minSpend: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  targetCpl: 50,
  winnerMultiplier: 0.7,
  cutMultiplier: 1.3,
  minSpend: 100,
};

export type AdAccount = {
  actId: string;
  businessId?: string;
};

export type ParseResult =
  | { ok: true; creatives: Creative[]; warnings: string[] }
  | { ok: false; error: string };
