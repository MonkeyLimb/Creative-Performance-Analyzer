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

export type TierStatus = "winner" | "watch" | "cut";

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
  winnerCpl: number;
  cutCpl: number;
  winnerRoas: number;
  cutRoas: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  winnerCpl: 20,
  cutCpl: 50,
  winnerRoas: 2,
  cutRoas: 1,
};

export type AdAccount = {
  actId: string;
  businessId?: string;
};

export type ParseResult =
  | { ok: true; creatives: Creative[]; warnings: string[] }
  | { ok: false; error: string };
