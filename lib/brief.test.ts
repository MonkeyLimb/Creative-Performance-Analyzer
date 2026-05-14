import { describe, expect, it } from "vitest";
import {
  availableSchools,
  bySchool,
  byProgram,
  buildHtmlBrief,
  buildSlackBrief,
  buildTldr,
  cutList,
  filterRowsBySchool,
  hiddenWinners,
  paretoSummary,
  recomputeSummary,
  scaleList,
  volumeLosers,
} from "./brief";
import { ReportRow, ReportSummary } from "./report";
import { Creative, DEFAULT_THRESHOLDS, TierStatus } from "./types";

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

function fakeSummary(over: Partial<ReportSummary> = {}): ReportSummary {
  return {
    totalSpend: 0,
    totalResults: 0,
    totalRevenue: null,
    blendedCpl: null,
    blendedRoas: null,
    winners: 0,
    watch: 0,
    cuts: 0,
    cutSpend: 0,
    winnerShare: 0,
    activeCount: 0,
    topPerformer: null,
    ...over,
  };
}

describe("bySchool", () => {
  it("aggregates spend/leads/revenue by school and computes derived CPL/ROAS", () => {
    const rows: ReportRow[] = [
      fakeRow({
        school: "UMA",
        creative: { spend: 100, results: 5, adName: "A" },
        revenue: 200,
      }),
      fakeRow({
        school: "UMA",
        creative: { spend: 50, results: 2, adName: "B" },
        revenue: 80,
      }),
      fakeRow({
        school: "FSU",
        creative: { spend: 200, results: 0, adName: "C" },
      }),
    ];
    const rollup = bySchool(rows);
    expect(rollup).toHaveLength(2);

    const fsu = rollup.find((r) => r.school === "FSU")!;
    const uma = rollup.find((r) => r.school === "UMA")!;
    expect(uma.spend).toBe(150);
    expect(uma.leads).toBe(7);
    expect(uma.cpl).toBeCloseTo(150 / 7);
    expect(uma.revenue).toBe(280);
    expect(uma.roas).toBeCloseTo(280 / 150);
    expect(fsu.leads).toBe(0);
    expect(fsu.cpl).toBeNull();
    expect(fsu.revenue).toBeNull();
  });

  it("groups unmatched (school=null) rows under 'Unmatched'", () => {
    const rows: ReportRow[] = [
      fakeRow({ creative: { spend: 25, results: 1, adName: "X" } }),
    ];
    const rollup = bySchool(rows);
    expect(rollup[0].school).toBe("Unmatched");
  });

  it("sorts highest spend first", () => {
    const rows: ReportRow[] = [
      fakeRow({ school: "A", creative: { spend: 10, adName: "a" } }),
      fakeRow({ school: "B", creative: { spend: 100, adName: "b" } }),
      fakeRow({ school: "C", creative: { spend: 50, adName: "c" } }),
    ];
    expect(bySchool(rows).map((r) => r.school)).toEqual(["B", "C", "A"]);
  });
});

describe("byProgram", () => {
  it("only rolls up rows that have both school and program", () => {
    const rows: ReportRow[] = [
      fakeRow({
        school: "UMA",
        program: "MBC",
        creative: { spend: 50, results: 2, adName: "1" },
      }),
      fakeRow({
        school: "UMA",
        program: null,
        creative: { spend: 30, adName: "2" },
      }),
      fakeRow({ school: null, creative: { spend: 20, adName: "3" } }),
    ];
    const rollup = byProgram(rows);
    expect(rollup).toHaveLength(1);
    expect(rollup[0]).toMatchObject({
      school: "UMA",
      program: "MBC",
      spend: 50,
      leads: 2,
    });
  });
});

describe("cutList", () => {
  it("only returns cut-tier rows sorted by wasted spend desc", () => {
    const rows: ReportRow[] = [
      fakeRow({
        status: "cut",
        creative: { spend: 50, results: 0, adName: "small-waste" },
      }),
      fakeRow({
        status: "cut",
        creative: { spend: 400, results: 0, adName: "big-waste" },
      }),
      fakeRow({
        status: "winner",
        creative: { spend: 1000, results: 50, adName: "winner" },
      }),
    ];
    const cuts = cutList(rows);
    expect(cuts).toHaveLength(2);
    expect(cuts[0].row.creative.adName).toBe("big-waste");
    expect(cuts[0].wasted).toBe(400);
    expect(cuts[0].reason).toMatch(/0 leads/);
  });

  it("respects the limit parameter", () => {
    const rows: ReportRow[] = Array.from({ length: 20 }, (_, i) =>
      fakeRow({
        status: "cut",
        creative: { spend: i + 1, results: 0, adName: `ad-${i}` },
      }),
    );
    expect(cutList(rows, 5)).toHaveLength(5);
  });

  it("uses a CPL-based reason when leads exist", () => {
    const rows: ReportRow[] = [
      fakeRow({
        status: "cut",
        creative: { spend: 300, results: 4, cpl: 75, adName: "high-cpl" },
      }),
    ];
    expect(cutList(rows)[0].reason).toMatch(/CPL/);
  });
});

