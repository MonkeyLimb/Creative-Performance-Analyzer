import { Creative, TierStatus, Thresholds } from "./types";
import { fmtCurrency, fmtNumber, fmtPct, fmtRoas } from "./format";

export type ReportRow = {
  creative: Creative;
  status: TierStatus;
  rpl: number | null;
  revenue: number | null;
  roas: number | null;
  school: string | null;
  program: string | null;
};

export type ReportSummary = {
  totalSpend: number;
  totalResults: number;
  totalRevenue: number | null;
  blendedCpl: number | null;
  blendedRoas: number | null;
  winners: number;
  watch: number;
  cuts: number;
  cutSpend: number;
  winnerShare: number;
  activeCount: number;
  topPerformer: string | null;
};

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows: ReportRow[]): string {
  const headers = [
    "Ad name",
    "Ad ID",
    "Campaign",
    "Ad set",
    "Tier",
    "Delivery",
    "Spend",
    "Leads",
    "CPL",
    "RPL",
    "Revenue",
    "ROAS",
    "CTR (%)",
    "CPM",
    "Impressions",
    "Reach",
    "Frequency",
    "Quality",
    "Engagement",
    "Conversion",
    "School",
    "Program",
  ];
  const lines: string[] = [headers.map(csvEscape).join(",")];
  for (const r of rows) {
    const c = r.creative;
    lines.push(
      [
        csvEscape(c.adName),
        csvEscape(c.adId),
        csvEscape(c.campaignName),
        csvEscape(c.adSetName),
        csvEscape(r.status),
        csvEscape(c.delivery),
        csvEscape(round(c.spend, 2)),
        csvEscape(c.results),
        csvEscape(round(c.cpl, 2)),
        csvEscape(round(r.rpl, 2)),
        csvEscape(round(r.revenue, 2)),
        csvEscape(round(r.roas, 2)),
        csvEscape(round(c.ctr, 2)),
        csvEscape(round(c.cpm, 2)),
        csvEscape(c.impressions),
        csvEscape(c.reach),
        csvEscape(round(c.frequency, 2)),
        csvEscape(c.quality),
        csvEscape(c.engagement),
        csvEscape(c.conversion),
        csvEscape(r.school),
        csvEscape(r.program),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function round(v: number | null | undefined, places: number): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const m = 10 ** places;
  return Math.round(v * m) / m;
}

export function buildMarkdownReport(
  rows: ReportRow[],
  summary: ReportSummary,
  thresholds: Thresholds,
  generatedAt: Date,
): string {
  const lines: string[] = [];
  lines.push("# Creative Performance Report");
  lines.push("");
  lines.push(`_Generated: ${generatedAt.toISOString()}_`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Creatives analyzed:** ${rows.length}`);
  lines.push(`- **Total spend:** ${fmtCurrency(summary.totalSpend)}`);
  lines.push(`- **Total leads:** ${fmtNumber(summary.totalResults)}`);
  lines.push(`- **Blended CPL:** ${fmtCurrency(summary.blendedCpl)}`);
  if (summary.totalRevenue != null) {
    lines.push(`- **Total revenue:** ${fmtCurrency(summary.totalRevenue)}`);
    lines.push(`- **Blended ROAS:** ${fmtRoas(summary.blendedRoas)}`);
  }
  lines.push(`- **Winners:** ${summary.winners}`);
  lines.push(`- **Watch:** ${summary.watch}`);
  lines.push(
    `- **Cut:** ${summary.cuts} (${fmtCurrency(summary.cutSpend)} wasted)`,
  );
  lines.push(`- **Active now:** ${summary.activeCount}`);
  lines.push(`- **Winner share of leads:** ${summary.winnerShare.toFixed(1)}%`);
  if (summary.topPerformer) {
    lines.push(`- **Top performer:** ${summary.topPerformer}`);
  }
  lines.push("");
  lines.push("## Tier thresholds");
  lines.push("");
  lines.push(`- Winner ROAS ≥ ${thresholds.winnerRoas}×`);
  lines.push(`- Cut ROAS < ${thresholds.cutRoas}×`);
  lines.push(`- Winner CPL ≤ $${thresholds.winnerCpl} (fallback)`);
  lines.push(`- Cut CPL ≥ $${thresholds.cutCpl} (fallback)`);
  lines.push("");

  const winners = rows.filter((r) => r.status === "winner");
  const cuts = rows.filter((r) => r.status === "cut");
  const watch = rows.filter((r) => r.status === "watch");

  if (winners.length) {
    lines.push("## Winners");
    lines.push("");
    lines.push(tierTable(winners));
    lines.push("");
  }
  if (watch.length) {
    lines.push("## Watch");
    lines.push("");
    lines.push(tierTable(watch));
    lines.push("");
  }
  if (cuts.length) {
    lines.push("## Cut list");
    lines.push("");
    lines.push(tierTable(cuts));
    lines.push("");
  }

  return lines.join("\n");
}

function tierTable(rows: ReportRow[]): string {
  const head =
    "| Ad name | School | Spend | Leads | CPL | Revenue | ROAS | CTR |";
  const sep = "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |";
  const sorted = [...rows].sort((a, b) => b.creative.spend - a.creative.spend);
  const body = sorted.map((r) => {
    const c = r.creative;
    const name = mdEscape(c.adName);
    return `| ${name} | ${r.school ?? "—"} | ${fmtCurrency(c.spend)} | ${fmtNumber(c.results)} | ${fmtCurrency(c.cpl)} | ${fmtCurrency(r.revenue)} | ${fmtRoas(r.roas)} | ${fmtPct(c.ctr)} |`;
  });
  return [head, sep, ...body].join("\n");
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function downloadFile(
  filename: string,
  content: string,
  mime: string,
): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function reportFilename(ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `creative-report-${stamp}.${ext}`;
}
