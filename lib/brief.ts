import { ReportRow, ReportSummary } from "./report";
import { TierStatus, Thresholds } from "./types";
import { fmtCurrency, fmtNumber, fmtRoas } from "./format";
import { parseExportFilename } from "./export-filename";

// Briefs are bitesized and creative-first: lead with which ads to act on,
// keep each list ≤ 5 entries, demote aggregate rollups to an appendix.
const HIDDEN_WINNER_MIN_ROAS = 2.0;
const VOLUME_LOSER_MAX_ROAS = 1.0;
const PARETO_TOP_SHARE = 0.2;
const BRIEF_LIST_LIMIT = 5;

// Synthesized colleague-facing brief. Pure functions only — the HTML is
// rendered as a string so it can be downloaded as a single self-contained
// file (no external CSS, no JS, prints to PDF cleanly).

export type SchoolRollup = {
  school: string;
  spend: number;
  leads: number;
  cpl: number | null;
  revenue: number | null;
  roas: number | null;
  winners: number;
  cuts: number;
  creatives: number;
};

export type ProgramRollup = {
  school: string;
  program: string;
  spend: number;
  leads: number;
  cpl: number | null;
  revenue: number | null;
  roas: number | null;
  creatives: number;
};

export type CutCandidate = {
  row: ReportRow;
  wasted: number;
  reason: string;
};

export type ScaleCandidate = {
  row: ReportRow;
  reason: string;
};

export type Tldr = string[];

export function bySchool(rows: ReportRow[]): SchoolRollup[] {
  const map = new Map<string, SchoolRollup>();
  for (const r of rows) {
    const key = r.school ?? "Unmatched";
    const cur =
      map.get(key) ??
      {
        school: key,
        spend: 0,
        leads: 0,
        cpl: null,
        revenue: null,
        roas: null,
        winners: 0,
        cuts: 0,
        creatives: 0,
      };
    cur.spend += r.creative.spend;
    cur.leads += r.creative.results;
    if (r.revenue != null) {
      cur.revenue = (cur.revenue ?? 0) + r.revenue;
    }
    if (r.status === "winner") cur.winners++;
    if (r.status === "cut") cur.cuts++;
    cur.creatives++;
    map.set(key, cur);
  }
  for (const v of map.values()) {
    v.cpl = v.leads > 0 ? v.spend / v.leads : null;
    v.roas = v.revenue != null && v.spend > 0 ? v.revenue / v.spend : null;
  }
  return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
}

export function byProgram(rows: ReportRow[]): ProgramRollup[] {
  const map = new Map<string, ProgramRollup>();
  for (const r of rows) {
    if (!r.school || !r.program) continue;
    const key = `${r.school}::${r.program}`;
    const cur =
      map.get(key) ??
      {
        school: r.school,
        program: r.program,
        spend: 0,
        leads: 0,
        cpl: null,
        revenue: null,
        roas: null,
        creatives: 0,
      };
    cur.spend += r.creative.spend;
    cur.leads += r.creative.results;
    if (r.revenue != null) {
      cur.revenue = (cur.revenue ?? 0) + r.revenue;
    }
    cur.creatives++;
    map.set(key, cur);
  }
  for (const v of map.values()) {
    v.cpl = v.leads > 0 ? v.spend / v.leads : null;
    v.roas = v.revenue != null && v.spend > 0 ? v.revenue / v.spend : null;
  }
  return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
}

export type ParetoSummary = {
  topShare: number; // 0.2 for the top 20%
  topCreatives: number;
  totalCreatives: number;
  topSpendShare: number; // 0..1 — share of total spend
  topLeadsShare: number; // 0..1 — share of total leads
};

