import { describe, expect, it } from "vitest";
import {
  bestByCpl,
  buildHtmlFullReport,
  buildTakeaways,
  fullReportStats,
  removeCandidates,
  retainCandidates,
  topByLeads,
} from "./full-report";
import { ReportRow } from "./report";
import { Creative, TierStatus } from "./types";

function fakeCreative(over: Partial<Creative> = {}): Creative {
  return {
    adName: "Ad",
    spend: 0,
    results: 0,
    cpl: null,
    impressions: 0,
    reach: 0,
    frequency: null,
    ctr: null,
    cpm: null,
    delivery: "active",
    quality: "unknown",
    engagement: "unknown",
    conversion: "unknown",
    raw: {},
    ...over,
  };
}

function fakeRow(
  over: Omit<Partial<ReportRow>, "creative"> & {
    creative?: Partial<Creative>;
  } = {},
): ReportRow {
  const status: TierStatus = over.status ?? "watch";
  return {
    creative: fakeCreative(over.creative),
    status,
    rpl: over.rpl ?? null,
    revenue: over.revenue ?? null,
    roas: over.roas ?? null,
    school: over.school ?? null,
    program: over.program ?? null,
  };
}

describe("fullReportStats", () => {
  it("rolls up spend / leads / active+paused counts / zero-lead waste", () => {
    const rows: ReportRow[] = [
      fakeRow({ creative: { spend: 100, results: 5, delivery: "active" } }),
      fakeRow({ creative: { spend: 200, results: 0, delivery: "active" } }),
      fakeRow({ creative: { spend: 50, results: 2, delivery: "paused" } }),
      fakeRow({ creative: { spend: 0, results: 0, delivery: "off" as never } }),
    ];
    const s = fullReportStats(rows);
    expect(s.totalSpend).toBe(350);
    expect(s.totalLeads).toBe(7);
    expect(s.blendedCpl).toBeCloseTo(350 / 7);
    expect(s.activeCount).toBe(2);
    expect(s.pausedCount).toBe(2);
    expect(s.zeroLeadWaste).toBe(200);
  });

  it("returns null blendedCpl when there are no leads", () => {
    const rows: ReportRow[] = [
      fakeRow({ creative: { spend: 100, results: 0, delivery: "active" } }),
    ];
    expect(fullReportStats(rows).blendedCpl).toBeNull();
  });
});

describe("topByLeads", () => {
  it("sorts active rows by leads desc and caps at limit", () => {
    const rows: ReportRow[] = [
      fakeRow({ creative: { adName: "a", results: 10, delivery: "active" } }),
      fakeRow({ creative: { adName: "b", results: 50, delivery: "active" } }),
      fakeRow({ creative: { adName: "c", results: 30, delivery: "active" } }),
      fakeRow({ creative: { adName: "paused", results: 100, delivery: "paused" } }),
    ];
    const top = topByLeads(rows, "active");
    expect(top.map((r) => r.creative.adName)).toEqual(["b", "c", "a"]);
  });

  it("paused mode excludes active rows", () => {
    const rows: ReportRow[] = [
      fakeRow({ creative: { adName: "active", results: 100, delivery: "active" } }),
      fakeRow({ creative: { adName: "p1", results: 30, delivery: "paused" } }),
      fakeRow({ creative: { adName: "p2", results: 50, delivery: "inactive" } }),
    ];
    const paused = topByLeads(rows, "paused");
    expect(paused.map((r) => r.creative.adName)).toEqual(["p2", "p1"]);
  });
});

