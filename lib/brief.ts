import { ReportRow, ReportSummary } from "./report";
import { Thresholds } from "./types";
import { fmtCurrency, fmtNumber, fmtRoas } from "./format";

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

export function buildHtmlBrief(
  rows: ReportRow[],
  summary: ReportSummary,
  thresholds: Thresholds,
  generatedAt: Date,
): string {
  const tldr = buildTldr(rows, summary);
  const schools = bySchool(rows);
  const programs = byProgram(rows);
  const cuts = cutList(rows);
  const scales = scaleList(rows);
  const totalWasted = cuts.reduce((s, c) => s + c.wasted, 0);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Creative Performance Brief — ${esc(fmtDate(generatedAt))}</title>
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
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-top: 24px; }
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

<h1>Creative Performance Brief</h1>
<div class="meta">Generated ${esc(fmtDate(generatedAt))} · ${esc(String(rows.length))} creatives</div>

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

<h2>By school</h2>
${schoolTable(schools)}

${programs.length > 0 ? `<h2>By program</h2>\n${programTable(programs)}` : ""}

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
): string {
  const tldr = buildTldr(rows, summary);
  const schools = bySchool(rows);
  const cuts = cutList(rows, 5);
  const scales = scaleList(rows, 5);
  const totalWasted = cuts.reduce((s, c) => s + c.wasted, 0);
  const SEP = "─".repeat(28);

  const out: string[] = [];
  out.push(`*Creative Performance Brief* — ${fmtDate(generatedAt)}`);
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

  out.push("");
  out.push(SEP);
  out.push("");
  out.push("*By school*");
  if (schools.length === 0) {
    out.push("(no data)");
  } else {
    for (const s of schools) {
      const parts = [
        s.school,
        fmtCurrency(s.spend),
        `${fmtNumber(s.leads)} leads`,
        `${fmtCurrency(s.cpl)} CPL`,
      ];
      if (s.roas != null) parts.push(`${fmtRoas(s.roas)} ROAS`);
      parts.push(`${s.winners}W/${s.cuts}C`);
      out.push(`• ${parts.join(" · ")}`);
    }
  }

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