// Standard concentration check: what share of spend and leads sit in the
// top X% of creatives by spend? Highlights when budget is over-concentrated.
export function paretoSummary(
  rows: ReportRow[],
  topShare = PARETO_TOP_SHARE,
): ParetoSummary | null {
  if (rows.length === 0) return null;
  const totalSpend = rows.reduce((s, r) => s + r.creative.spend, 0);
  const totalLeads = rows.reduce((s, r) => s + r.creative.results, 0);
  const cutoff = Math.max(1, Math.ceil(rows.length * topShare));
  const sorted = [...rows].sort((a, b) => b.creative.spend - a.creative.spend);
  const top = sorted.slice(0, cutoff);
  const topSpend = top.reduce((s, r) => s + r.creative.spend, 0);
  const topLeads = top.reduce((s, r) => s + r.creative.results, 0);
  return {
    topShare,
    topCreatives: top.length,
    totalCreatives: rows.length,
    topSpendShare: totalSpend > 0 ? topSpend / totalSpend : 0,
    topLeadsShare: totalLeads > 0 ? topLeads / totalLeads : 0,
  };
}

export type HiddenWinner = {
  row: ReportRow;
  reason: string;
};

// High-ROAS creatives that aren't getting much budget. The point is to
// surface things that worked but didn't get scaled. Excludes anything
// already in the top of scaleList by ROAS so the lists don't duplicate.
export function hiddenWinners(
  rows: ReportRow[],
  limit = 5,
): HiddenWinner[] {
  const withRoas = rows.filter(
    (r) => r.roas != null && r.roas >= HIDDEN_WINNER_MIN_ROAS,
  );
  if (withRoas.length === 0) return [];
  const spends = rows.map((r) => r.creative.spend).filter((s) => s > 0);
  const medianSpend = median(spends);
  const candidates = withRoas
    .filter((r) => r.creative.spend < medianSpend)
    .sort((a, b) => (b.roas as number) - (a.roas as number))
    .slice(0, limit);
  return candidates.map((row) => ({
    row,
    reason: `${fmtRoas(row.roas)} ROAS on only ${fmtCurrency(row.creative.spend)} — under-scaled.`,
  }));
}

// Big spenders with sub-1× ROAS — over-scaled, ease the foot off.
// Excludes tier=winner (winners with ROAS<1 shouldn't happen, but defend
// against threshold weirdness) and tier=cut (those are already in cutList).
export function volumeLosers(rows: ReportRow[], limit = 5): HiddenWinner[] {
  const spends = rows.map((r) => r.creative.spend).filter((s) => s > 0);
  if (spends.length === 0) return [];
  const sortedSpends = [...spends].sort((a, b) => a - b);
  const q3 = sortedSpends[Math.floor(sortedSpends.length * 0.75)] ?? 0;
  const candidates = rows
    .filter((r) => r.status !== "cut" && r.creative.spend >= q3)
    .filter((r) => r.roas != null && r.roas < VOLUME_LOSER_MAX_ROAS)
    .sort((a, b) => b.creative.spend - a.creative.spend)
    .slice(0, limit);
  return candidates.map((row) => ({
    row,
    reason: `${fmtCurrency(row.creative.spend)} spent at ${fmtRoas(row.roas)} ROAS — pull back.`,
  }));
}

export function filterRowsBySchool(
  rows: ReportRow[],
  school: string | null,
): ReportRow[] {
  if (!school) return rows;
  return rows.filter((r) => r.school === school);
}

export function availableSchools(rows: ReportRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.school) set.add(r.school);
  }
  return Array.from(set).sort();
}