describe("scaleList", () => {
  it("returns winners sorted by ROAS desc, then by CPL asc", () => {
    const rows: ReportRow[] = [
      fakeRow({
        status: "winner",
        roas: 2.0,
        creative: { spend: 100, results: 5, cpl: 20, adName: "mid" },
      }),
      fakeRow({
        status: "winner",
        roas: 3.5,
        creative: { spend: 100, results: 8, cpl: 12.5, adName: "top" },
      }),
      fakeRow({
        status: "winner",
        roas: null,
        creative: { spend: 50, results: 3, cpl: 16, adName: "no-roas" },
      }),
    ];
    const list = scaleList(rows);
    expect(list[0].row.creative.adName).toBe("top");
    expect(list[1].row.creative.adName).toBe("mid");
    expect(list[2].row.creative.adName).toBe("no-roas");
  });

  it("ignores non-winners", () => {
    const rows: ReportRow[] = [
      fakeRow({ status: "watch", creative: { adName: "skip" } }),
      fakeRow({ status: "cut", creative: { adName: "skip2" } }),
    ];
    expect(scaleList(rows)).toEqual([]);
  });
});

describe("paretoSummary", () => {
  it("returns null on empty rows", () => {
    expect(paretoSummary([])).toBeNull();
  });

  it("rounds the cutoff up to at least 1 creative", () => {
    const rows = [fakeRow({ creative: { spend: 100, results: 5 } })];
    const p = paretoSummary(rows, 0.2);
    expect(p?.topCreatives).toBe(1);
    expect(p?.topSpendShare).toBe(1);
    expect(p?.topLeadsShare).toBe(1);
  });

  it("computes top-20% share of spend and leads", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      fakeRow({
        creative: { spend: (i + 1) * 100, results: (i + 1) * 2 },
      }),
    );
    // Total spend: 100+...+1000 = 5500. Top 20% = 2 creatives (i=9, i=8) =
    // 1000 + 900 = 1900. Share = 1900 / 5500 ≈ 0.3455.
    const p = paretoSummary(rows, 0.2);
    expect(p?.topCreatives).toBe(2);
    expect(p?.topSpendShare).toBeCloseTo(1900 / 5500, 4);
    expect(p?.topLeadsShare).toBeCloseTo(38 / 110, 4);
  });
});

describe("hiddenWinners", () => {
  it("returns high-ROAS rows with below-median spend", () => {
    const rows: ReportRow[] = [
      fakeRow({
        roas: 3.5,
        creative: { spend: 20, results: 2, adName: "gem" },
      }),
      fakeRow({
        roas: 2.5,
        creative: { spend: 30, results: 3, adName: "also-gem" },
      }),
      fakeRow({
        roas: 0.5,
        creative: { spend: 500, results: 5, adName: "big-loser" },
      }),
      fakeRow({
        roas: 4.0,
        creative: { spend: 1000, results: 100, adName: "already-scaled" },
      }),
    ];
    const list = hiddenWinners(rows);
    const names = list.map((h) => h.row.creative.adName);
    expect(names).toContain("gem");
    expect(names).toContain("also-gem");
    expect(names).not.toContain("already-scaled");
    expect(names).not.toContain("big-loser");
  });

  it("returns empty when no high-ROAS rows exist", () => {
    const rows: ReportRow[] = [
      fakeRow({ roas: 0.5, creative: { spend: 10 } }),
      fakeRow({ roas: 1.2, creative: { spend: 10 } }),
    ];
    expect(hiddenWinners(rows)).toEqual([]);
  });

  it("returns empty when ROAS data is missing", () => {
    const rows: ReportRow[] = [fakeRow({ creative: { spend: 10 } })];
    expect(hiddenWinners(rows)).toEqual([]);
  });
});

