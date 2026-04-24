import {
  Creative,
  DeliveryStatus,
  ParseResult,
  QualityRanking,
} from "./types";

export function parseCsv(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "CSV is empty." };
  }

  const rows = splitRows(trimmed);
  if (rows.length < 2) {
    return { ok: false, error: "CSV has no data rows." };
  }

  const header = rows[0].map((h) => h.trim());
  const required = findRequiredColumns(header);
  if (!required.adName) {
    return {
      ok: false,
      error:
        "Missing required column. Expected an 'Ad name' column from the Meta Ads Manager export.",
    };
  }

  const warnings: string[] = [];
  const creatives: Creative[] = [];
  const aggregator = new Map<string, Creative>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && row[0] === "") continue;
    const record = toRecord(header, row);
    const adName = record[required.adName].trim();
    if (!adName) continue;

    const creative = rowToCreative(record, required);
    const existing = aggregator.get(creative.adId || creative.adName);
    if (existing) {
      mergeCreative(existing, creative);
    } else {
      aggregator.set(creative.adId || creative.adName, creative);
    }
  }

  for (const c of aggregator.values()) {
    if (c.results > 0) c.cpl = c.spend / c.results;
    creatives.push(c);
  }

  if (creatives.length === 0) {
    return { ok: false, error: "No usable rows found in CSV." };
  }

  return { ok: true, creatives, warnings };
}

type ColumnMap = {
  adName: string;
  adId?: string;
  campaignName?: string;
  adSetName?: string;
  spend?: string;
  results?: string;
  costPerResult?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  ctr?: string;
  cpm?: string;
  delivery?: string;
  quality?: string;
  engagement?: string;
  conversion?: string;
};

function findRequiredColumns(header: string[]): ColumnMap {
  const lower = header.map((h) => h.toLowerCase());
  const find = (...candidates: string[]): string | undefined => {
    for (const c of candidates) {
      const idx = lower.indexOf(c.toLowerCase());
      if (idx !== -1) return header[idx];
    }
    return undefined;
  };

  return {
    adName: find("Ad name", "ad_name") || "",
    adId: find("Ad ID", "ad_id"),
    campaignName: find("Campaign name", "campaign_name"),
    adSetName: find("Ad set name", "ad_set_name"),
    spend: find(
      "Amount spent (USD)",
      "Amount spent (usd)",
      "Amount spent",
      "Spend",
    ),
    results: find("Results"),
    costPerResult: find("Cost per result", "Cost per results"),
    impressions: find("Impressions"),
    reach: find("Reach"),
    frequency: find("Frequency"),
    ctr: find("CTR (link click-through rate)", "CTR (all)", "CTR"),
    cpm: find("CPM (cost per 1,000 impressions)", "CPM"),
    delivery: find("Delivery status", "Ad delivery", "Delivery"),
    quality: find("Quality ranking"),
    engagement: find("Engagement rate ranking"),
    conversion: find("Conversion rate ranking"),
  };
}

function rowToCreative(
  record: Record<string, string>,
  cols: ColumnMap,
): Creative {
  const spend = num(cols.spend ? record[cols.spend] : "0");
  const results = num(cols.results ? record[cols.results] : "0");
  const cpr = cols.costPerResult ? num(record[cols.costPerResult]) : null;
  const cpl = results > 0 ? spend / results : cpr;

  return {
    adName: record[cols.adName].trim(),
    adId: cols.adId ? record[cols.adId]?.trim() || undefined : undefined,
    campaignName: cols.campaignName ? record[cols.campaignName] : undefined,
    adSetName: cols.adSetName ? record[cols.adSetName] : undefined,
    spend,
    results,
    cpl,
    impressions: cols.impressions ? num(record[cols.impressions]) : 0,
    reach: cols.reach ? num(record[cols.reach]) : 0,
    frequency: cols.frequency ? numOrNull(record[cols.frequency]) : null,
    ctr: cols.ctr ? numOrNull(record[cols.ctr]) : null,
    cpm: cols.cpm ? numOrNull(record[cols.cpm]) : null,
    delivery: parseDelivery(cols.delivery ? record[cols.delivery] : ""),
    quality: parseQuality(cols.quality ? record[cols.quality] : ""),
    engagement: parseQuality(cols.engagement ? record[cols.engagement] : ""),
    conversion: parseQuality(cols.conversion ? record[cols.conversion] : ""),
    raw: record,
  };
}

function mergeCreative(a: Creative, b: Creative): void {
  a.spend += b.spend;
  a.results += b.results;
  a.impressions += b.impressions;
  a.reach += b.reach;
}

function num(v: string | undefined): number {
  if (v == null) return 0;
  const cleaned = v.replace(/[$,%\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const cleaned = v.replace(/[$,%\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDelivery(v: string): DeliveryStatus {
  const k = (v || "").toLowerCase().trim();
  if (!k) return "unknown";
  if (k.includes("not_delivering") || k.includes("not delivering"))
    return "inactive";
  if (k.includes("active")) return "active";
  if (k.includes("paused")) return "paused";
  if (k.includes("completed")) return "completed";
  if (k.includes("rejected")) return "rejected";
  if (k.includes("review")) return "in_review";
  if (k.includes("inactive")) return "inactive";
  return "unknown";
}

function parseQuality(v: string): QualityRanking {
  const k = (v || "").toLowerCase().trim();
  if (!k || k === "-" || k === "unavailable") return "unknown";
  if (k.includes("above")) return "above_average";
  if (k.includes("below average (bottom 10")) return "below_average_10";
  if (k.includes("below average (bottom 20")) return "below_average_20";
  if (k.includes("below average (bottom 35")) return "below_average_35";
  if (k.includes("below")) return "below_average_35";
  if (k.includes("average")) return "average";
  return "unknown";
}

function toRecord(header: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < header.length; i++) {
    out[header[i]] = row[i] ?? "";
  }
  return out;
}

export function splitRows(input: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && input[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
