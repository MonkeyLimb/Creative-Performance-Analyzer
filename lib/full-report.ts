import { ReportRow } from "./report";
import { DeliveryStatus, QualityRanking } from "./types";
import { fmtCurrency, fmtNumber, fmtPct } from "./format";
import { parseExportFilename } from "./export-filename";

// Bigger-than-brief deliverable: a navigable HTML page with top-10 creative
// lists for active / inactive / best-CPL / remove / retain, plus auto-takeaways.
// Stays creative-first — every section is a list of specific ads, not rollups.

const SECTION_LIMIT = 10;
const BEST_CPL_MIN_SPEND = 50;
const BEST_CPL_MIN_LEADS = 1;
const BEST_CPL_LIMIT = 15;

// Active ads with CPL above this are remove candidates.
const REMOVE_ACTIVE_CPL_CEILING = 30;
// Above this CPL the action is "kill"; in-between is "refresh".
const KILL_CPL_THRESHOLD = 50;
// Active creative is a scale candidate when CPL is at or below this.
const RETAIN_ACTIVE_CPL_CEILING = 15;
// Paused creative is a re-warm candidate when CPL ≤ this AND has ≥ MIN_LEADS.
const RETAIN_PAUSED_CPL_CEILING = 10;
const RETAIN_PAUSED_MIN_LEADS = 10;

export type ActionTag =
  | "kill-no-leads"
  | "kill-high-cpl"
  | "refresh"
  | "scale"
  | "rewarm";

export type RowWithAction = { row: ReportRow; action: ActionTag };

export type FullReportStats = {
  totalSpend: number;
  totalLeads: number;
  blendedCpl: number | null;
  activeCount: number;
  pausedCount: number;
  zeroLeadWaste: number;
};

export function fullReportStats(rows: ReportRow[]): FullReportStats {
  let totalSpend = 0;
  let totalLeads = 0;
  let activeCount = 0;
  let pausedCount = 0;
  let zeroLeadWaste = 0;
  for (const r of rows) {
    totalSpend += r.creative.spend;
    totalLeads += r.creative.results;
    if (r.creative.delivery === "active") activeCount++;
    else pausedCount++;
    if (r.creative.results === 0 && r.creative.spend > 0) {
      zeroLeadWaste += r.creative.spend;
    }
  }
  return {
    totalSpend,
    totalLeads,
    blendedCpl: totalLeads > 0 ? totalSpend / totalLeads : null,
    activeCount,
    pausedCount,
    zeroLeadWaste,
  };
}

function isActive(d: DeliveryStatus): boolean {
  return d === "active";
}

export function topByLeads(
  rows: ReportRow[],
  mode: "active" | "paused",
  limit = SECTION_LIMIT,
): ReportRow[] {
  const filtered = rows.filter((r) =>
    mode === "active" ? isActive(r.creative.delivery) : !isActive(r.creative.delivery),
  );
  return [...filtered]
    .sort((a, b) => b.creative.results - a.creative.results)
    .slice(0, limit);
}

export function bestByCpl(
  rows: ReportRow[],
  opts: { minSpend?: number; minLeads?: number; limit?: number } = {},
): ReportRow[] {
  const minSpend = opts.minSpend ?? BEST_CPL_MIN_SPEND;
  const minLeads = opts.minLeads ?? BEST_CPL_MIN_LEADS;
  const limit = opts.limit ?? BEST_CPL_LIMIT;
  return rows
    .filter(
      (r) =>
        r.creative.spend >= minSpend &&
        r.creative.results >= minLeads &&
        r.creative.cpl != null,
    )
    .sort(
      (a, b) => (a.creative.cpl as number) - (b.creative.cpl as number),
    )
    .slice(0, limit);
}

export function removeCandidates(rows: ReportRow[]): RowWithAction[] {
  const list: RowWithAction[] = [];
  for (const r of rows) {
    if (!isActive(r.creative.delivery)) continue;
    const c = r.creative;
    if (c.results === 0 && c.spend > 0) {
      list.push({ row: r, action: "kill-no-leads" });
    } else if (c.cpl != null && c.cpl > REMOVE_ACTIVE_CPL_CEILING) {
      list.push({
        row: r,
        action: c.cpl > KILL_CPL_THRESHOLD ? "kill-high-cpl" : "refresh",
      });
    }
  }
  return list.sort((a, b) => b.row.creative.spend - a.row.creative.spend);
}