describe("volumeLosers", () => {
  it("returns high-spend rows with sub-1× ROAS", () => {
    const rows: ReportRow[] = [
      fakeRow({
        status: "watch",
        roas: 0.5,
        creative: { spend: 1000, results: 10, adName: "burner" },
      }),
      fakeRow({
        status: "watch",
        roas: 2.0,
        creative: { spend: 1000, results: 10, adName: "ok-winner" },
      }),
      fakeRow({
        status: "watch",
        roas: 0.4,
        creative: { spend: 20, results: 1, adName: "small-but-bad" },
      }),
      fakeRow({
        status: "cut",
        roas: 0.2,
        creative: { spend: 2000, results: 0, adName: "already-cut" },
      }),
      ...Array.from({ length: 4 }, (_, i) =>
        fakeRow({
          creative: { spend: 50, results: 1, adName: `noise-${i}` },
          roas: 1.5,
        }),
      ),
    ];
    const list = volumeLosers(rows);
    const names = list.map((l) => l.row.creative.adName);
    expect(names).toContain("burner");
    expect(names).not.toContain("already-cut"); // cuts are excluded
    expect(names).not.toContain("small-but-bad"); // spend below Q3
    expect(names).not.toContain("ok-winner"); // ROAS too high
  });
});

describe("filterRowsBySchool / availableSchools", () => {
  const rows: ReportRow[] = [
    fakeRow({ school: "UMA", creative: { adName: "A" } }),
    fakeRow({ school: "UMA", creative: { adName: "B" } }),
    fakeRow({ school: "FSU", creative: { adName: "C" } }),
    fakeRow({ school: null, creative: { adName: "D" } }),
  ];

  it("filters rows by school", () => {
    expect(filterRowsBySchool(rows, "UMA")).toHaveLength(2);
    expect(filterRowsBySchool(rows, "FSU")).toHaveLength(1);
    expect(filterRowsBySchool(rows, null)).toHaveLength(4);
  });

  it("returns sorted unique school names, excluding null", () => {
    expect(availableSchools(rows)).toEqual(["FSU", "UMA"]);
  });
});

describe("recomputeSummary", () => {
  it("recomputes totals + winner/cut counts from a row set", () => {
    const rows: ReportRow[] = [
      fakeRow({
        status: "winner",
        roas: 3.0,
        revenue: 300,
        creative: { spend: 100, results: 5 },
      }),
      fakeRow({
        status: "cut",
        creative: { spend: 200, results: 0 },
      }),
      fakeRow({
        status: "watch",
        creative: { spend: 50, results: 2, delivery: "active" },
      }),
    ];
    const s = recomputeSummary(rows);
    expect(s.totalSpend).toBe(350);
    expect(s.totalResults).toBe(7);
    expect(s.winners).toBe(1);
    expect(s.cuts).toBe(1);
    expect(s.cutSpend).toBe(200);
    expect(s.blendedCpl).toBeCloseTo(350 / 7);
    expect(s.totalRevenue).toBe(300);
    expect(s.blendedRoas).toBeCloseTo(300 / 350);
    expect(s.winnerShare).toBeCloseTo((5 / 7) * 100);
  });

  it("handles empty rows", () => {
    const s = recomputeSummary([]);
    expect(s.totalSpend).toBe(0);
    expect(s.blendedCpl).toBeNull();
    expect(s.blendedRoas).toBeNull();
    expect(s.winners).toBe(0);
    expect(s.topPerformer).toBeNull();
  });
});

describe("buildTldr", () => {
  it("includes a headline metric line", () => {
    const tldr = buildTldr(
      [],
      fakeSummary({
        totalSpend: 1000,
        totalResults: 40,
        blendedCpl: 25,
        blendedRoas: 1.6,
      }),
    );
    expect(tldr[0]).toMatch(/\$1,000/);
    expect(tldr[0]).toMatch(/40/);
    expect(tldr[0]).toMatch(/\$25/);
    expect(tldr[0]).toMatch(/1\.60×/);
  });

  it("flags when there are no winners", () => {
    const tldr = buildTldr([], fakeSummary({ winners: 0 }));
    expect(tldr.some((l) => /No creatives currently hit winner/.test(l))).toBe(
      true,
    );
  });

  it("calls out cut spend when present", () => {
    const tldr = buildTldr(
      [],
      fakeSummary({ cuts: 3, cutSpend: 500, winners: 1 }),
    );
    expect(tldr.some((l) => /\$500/.test(l))).toBe(true);
  });
});