describe("bestByCpl", () => {
  it("filters by min spend + leads, sorts CPL asc", () => {
    const rows: ReportRow[] = [
      fakeRow({ creative: { adName: "great", spend: 200, results: 50, cpl: 4 } }),
      fakeRow({ creative: { adName: "ok", spend: 100, results: 10, cpl: 10 } }),
      fakeRow({ creative: { adName: "too-small", spend: 20, results: 1, cpl: 20 } }),
      fakeRow({ creative: { adName: "no-leads", spend: 200, results: 0, cpl: null } }),
    ];
    const best = bestByCpl(rows);
    expect(best.map((r) => r.creative.adName)).toEqual(["great", "ok"]);
  });

  it("honors limit", () => {
    const rows: ReportRow[] = Array.from({ length: 20 }, (_, i) =>
      fakeRow({
        creative: { adName: `ad-${i}`, spend: 100, results: 5, cpl: 20 - i * 0.5 },
      }),
    );
    expect(bestByCpl(rows, { limit: 3 })).toHaveLength(3);
  });
});

describe("removeCandidates", () => {
  it("flags active zero-lead ads and high-CPL active ads with the right action", () => {
    const rows: ReportRow[] = [
      fakeRow({
        creative: { adName: "no-leads", spend: 200, results: 0, delivery: "active" },
      }),
      fakeRow({
        creative: { adName: "very-high", spend: 300, results: 4, cpl: 75, delivery: "active" },
      }),
      fakeRow({
        creative: { adName: "moderate", spend: 200, results: 5, cpl: 40, delivery: "active" },
      }),
      fakeRow({
        creative: { adName: "fine", spend: 100, results: 10, cpl: 10, delivery: "active" },
      }),
      fakeRow({
        creative: { adName: "paused-skip", spend: 200, results: 0, delivery: "paused" },
      }),
    ];
    const removes = removeCandidates(rows);
    const actions = new Map(removes.map((r) => [r.row.creative.adName, r.action]));
    expect(actions.get("no-leads")).toBe("kill-no-leads");
    expect(actions.get("very-high")).toBe("kill-high-cpl");
    expect(actions.get("moderate")).toBe("refresh");
    expect(actions.has("fine")).toBe(false);
    expect(actions.has("paused-skip")).toBe(false);
  });

  it("sorts by spend desc", () => {
    const rows: ReportRow[] = [
      fakeRow({ creative: { adName: "small", spend: 50, results: 0, delivery: "active" } }),
      fakeRow({ creative: { adName: "big", spend: 500, results: 0, delivery: "active" } }),
    ];
    expect(removeCandidates(rows).map((r) => r.row.creative.adName)).toEqual([
      "big",
      "small",
    ]);
  });
});

describe("retainCandidates", () => {
  it("scale=active with low CPL, rewarm=paused with proven leads", () => {
    const rows: ReportRow[] = [
      fakeRow({
        creative: { adName: "scale-me", spend: 100, results: 10, cpl: 10, delivery: "active" },
      }),
      fakeRow({
        creative: { adName: "active-but-meh", spend: 100, results: 5, cpl: 20, delivery: "active" },
      }),
      fakeRow({
        creative: { adName: "rewarm-me", spend: 100, results: 15, cpl: 6.67, delivery: "paused" },
      }),
      fakeRow({
        creative: { adName: "paused-low-leads", spend: 30, results: 4, cpl: 7.5, delivery: "paused" },
      }),
    ];
    const list = retainCandidates(rows);
    const actions = new Map(list.map((r) => [r.row.creative.adName, r.action]));
    expect(actions.get("scale-me")).toBe("scale");
    expect(actions.get("rewarm-me")).toBe("rewarm");
    expect(actions.has("active-but-meh")).toBe(false);
    expect(actions.has("paused-low-leads")).toBe(false);
  });
});