export function retainCandidates(rows: ReportRow[]): RowWithAction[] {
  const list: RowWithAction[] = [];
  for (const r of rows) {
    const c = r.creative;
    if (isActive(c.delivery)) {
      if (c.cpl != null && c.cpl <= RETAIN_ACTIVE_CPL_CEILING) {
        list.push({ row: r, action: "scale" });
      }
    } else {
      if (
        c.cpl != null &&
        c.cpl <= RETAIN_PAUSED_CPL_CEILING &&
        c.results >= RETAIN_PAUSED_MIN_LEADS
      ) {
        list.push({ row: r, action: "rewarm" });
      }
    }
  }
  return list.sort(
    (a, b) =>
      (a.row.creative.cpl ?? Infinity) - (b.row.creative.cpl ?? Infinity),
  );
}

// Heuristic takeaways. We err on the side of fewer-but-confident: each rule
// only fires when its data threshold is met.
export function buildTakeaways(rows: ReportRow[]): string[] {
  const out: string[] = [];

  // 1. Outlier: top single ad by leads with notably low CPL
  const byLeads = [...rows]
    .filter((r) => r.creative.cpl != null && r.creative.results >= 50)
    .sort((a, b) => b.creative.results - a.creative.results);
  if (byLeads.length > 0) {
    const top = byLeads[0];
    if ((top.creative.cpl as number) < 10) {
      out.push(
        `<strong>${escapeHtml(top.creative.adName)} is the clear outlier</strong> — ${fmtCurrency(top.creative.cpl)} CPL on ${fmtNumber(top.creative.results)} leads. Worth cloning the format.`,
      );
    }
  }

  // 2. Efficient cluster: school whose creatives are mostly under $12 CPL
  const bySchoolMap = new Map<string, ReportRow[]>();
  for (const r of rows) {
    const s = r.school;
    if (!s) continue;
    const arr = bySchoolMap.get(s) ?? [];
    arr.push(r);
    bySchoolMap.set(s, arr);
  }
  const efficient: { school: string; share: number; count: number }[] = [];
  for (const [school, items] of bySchoolMap) {
    if (items.length < 3) continue;
    const withCpl = items.filter((r) => r.creative.cpl != null);
    if (withCpl.length < 3) continue;
    const under = withCpl.filter((r) => (r.creative.cpl as number) <= 12);
    const share = under.length / withCpl.length;
    if (share >= 0.7) {
      efficient.push({ school, share, count: under.length });
    }
  }
  efficient.sort((a, b) => b.share - a.share);
  if (efficient.length > 0) {
    const e = efficient[0];
    out.push(
      `<strong>${escapeHtml(e.school)} owns the efficient end</strong> — ${e.count} of ${bySchoolMap.get(e.school)?.length ?? 0} creatives under $12 CPL. Many are paused — worth re-warming.`,
    );
  }

  // 3. Bleeding cluster: school with biggest active spend at CPL > $30
  const bleedBySchool = new Map<string, number>();
  for (const r of rows) {
    if (!r.school) continue;
    if (!isActive(r.creative.delivery)) continue;
    const cpl = r.creative.cpl;
    if ((cpl != null && cpl > REMOVE_ACTIVE_CPL_CEILING) ||
        (r.creative.results === 0 && r.creative.spend > 0)) {
      bleedBySchool.set(
        r.school,
        (bleedBySchool.get(r.school) ?? 0) + r.creative.spend,
      );
    }
  }
  const bleedList = [...bleedBySchool.entries()].sort((a, b) => b[1] - a[1]);
  if (bleedList.length > 0 && bleedList[0][1] >= 500) {
    const [school, spend] = bleedList[0];
    out.push(
      `<strong>${escapeHtml(school)} is bleeding</strong> — ${fmtCurrency(spend)} in active high-CPL or zero-lead spend. Pause or refresh the worst offenders.`,
    );
  }

  // 4. Hot but mediocre: schools with active spend at $20–$30 CPL
  const hotBySchool = new Map<string, { spend: number; count: number }>();
  for (const r of rows) {
    if (!r.school) continue;
    if (!isActive(r.creative.delivery)) continue;
    const cpl = r.creative.cpl;
    if (cpl != null && cpl >= 20 && cpl <= REMOVE_ACTIVE_CPL_CEILING) {
      const cur = hotBySchool.get(r.school) ?? { spend: 0, count: 0 };
      cur.spend += r.creative.spend;
      cur.count++;
      hotBySchool.set(r.school, cur);
    }
  }
  const hot = [...hotBySchool.entries()]
    .filter(([, v]) => v.spend >= 300)
    .sort((a, b) => b[1].spend - a[1].spend);
  if (hot.length > 0) {
    const schoolNames = hot.slice(0, 2).map(([s]) => escapeHtml(s)).join(" and ");
    out.push(
      `<strong>${schoolNames} running hot</strong> — actively spending at the $20–$30 CPL band. Refresh creative before the next budget cycle.`,
    );
  }

  return out;
}