describe("buildHtmlBrief", () => {
  it("returns a self-contained HTML document", () => {
    const html = buildHtmlBrief(
      [
        fakeRow({
          status: "winner",
          school: "UMA",
          program: "MBC",
          roas: 2.5,
          revenue: 250,
          creative: { spend: 100, results: 5, cpl: 20, adName: "Winner A" },
        }),
        fakeRow({
          status: "cut",
          school: "FSU",
          program: "Music Production",
          creative: { spend: 200, results: 0, adName: "Cut B" },
        }),
      ],
      fakeSummary({
        totalSpend: 300,
        totalResults: 5,
        blendedCpl: 60,
        blendedRoas: 0.83,
        winners: 1,
        watch: 0,
        cuts: 1,
        cutSpend: 200,
        winnerShare: 100,
        activeCount: 2,
        topPerformer: "Winner A",
      }),
      DEFAULT_THRESHOLDS,
      new Date("2026-05-14T10:00:00Z"),
    );

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Creative Performance Brief");
    expect(html).toContain("Winner A");
    expect(html).toContain("Cut B");
    expect(html).toContain("By school");
    expect(html).toContain("By program");
    expect(html).toContain("Scale these");
    expect(html).toContain("Kill these");
  });

  it("escapes HTML in ad names", () => {
    const html = buildHtmlBrief(
      [
        fakeRow({
          status: "cut",
          creative: {
            spend: 50,
            results: 0,
            adName: '<script>alert("xss")</script>',
          },
        }),
      ],
      fakeSummary({ totalSpend: 50, cuts: 1, cutSpend: 50 }),
      DEFAULT_THRESHOLDS,
      new Date(),
    );
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain("&lt;script&gt;");
  });

  it("emits a Slack-ready plaintext block with mrkdwn formatting", () => {
    const text = buildSlackBrief(
      [
        fakeRow({
          status: "winner",
          school: "UMA",
          program: "MBC",
          roas: 3.2,
          revenue: 320,
          creative: { spend: 100, results: 8, cpl: 12.5, adName: "Win A" },
        }),
        fakeRow({
          status: "cut",
          school: "FSU",
          creative: { spend: 250, results: 0, adName: "Loser B" },
        }),
      ],
      fakeSummary({
        totalSpend: 350,
        totalResults: 8,
        blendedCpl: 43.75,
        blendedRoas: 0.91,
        winners: 1,
        cuts: 1,
        cutSpend: 250,
        winnerShare: 100,
        topPerformer: "Win A",
      }),
      new Date("2026-05-14T10:00:00Z"),
    );
    expect(text).toContain("*Creative Performance Brief*");
    expect(text).toContain("*🟢 Scale these*");
    expect(text).toContain("*🔴 Kill these*");
    expect(text).toContain("Win A");
    expect(text).toContain("Loser B");
    expect(text).toContain("(UMA · MBC)");
    expect(text).toContain("frees $250");
    expect(text).toContain("*By school*");
    expect(text).toContain("UMA");
    expect(text).toContain("FSU");
  });

  it("shows the empty state when there are no scale/cut candidates", () => {
    const text = buildSlackBrief(
      [],
      fakeSummary(),
      new Date("2026-05-14T10:00:00Z"),
    );
    expect(text).toContain("(no winners this period)");
    expect(text).toContain("(no cut candidates)");
  });

  it("renders Hidden winners + Volume losers sections in the HTML brief", () => {
    const rows: ReportRow[] = [
      fakeRow({
        status: "watch",
        roas: 3.4,
        creative: { spend: 25, results: 1, cpl: 25, adName: "underScaled" },
      }),
      fakeRow({
        status: "watch",
        roas: 0.5,
        creative: { spend: 800, results: 10, cpl: 80, adName: "overScaled" },
      }),
      ...Array.from({ length: 6 }, (_, i) =>
        fakeRow({
          creative: { spend: 200, results: 5, cpl: 40, adName: `filler-${i}` },
          roas: 1.5,
        }),
      ),
    ];
    const html = buildHtmlBrief(
      rows,
      recomputeSummary(rows),
      DEFAULT_THRESHOLDS,
      new Date(),
    );
    expect(html).toContain("Hidden moves");
    expect(html).toContain("Hidden winners");
    expect(html).toContain("Volume losers");
    expect(html).toContain("underScaled");
    expect(html).toContain("overScaled");
  });

  it("includes scope label in the HTML title and header when provided", () => {
    const html = buildHtmlBrief(
      [fakeRow({ school: "UMA" })],
      fakeSummary({ totalSpend: 100 }),
      DEFAULT_THRESHOLDS,
      new Date(),
      { scopeLabel: "UMA only" },
    );
    expect(html).toContain("UMA only");
    expect(html).toMatch(/scoped to UMA only/);
  });

  it("includes scope label in the Slack brief header when provided", () => {
    const text = buildSlackBrief(
      [fakeRow({ school: "UMA" })],
      fakeSummary({ totalSpend: 100 }),
      new Date("2026-05-14"),
      { scopeLabel: "UMA only" },
    );
    expect(text).toMatch(/^\*Creative Performance Brief\* · UMA only/);
  });

  it("omits the By program section when no program-matched rows exist", () => {
    const html = buildHtmlBrief(
      [
        fakeRow({
          status: "watch",
          school: "UMA",
          program: null,
          creative: { spend: 10, results: 0, adName: "No program" },
        }),
      ],
      fakeSummary({ totalSpend: 10 }),
      DEFAULT_THRESHOLDS,
      new Date(),
    );
    expect(html).not.toContain("By program");
    expect(html).toContain("By school");
  });
});