// Recompute the summary block from a (possibly filtered) row set so a
// per-school brief shows that school's totals, not the whole account's.
export function recomputeSummary(rows: ReportRow[]): ReportSummary {
  const totalSpend = rows.reduce((s, r) => s + r.creative.spend, 0);
  const totalResults = rows.reduce((s, r) => s + r.creative.results, 0);
  let totalRevenue: number | null = null;
  let revAttr = false;
  for (const r of rows) {
    if (r.revenue != null) {
      totalRevenue = (totalRevenue ?? 0) + r.revenue;
      revAttr = true;
    }
  }
  const blendedCpl = totalResults > 0 ? totalSpend / totalResults : null;
  const blendedRoas =
    revAttr && totalSpend > 0 ? (totalRevenue ?? 0) / totalSpend : null;
  const byTier = (t: TierStatus) => rows.filter((r) => r.status === t);
  const winners = byTier("winner");
  const watch = byTier("watch");
  const cuts = byTier("cut");
  const cutSpend = cuts.reduce((s, r) => s + r.creative.spend, 0);
  const winnerLeads = winners.reduce((s, r) => s + r.creative.results, 0);
  const winnerShare = totalResults > 0 ? (winnerLeads / totalResults) * 100 : 0;
  const activeCount = rows.filter(
    (r) => r.creative.delivery === "active",
  ).length;
  const top = winners
    .filter((w) => w.roas != null)
    .sort((a, b) => (b.roas as number) - (a.roas as number))[0];
  return {
    totalSpend,
    totalResults,
    totalRevenue,
    blendedCpl,
    blendedRoas,
    winners: winners.length,
    watch: watch.length,
    cuts: cuts.length,
    cutSpend,
    winnerShare,
    activeCount,
    topPerformer: top?.creative.adName ?? null,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

export function cutList(rows: ReportRow[], limit = 10): CutCandidate[] {
  const cuts = rows
    .filter((r) => r.status === "cut")
    .map<CutCandidate>((r) => ({
      row: r,
      wasted: r.creative.spend,
      reason: cutReason(r),
    }))
    .sort((a, b) => b.wasted - a.wasted);
  return cuts.slice(0, limit);
}

export function scaleList(rows: ReportRow[], limit = 10): ScaleCandidate[] {
  const winners = rows.filter((r) => r.status === "winner");

  // Sort: highest ROAS first (when known), then by lowest CPL.
  const sorted = [...winners].sort((a, b) => {
    const ar = a.roas ?? -Infinity;
    const br = b.roas ?? -Infinity;
    if (ar !== br) return br - ar;
    const ac = a.creative.cpl ?? Infinity;
    const bc = b.creative.cpl ?? Infinity;
    return ac - bc;
  });
  return sorted.slice(0, limit).map((row) => ({ row, reason: scaleReason(row) }));
}

function cutReason(r: ReportRow): string {
  const c = r.creative;
  if (c.results === 0 && c.spend > 0) {
    return `${fmtCurrency(c.spend)} spent · 0 leads.`;
  }
  if (r.roas != null && r.roas < 1) {
    return `${fmtRoas(r.roas)} ROAS on ${fmtCurrency(c.spend)} (revenue below spend).`;
  }
  if (c.cpl != null) {
    return `CPL ${fmtCurrency(c.cpl)} · ${fmtNumber(c.results)} leads on ${fmtCurrency(c.spend)}.`;
  }
  return `${fmtCurrency(c.spend)} spent · cut tier.`;
}

function scaleReason(r: ReportRow): string {
  const c = r.creative;
  const parts: string[] = [];
  if (r.roas != null) parts.push(`${fmtRoas(r.roas)} ROAS`);
  if (c.cpl != null) parts.push(`${fmtCurrency(c.cpl)} CPL`);
  parts.push(`${fmtNumber(c.results)} leads`);
  parts.push(`${fmtCurrency(c.spend)} spend`);
  return parts.join(" · ");
}

export function buildTldr(rows: ReportRow[], summary: ReportSummary): Tldr {
  const lines: Tldr = [];
  const cutCount = summary.cuts;
  const winnerCount = summary.winners;
  const cutSpend = summary.cutSpend;
  const blended = summary.blendedCpl;

  lines.push(
    `Analyzed ${fmtNumber(rows.length)} creatives spending ${fmtCurrency(summary.totalSpend)} for ${fmtNumber(summary.totalResults)} leads ` +
      `at a blended CPL of ${fmtCurrency(blended)}${summary.blendedRoas != null ? ` and ${fmtRoas(summary.blendedRoas)} blended ROAS` : ""}.`,
  );

  if (winnerCount > 0) {
    lines.push(
      `${fmtNumber(winnerCount)} winner${winnerCount === 1 ? "" : "s"} drove ${summary.winnerShare.toFixed(0)}% of leads — these are the ones to scale.`,
    );
  } else {
    lines.push(
      `No creatives currently hit winner thresholds. Review thresholds or expect higher CPL until something breaks through.`,
    );
  }

  if (cutCount > 0) {
    lines.push(
      `${fmtNumber(cutCount)} creative${cutCount === 1 ? " is" : "s are"} wasting ${fmtCurrency(cutSpend)} — kill list below.`,
    );
  }

  const pareto = paretoSummary(rows);
  if (pareto && pareto.totalCreatives >= 5) {
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    lines.push(
      `Top ${pct(pareto.topShare)} of creatives (${fmtNumber(pareto.topCreatives)}) account for ${pct(pareto.topSpendShare)} of spend and ${pct(pareto.topLeadsShare)} of leads.`,
    );
  }

  if (summary.topPerformer) {
    lines.push(`Top performer: "${summary.topPerformer}".`);
  }

  return lines;
}

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function esc(s: string | number | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type BriefOptions = {
  scopeLabel?: string;
  csvFileName?: string;
};

export function buildHtmlBrief(
  rows: ReportRow[],
  summary: ReportSummary,
  thresholds: Thresholds,
  generatedAt: Date,
  options: BriefOptions = {},
): string {
  const tldr = buildTldr(rows, summary);
  const schools = bySchool(rows);
  const programs = byProgram(rows);
  const cuts = cutList(rows, BRIEF_LIST_LIMIT);
  const scales = scaleList(rows, BRIEF_LIST_LIMIT);
  const hidden = hiddenWinners(rows, BRIEF_LIST_LIMIT);
  const losers = volumeLosers(rows, BRIEF_LIST_LIMIT);
  const totalWasted = cuts.reduce((s, c) => s + c.wasted, 0);
  const scope = options.scopeLabel;
  const fileCtx = options.csvFileName
    ? parseExportFilename(options.csvFileName)
    : null;
  const accountPrefix = fileCtx?.accountLabel ? `${fileCtx.accountLabel} · ` : "";
  const dateLine = fileCtx?.rangeLabel
    ? fileCtx.rangeLabel
    : fmtDate(generatedAt);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(accountPrefix)}Creative Performance Brief${scope ? ` — ${esc(scope)}` : ""} — ${esc(dateLine)}</title>
<style>
  :root {
    --ink: #1A1F2A;
    --muted: #5E6776;
    --rule: #E2E5EB;
    --bg: #FFFFFF;
    --soft: #F7F8FA;
    --win: #1D9E75;
    --watch: #EF9F27;
    --cut: #E24B4A;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
    font-size: 14px;
    max-width: 920px;
    margin: 0 auto;
    padding: 32px 28px 60px;
  }
  h1, h2, h3 { margin: 0 0 12px; font-weight: 600; letter-spacing: -0.01em; }
  h1 { font-size: 26px; }
  h2 { font-size: 18px; margin-top: 36px; padding-bottom: 8px; border-bottom: 1px solid var(--rule); }
  h2.appendix { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); border-bottom: none; margin-top: 44px; }
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-top: 24px; }
  .appendix-section { font-size: 12px; }
  .appendix-section table th, .appendix-section table td { padding: 5px 8px; font-size: 12px; }
  p { margin: 6px 0; }
  .meta { color: var(--muted); font-size: 12px; margin-bottom: 24px; }
  .tldr { background: var(--soft); border-left: 3px solid var(--ink); padding: 14px 18px; border-radius: 4px; margin: 18px 0 28px; }
  .tldr p { margin: 4px 0; font-size: 14px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0 6px; }
  .kpi { border: 1px solid var(--rule); border-radius: 6px; padding: 10px 12px; }
  .kpi .l { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .kpi .v { font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; margin-top: 2px; }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 14px; }
  .card { border: 1px solid var(--rule); border-radius: 6px; padding: 14px 16px; }
  .card.scale { border-left: 3px solid var(--win); }
  .card.kill { border-left: 3px solid var(--cut); }
  .card h3 { margin-top: 0; }
  .card ol { margin: 8px 0 0; padding-left: 22px; }
  .card li { margin-bottom: 6px; }
  .card li .name { font-weight: 600; }
  .card li .why { display: block; color: var(--muted); font-size: 12px; }
  .impact { font-size: 12px; color: var(--muted); margin-top: 10px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; font-variant-numeric: tabular-nums; }
  th, td { padding: 7px 10px; border-bottom: 1px solid var(--rule); text-align: left; font-size: 13px; }
  th { font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); background: var(--soft); }
  td.r, th.r { text-align: right; }
  .tag { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .tag.win { background: rgba(29,158,117,0.12); color: var(--win); }
  .tag.cut { background: rgba(226,75,74,0.12); color: var(--cut); }
  .tag.watch { background: rgba(239,159,39,0.15); color: var(--watch); }
  footer { color: var(--muted); font-size: 11px; margin-top: 40px; padding-top: 14px; border-top: 1px solid var(--rule); }
  @media print {
    body { max-width: none; padding: 24px; }
    h2 { page-break-after: avoid; }
    .card, table { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<h1>${esc(accountPrefix)}Creative Performance Brief${scope ? ` <span style="color: var(--muted); font-weight: 500;">· ${esc(scope)}</span>` : ""}</h1>
<div class="meta">${fileCtx?.rangeLabel ? `Reporting period: ${esc(fileCtx.rangeLabel)}` : `Generated ${esc(fmtDate(generatedAt))}`} · ${esc(String(rows.length))} creatives${scope ? ` · scoped to ${esc(scope)}` : ""}${fileCtx?.rawFilename ? ` · source: ${esc(fileCtx.rawFilename)}` : ""}</div>

<div class="tldr">
${tldr.map((line) => `  <p>${esc(line)}</p>`).join("\n")}
</div>

<div class="kpis">
  <div class="kpi"><div class="l">Spend</div><div class="v">${esc(fmtCurrency(summary.totalSpend))}</div></div>
  <div class="kpi"><div class="l">Leads</div><div class="v">${esc(fmtNumber(summary.totalResults))}</div></div>
  <div class="kpi"><div class="l">Blended CPL</div><div class="v">${esc(fmtCurrency(summary.blendedCpl))}</div></div>
  <div class="kpi"><div class="l">Blended ROAS</div><div class="v">${esc(fmtRoas(summary.blendedRoas))}</div></div>
</div>

<h2>Action items</h2>
<div class="cards">
  <div class="card scale">
    <h3>Scale these</h3>
    ${
      scales.length === 0
        ? `<p class="impact">No winners to scale this period.</p>`
        : `<ol>${scales
            .map(
              (s) => `<li>
        <span class="name">${esc(s.row.creative.adName)}</span>
        <span class="why">${esc(s.row.school ?? "—")}${s.row.program ? ` · ${esc(s.row.program)}` : ""} · ${esc(s.reason)}</span>
      </li>`,
            )
            .join("\n        ")}</ol>`
    }
  </div>
  <div class="card kill">
    <h3>Kill these</h3>
    ${
      cuts.length === 0
        ? `<p class="impact">No cut candidates this period.</p>`
        : `<ol>${cuts
            .map(
              (c) => `<li>
        <span class="name">${esc(c.row.creative.adName)}</span>
        <span class="why">${esc(c.row.school ?? "—")}${c.row.program ? ` · ${esc(c.row.program)}` : ""} · ${esc(c.reason)}</span>
      </li>`,
            )
            .join("\n        ")}</ol>
       <p class="impact">Killing the cut list above frees up <strong>${esc(fmtCurrency(totalWasted))}</strong> in budget.</p>`
    }
  </div>
</div>

${
  hidden.length > 0 || losers.length > 0
    ? `<h2>Hidden moves</h2>
<div class="cards">
  <div class="card scale">
    <h3>Hidden winners</h3>
    ${
      hidden.length === 0
        ? `<p class="impact">No under-scaled high-ROAS creatives.</p>`
        : `<ol>${hidden
            .map(
              (h) => `<li>
        <span class="name">${esc(h.row.creative.adName)}</span>
        <span class="why">${esc(h.row.school ?? "—")}${h.row.program ? ` · ${esc(h.row.program)}` : ""} · ${esc(h.reason)}</span>
      </li>`,
            )
            .join("\n        ")}</ol>
       <p class="impact">High ROAS but tiny spend — give these more budget.</p>`
    }
  </div>
  <div class="card kill">
    <h3>Volume losers</h3>
    ${
      losers.length === 0
        ? `<p class="impact">No over-scaled low-ROAS creatives.</p>`
        : `<ol>${losers
            .map(
              (l) => `<li>
        <span class="name">${esc(l.row.creative.adName)}</span>
        <span class="why">${esc(l.row.school ?? "—")}${l.row.program ? ` · ${esc(l.row.program)}` : ""} · ${esc(l.reason)}</span>
      </li>`,
            )
            .join("\n        ")}</ol>
       <p class="impact">High spend but ROAS below 1× — pull back before more budget burns.</p>`
    }
  </div>
</div>
`
    : ""
}

<div class="appendix-section">
<h2 class="appendix">Appendix · rollups</h2>
<h3 style="margin-top: 14px;">By school</h3>
${schoolTable(schools)}
${programs.length > 0 ? `<h3 style="margin-top: 18px;">By program</h3>\n${programTable(programs)}` : ""}
</div>

<footer>
  Tier thresholds — Winner ROAS ≥ ${esc(String(thresholds.winnerRoas))}× · Cut ROAS &lt; ${esc(String(thresholds.cutRoas))}× ·
  Winner CPL ≤ $${esc(String(thresholds.winnerCpl))} (fallback) · Cut CPL ≥ $${esc(String(thresholds.cutCpl))} (fallback).
  Revenue + ROAS use per-program RPL defaults (override in the sidebar).
</footer>

</body>
</html>`;
}

// Slack-/email-ready plaintext version. Uses Slack mrkdwn (*bold*, • bullets)
// which renders nicely when pasted into Slack and still reads as plain text
// in email clients that won't format it.
export function buildSlackBrief(
  rows: ReportRow[],
  summary: ReportSummary,
  generatedAt: Date,
  options: BriefOptions = {},
): string {
  const tldr = buildTldr(rows, summary);
  const cuts = cutList(rows, BRIEF_LIST_LIMIT);
  const scales = scaleList(rows, BRIEF_LIST_LIMIT);
  const hidden = hiddenWinners(rows, 3);
  const losers = volumeLosers(rows, 3);
  const totalWasted = cuts.reduce((s, c) => s + c.wasted, 0);
  const scope = options.scopeLabel;
  const fileCtx = options.csvFileName
    ? parseExportFilename(options.csvFileName)
    : null;
  const accountPrefix = fileCtx?.accountLabel ? `${fileCtx.accountLabel} · ` : "";
  const dateLine = fileCtx?.rangeLabel ?? fmtDate(generatedAt);
  const SEP = "─".repeat(28);

  const out: string[] = [];
  out.push(
    `*${accountPrefix}Creative Performance Brief*${scope ? ` · ${scope}` : ""} — ${dateLine}`,
  );
  out.push("");
  for (const line of tldr) out.push(line);
  out.push("");
  out.push(SEP);

  out.push("");
  out.push("*🟢 Scale these*");
  if (scales.length === 0) {
    out.push("• (no winners this period)");
  } else {
    for (const s of scales) {
      const where = locTag(s.row);
      out.push(`• ${s.row.creative.adName}${where} — ${s.reason}`);
    }
  }

  out.push("");
  out.push(
    cuts.length > 0
      ? `*🔴 Kill these* (frees ${fmtCurrency(totalWasted)})`
      : "*🔴 Kill these*",
  );
  if (cuts.length === 0) {
    out.push("• (no cut candidates)");
  } else {
    for (const c of cuts) {
      const where = locTag(c.row);
      out.push(`• ${c.row.creative.adName}${where} — ${c.reason}`);
    }
  }

  if (hidden.length > 0 || losers.length > 0) {
    out.push("");
    out.push(SEP);
  }
  if (hidden.length > 0) {
    out.push("");
    out.push("*💎 Hidden winners* (scale these up)");
    for (const h of hidden) {
      out.push(`• ${h.row.creative.adName}${locTag(h.row)} — ${h.reason}`);
    }
  }
  if (losers.length > 0) {
    out.push("");
    out.push("*⚠️ Volume losers* (pull back)");
    for (const l of losers) {
      out.push(`• ${l.row.creative.adName}${locTag(l.row)} — ${l.reason}`);
    }
  }

  // Slack briefs intentionally omit per-school rollups — switch Scope in
  // the modal to share a partner-specific view instead.

  return out.join("\n");
}

function locTag(r: ReportRow): string {
  if (!r.school) return "";
  if (r.program) return ` (${r.school} · ${r.program})`;
  return ` (${r.school})`;
}

function schoolTable(rows: SchoolRollup[]): string {
  if (rows.length === 0) return `<p class="impact">No data.</p>`;
  const head = `<tr>
    <th>School</th>
    <th class="r">Creatives</th>
    <th class="r">Spend</th>
    <th class="r">Leads</th>
    <th class="r">CPL</th>
    <th class="r">Revenue</th>
    <th class="r">ROAS</th>
    <th class="r">Winners</th>
    <th class="r">Cuts</th>
  </tr>`;
  const body = rows
    .map(
      (r) => `<tr>
      <td>${esc(r.school)}</td>
      <td class="r">${esc(String(r.creatives))}</td>
      <td class="r">${esc(fmtCurrency(r.spend))}</td>
      <td class="r">${esc(fmtNumber(r.leads))}</td>
      <td class="r">${esc(fmtCurrency(r.cpl))}</td>
      <td class="r">${esc(fmtCurrency(r.revenue))}</td>
      <td class="r">${esc(fmtRoas(r.roas))}</td>
      <td class="r">${esc(String(r.winners))}</td>
      <td class="r">${esc(String(r.cuts))}</td>
    </tr>`,
    )
    .join("\n    ");
  return `<table>\n  <thead>${head}</thead>\n  <tbody>\n    ${body}\n  </tbody>\n</table>`;
}

function programTable(rows: ProgramRollup[]): string {
  if (rows.length === 0) return `<p class="impact">No program-level rollup available.</p>`;
  const head = `<tr>
    <th>School</th>
    <th>Program</th>
    <th class="r">Creatives</th>
    <th class="r">Spend</th>
    <th class="r">Leads</th>
    <th class="r">CPL</th>
    <th class="r">Revenue</th>
    <th class="r">ROAS</th>
  </tr>`;
  const body = rows
    .map(
      (r) => `<tr>
      <td>${esc(r.school)}</td>
      <td>${esc(r.program)}</td>
      <td class="r">${esc(String(r.creatives))}</td>
      <td class="r">${esc(fmtCurrency(r.spend))}</td>
      <td class="r">${esc(fmtNumber(r.leads))}</td>
      <td class="r">${esc(fmtCurrency(r.cpl))}</td>
      <td class="r">${esc(fmtCurrency(r.revenue))}</td>
      <td class="r">${esc(fmtRoas(r.roas))}</td>
    </tr>`,
    )
    .join("\n    ");
  return `<table>\n  <thead>${head}</thead>\n  <tbody>\n    ${body}\n  </tbody>\n</table>`;
}