function escapeHtml(s: string | number | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function deliveryLabel(d: DeliveryStatus): { dot: string; text: string } {
  if (d === "active") return { dot: "active", text: "Active" };
  if (d === "inactive") return { dot: "inactive", text: "Inactive" };
  return { dot: "off", text: "Paused / off" };
}

function qualityLabel(q: QualityRanking): string {
  if (q === "above_average") return "Above average";
  if (q === "average") return "Average";
  if (
    q === "below_average_10" ||
    q === "below_average_20" ||
    q === "below_average_35"
  ) {
    return "Below average";
  }
  return "—";
}

function qualityClass(q: QualityRanking): string {
  if (q === "above_average") return "ranking above";
  if (q === "average") return "ranking avg";
  if (q.startsWith("below_average")) return "ranking below";
  return "ranking";
}

function cplClass(cpl: number | null): string {
  if (cpl == null) return "";
  if (cpl <= 12) return "cpl-good";
  if (cpl <= 25) return "cpl-ok";
  return "cpl-bad";
}

function actionTagHtml(action: ActionTag): string {
  const labels: Record<ActionTag, { cls: string; text: string }> = {
    "kill-no-leads": { cls: "kill", text: "Kill — no leads" },
    "kill-high-cpl": { cls: "kill", text: "Kill — CPL too high" },
    refresh: { cls: "kill", text: "Refresh creative" },
    scale: { cls: "scale", text: "Scale" },
    rewarm: { cls: "rewarm", text: "Re-warm / raise cap" },
  };
  const { cls, text } = labels[action];
  return `<span class="action-tag ${cls}">${text}</span>`;
}

function rowHtml(r: ReportRow, opts: { action?: ActionTag } = {}): string {
  const s = deliveryLabel(r.creative.delivery);
  const c = r.creative;
  return `<tr>
    <td><span class="status"><span class="dot ${s.dot}"></span>${s.text}</span></td>
    <td><div class="ad-name" title="${escapeHtml(c.adName)}">${escapeHtml(c.adName)}</div></td>
    <td><div class="campaign" title="${escapeHtml(c.campaignName ?? "")}">${escapeHtml(c.campaignName ?? "—")}</div></td>
    <td class="num">${c.results > 0 ? fmtNumber(c.results) : "—"}</td>
    <td class="num ${cplClass(c.cpl)}">${c.cpl != null ? fmtCurrency(c.cpl) : "—"}</td>
    <td class="num">${fmtCurrency(c.spend)}</td>
    <td class="num">${fmtPct(c.ctr)}</td>
    <td class="num">${fmtNumber(c.impressions)}</td>
    <td><span class="${qualityClass(c.quality)}">${qualityLabel(c.quality)}</span></td>
    ${opts.action ? `<td>${actionTagHtml(opts.action)}</td>` : ""}
  </tr>`;
}

function table(rows: ReportRow[], opts: { actionFor?: (r: ReportRow) => ActionTag } = {}): string {
  const actionHeader = opts.actionFor ? "<th>Action</th>" : "";
  const head = `<thead><tr>
    <th>Status</th><th>Ad Name</th><th>Campaign</th>
    <th class="num">Leads</th><th class="num">CPL</th><th class="num">Spend</th>
    <th class="num">CTR</th><th class="num">Impressions</th><th>Quality</th>${actionHeader}
  </tr></thead>`;
  const body = rows
    .map((r) =>
      rowHtml(r, opts.actionFor ? { action: opts.actionFor(r) } : {}),
    )
    .join("");
  return `<table>${head}<tbody>${body}</tbody></table>`;
}

function tableWithAction(rows: RowWithAction[]): string {
  const head = `<thead><tr>
    <th>Status</th><th>Ad Name</th><th>Campaign</th>
    <th class="num">Leads</th><th class="num">CPL</th><th class="num">Spend</th>
    <th class="num">CTR</th><th class="num">Impressions</th><th>Quality</th><th>Action</th>
  </tr></thead>`;
  const body = rows.map((x) => rowHtml(x.row, { action: x.action })).join("");
  return `<table>${head}<tbody>${body}</tbody></table>`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export type FullReportOptions = {
  title?: string;
  reportingPeriod?: string;
  scopeLabel?: string;
  csvFileName?: string;
};

export function buildHtmlFullReport(
  rows: ReportRow[],
  generatedAt: Date,
  options: FullReportOptions = {},
): string {
  const stats = fullReportStats(rows);
  const active = topByLeads(rows, "active");
  const paused = topByLeads(rows, "paused");
  const best = bestByCpl(rows);
  const remove = removeCandidates(rows);
  const retain = retainCandidates(rows);
  const takeaways = buildTakeaways(rows);
  const ctx = options.csvFileName
    ? parseExportFilename(options.csvFileName)
    : null;

  // Title prefers an explicit override, then the account label sniffed from
  // the uploaded CSV filename, then a generic fallback.
  const baseTitle = "Creative Performance Report";
  const title =
    options.title ??
    (ctx?.accountLabel ? `${ctx.accountLabel} — ${baseTitle}` : baseTitle);

  // Subtitle prefers explicit override, then parsed date range, then date stamp.
  let subtitle: string;
  if (options.reportingPeriod) {
    subtitle = options.reportingPeriod;
  } else if (ctx?.rangeLabel) {
    subtitle = `Reporting period: ${ctx.rangeLabel}${options.scopeLabel ? ` · ${options.scopeLabel}` : ""}`;
  } else {
    subtitle = `Generated ${fmtDate(generatedAt)}${options.scopeLabel ? ` · ${options.scopeLabel}` : ""}`;
  }

  const footerSource = ctx?.rawFilename
    ? `Generated from Meta Ads Manager export · ${escapeHtml(ctx.rawFilename)}`
    : `Generated by Creative Performance Analyzer · ${escapeHtml(fmtDate(generatedAt))}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} — ${escapeHtml(subtitle)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 0;
    background: #f0f2f5;
    color: #1c1e21;
    font-size: 13px;
  }
  .header { background: #fff; border-bottom: 1px solid #dadde1; padding: 16px 24px; }
  .header h1 { margin: 0 0 4px 0; font-size: 18px; font-weight: 600; }
  .header .sub { color: #65676b; font-size: 12px; }
  .stats { display: flex; gap: 24px; padding: 12px 24px; background: #fff; border-bottom: 1px solid #dadde1; flex-wrap: wrap; }
  .stat { display: flex; flex-direction: column; }
  .stat .label { color: #65676b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
  .stat .value { font-size: 18px; font-weight: 600; color: #1c1e21; font-variant-numeric: tabular-nums; }
  .section { background: #fff; margin: 16px; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
  .section-header { padding: 14px 20px; border-bottom: 1px solid #dadde1; display: flex; align-items: center; justify-content: space-between; }
  .section-title { font-size: 15px; font-weight: 600; color: #1c1e21; display: flex; align-items: center; gap: 10px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .badge.green { background: #e3f2e3; color: #1c7430; }
  .badge.red { background: #fde4e7; color: #b3001b; }
  .badge.blue { background: #e7f0fb; color: #1877f2; }
  .badge.gray { background: #f0f2f5; color: #65676b; }
  .section-note { color: #65676b; font-size: 12px; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #f7f8fa; color: #65676b; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; padding: 10px 12px; border-bottom: 1px solid #dadde1; white-space: nowrap; }
  td { padding: 10px 12px; border-bottom: 1px solid #e4e6eb; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover { background: #f7f8fa; }
  .ad-name { font-weight: 500; color: #1c1e21; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .campaign { color: #65676b; font-size: 11px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .dot.active { background: #31a24c; }
  .dot.off { background: #bcc0c4; }
  .dot.inactive { background: #f7b928; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .cpl-good { color: #31a24c; font-weight: 600; }
  .cpl-ok { color: #1c1e21; }
  .cpl-bad { color: #e41e3f; font-weight: 600; }
  .ranking { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #f0f2f5; color: #65676b; }
  .ranking.above { background: #e3f2e3; color: #1c7430; }
  .ranking.below { background: #fde4e7; color: #b3001b; }
  .ranking.avg { background: #fff4d9; color: #8a5a00; }
  .action-tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .action-tag.kill { background: #fde4e7; color: #b3001b; }
  .action-tag.scale { background: #e3f2e3; color: #1c7430; }
  .action-tag.rewarm { background: #e7f0fb; color: #1877f2; }
  .footer { padding: 16px 24px; color: #65676b; font-size: 11px; text-align: center; }
  .nav { background: #fff; padding: 10px 24px; border-bottom: 1px solid #dadde1; display: flex; gap: 16px; overflow-x: auto; position: sticky; top: 0; z-index: 10; }
  .nav a { color: #1877f2; text-decoration: none; font-size: 13px; font-weight: 500; white-space: nowrap; }
  .nav a:hover { text-decoration: underline; }
  .takeaway-list { padding: 16px 20px; margin: 0; font-size: 13px; line-height: 1.6; }
  .takeaway-list li { margin-bottom: 8px; }
  .empty { padding: 16px 20px; color: #65676b; font-size: 12px; font-style: italic; }
  @media print {
    body { background: #fff; }
    .section { box-shadow: none; margin: 8px 0; border: 1px solid #dadde1; }
    .nav { display: none; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="sub">${escapeHtml(subtitle)}</div>
</div>

<div class="stats">
  <div class="stat"><span class="label">Spend</span><span class="value">${escapeHtml(fmtCurrency(stats.totalSpend))}</span></div>
  <div class="stat"><span class="label">Leads</span><span class="value">${escapeHtml(fmtNumber(stats.totalLeads))}</span></div>
  <div class="stat"><span class="label">Blended CPL</span><span class="value">${escapeHtml(fmtCurrency(stats.blendedCpl))}</span></div>
  <div class="stat"><span class="label">Active ads</span><span class="value">${escapeHtml(fmtNumber(stats.activeCount))}</span></div>
  <div class="stat"><span class="label">Paused / off</span><span class="value">${escapeHtml(fmtNumber(stats.pausedCount))}</span></div>
  <div class="stat"><span class="label">Zero-lead waste</span><span class="value">${escapeHtml(fmtCurrency(stats.zeroLeadWaste))}</span></div>
</div>

<div class="nav">
  <a href="#active">Active top ${SECTION_LIMIT}</a>
  <a href="#inactive">Inactive top ${SECTION_LIMIT}</a>
  <a href="#bestcpl">Best by CPL</a>
  <a href="#remove">What to remove</a>
  <a href="#retain">What to retain / scale</a>
  ${takeaways.length > 0 ? `<a href="#takeaways">Takeaways</a>` : ""}
</div>

<div class="section" id="active">
  <div class="section-header">
    <div class="section-title">Active — Top ${SECTION_LIMIT} by Lead Volume <span class="badge green">Live</span></div>
    <div class="section-note">Currently spending</div>
  </div>
  <div class="table-wrap">${active.length === 0 ? `<div class="empty">No active creatives.</div>` : table(active)}</div>
</div>

<div class="section" id="inactive">
  <div class="section-header">
    <div class="section-title">Inactive — Top ${SECTION_LIMIT} by Lead Volume <span class="badge gray">Paused / off</span></div>
    <div class="section-note">Hit caps or turned off — proven creatives worth revisiting</div>
  </div>
  <div class="table-wrap">${paused.length === 0 ? `<div class="empty">No paused creatives.</div>` : table(paused)}</div>
</div>

<div class="section" id="bestcpl">
  <div class="section-header">
    <div class="section-title">Best Ads by CPL <span class="badge blue">All statuses · min ${fmtCurrency(BEST_CPL_MIN_SPEND)} spend + ${BEST_CPL_MIN_LEADS} lead</span></div>
    <div class="section-note">Most efficient creatives in the account</div>
  </div>
  <div class="table-wrap">${best.length === 0 ? `<div class="empty">No creatives meet the spend + lead floor.</div>` : table(best)}</div>
</div>

<div class="section" id="remove">
  <div class="section-header">
    <div class="section-title">What to Remove <span class="badge red">Action: kill or pause</span></div>
    <div class="section-note">Active ads with CPL &gt; ${fmtCurrency(REMOVE_ACTIVE_CPL_CEILING)}, or spending with zero leads</div>
  </div>
  <div class="table-wrap">${remove.length === 0 ? `<div class="empty">No active ads flagged for removal.</div>` : tableWithAction(remove.slice(0, SECTION_LIMIT))}</div>
</div>

<div class="section" id="retain">
  <div class="section-header">
    <div class="section-title">What to Retain / Scale <span class="badge green">Action: keep, scale, or re-warm</span></div>
    <div class="section-note">Active winners (CPL ≤ ${fmtCurrency(RETAIN_ACTIVE_CPL_CEILING)}) and paused proven creatives (CPL ≤ ${fmtCurrency(RETAIN_PAUSED_CPL_CEILING)}, ${RETAIN_PAUSED_MIN_LEADS}+ leads)</div>
  </div>
  <div class="table-wrap">${retain.length === 0 ? `<div class="empty">No retain / scale candidates.</div>` : tableWithAction(retain.slice(0, SECTION_LIMIT))}</div>
</div>

${
  takeaways.length > 0
    ? `<div class="section" id="takeaways">
  <div class="section-header"><div class="section-title">Takeaways</div></div>
  <ul class="takeaway-list">
    ${takeaways.map((t) => `<li>${t}</li>`).join("\n    ")}
  </ul>
</div>`
    : ""
}

<div class="footer">${footerSource}</div>

</body>
</html>`;
}
