import { AdAccount } from "./types";

const BASE = "https://adsmanager.facebook.com/adsmanager/manage/ads";

export type BuildAdsManagerUrlOptions = {
  account: AdAccount;
  adNames: string[];
  adIds?: string[];
};

export function buildAdsManagerUrl({
  account,
  adNames,
  adIds,
}: BuildAdsManagerUrlOptions): string {
  if (!account.actId) throw new Error("Missing ad account id (actId).");
  if (adNames.length === 0) throw new Error("At least one ad name required.");

  const params = new URLSearchParams();
  params.set("act", normalizeActId(account.actId));
  if (account.businessId) {
    params.set("business_id", account.businessId);
    params.set("global_scope_id", account.businessId);
  }

  params.set("filter_set", `SEARCH_BY_AD_NAME-STRING-EQUAL-${encodeAdNameFilter(adNames)}`);

  if (adIds && adIds.length > 0) {
    params.set("selected_ad_ids", adIds.join(","));
  }

  return `${BASE}?${params.toString()}`;
}

export function encodeAdNameFilter(adNames: string[]): string {
  return encodeURIComponent(JSON.stringify(JSON.stringify(adNames)));
}

export function normalizeActId(actId: string): string {
  const trimmed = actId.trim();
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}