describe("buildTakeaways", () => {
  it("calls out an outlier when one ad dominates leads at very low CPL", () => {
    const rows: ReportRow[] = [
      fakeRow({
        creative: { adName: "BlowOut", spend: 500, results: 200, cpl: 2.5, delivery: "active" },
      }),
      ...Array.from({ length: 10 }, (_, i) =>
        fakeRow({
          creative: { adName: `n${i}`, spend: 200, results: 10, cpl: 20 },
        }),
      ),
    ];
    const t = buildTakeaways(rows);
    expect(t.some((l) => /BlowOut/.test(l))).toBe(true);
    expect(t.some((l) => /clear outlier/.test(l))).toBe(true);
  });

  it("names an efficient cluster when a school is mostly under $12 CPL", () => {
    const rows: ReportRow[] = [
      ...Array.from({ length: 5 }, (_, i) =>
        fakeRow({
          school: "MedCerts",
          creative: { adName: `mc-${i}`, spend: 100, results: 15, cpl: 6 + i * 0.5 },
        }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        fakeRow({
          school: "UMA",
          creative: { adName: `uma-${i}`, spend: 200, results: 5, cpl: 40 },
        }),
      ),
    ];
    const t = buildTakeaways(rows);
    expect(t.some((l) => /MedCerts/.test(l) && /efficient/.test(l))).toBe(true);
  });

  it("flags a bleeding cluster with concentrated zero-lead / high-CPL active spend", () => {
    const rows: ReportRow[] = [
      ...Array.from({ length: 3 }, (_, i) =>
        fakeRow({
          school: "FSU",
          creative: { adName: `fsu-${i}`, spend: 400, results: 0, delivery: "active" },
        }),
      ),
    ];
    const t = buildTakeaways(rows);
    expect(t.some((l) => /FSU/.test(l) && /bleeding/.test(l))).toBe(true);
  });

  it("returns no takeaways when the data is too thin to be confident", () => {
    const rows: ReportRow[] = [
      fakeRow({ creative: { adName: "single", spend: 50, results: 2, cpl: 25 } }),
    ];
    expect(buildTakeaways(rows)).toEqual([]);
  });
});

describe("buildHtmlFullReport", () => {
  it("returns a self-contained HTML document with all five sections", () => {
    const rows: ReportRow[] = [
      fakeRow({
        creative: {
          adName: "ActiveWinner",
          spend: 800,
          results: 80,
          cpl: 10,
          ctr: 1.5,
          impressions: 50000,
          delivery: "active",
          quality: "above_average",
        },
      }),
      fakeRow({
        creative: {
          adName: "PausedProven",
          spend: 300,
          results: 30,
          cpl: 10,
          delivery: "paused",
          quality: "above_average",
        },
      }),
      fakeRow({
        creative: {
          adName: "Burner",
          spend: 400,
          results: 0,
          delivery: "active",
        },
      }),
    ];
    const html = buildHtmlFullReport(rows, new Date("2026-05-17T10:00:00Z"));
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Creative Performance Report");
    expect(html).toContain("Active — Top 10");
    expect(html).toContain("Inactive — Top 10");
    expect(html).toContain("Best Ads by CPL");
    expect(html).toContain("What to Remove");
    expect(html).toContain("What to Retain / Scale");
    expect(html).toContain("ActiveWinner");
    expect(html).toContain("PausedProven");
    expect(html).toContain("Burner");
    // Action tags should render
    expect(html).toContain("Kill — no leads");
    expect(html).toContain("Scale");
    expect(html).toContain("Re-warm");
  });

  it("includes the scope label and custom title when provided", () => {
    const html = buildHtmlFullReport([], new Date(), {
      title: "UMA Monthly Report",
      reportingPeriod: "Apr 1 – Apr 30, 2026",
      scopeLabel: "UMA only",
    });
    expect(html).toContain("UMA Monthly Report");
    expect(html).toContain("Apr 1 – Apr 30, 2026");
  });

  it("escapes ad names to prevent script injection", () => {
    const html = buildHtmlFullReport(
      [
        fakeRow({
          creative: {
            adName: "<script>alert('x')</script>",
            spend: 200,
            results: 0,
            delivery: "active",
          },
        }),
      ],
      new Date(),
    );
    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders empty-state messages instead of empty tables", () => {
    const html = buildHtmlFullReport([], new Date());
    expect(html).toContain("No active creatives.");
    expect(html).toContain("No paused creatives.");
  });
});
