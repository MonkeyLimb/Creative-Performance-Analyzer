import { describe, expect, it } from "vitest";
import { ReportRow, ReportSummary, buildMarkdownReport } from "./report";
import { Creative, DEFAULT_THRESHOLDS } from "./types";

function fakeCreative(overrides: Partial<Creative> = {}): Creative {
  return {
    adName: "Ad",
    spend: 100,
    results: 5,
    cpl: 20,
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
    ...overrides,
  };
}

function fakeRow(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    creative: fakeCreative(),
    status: "winner",
    rpl: 50,
    revenue: 250,
    roas: 2.5,
    school: "FSU",
    program: "Music Production",
    ...overrides,
  };
}

const fakeSummary: ReportSummary = {
  totalSpend: 100,
  totalResults: 5,
  totalRevenue: 250,
  blendedCpl: 20,
  blendedRoas: 2.5,
  winners: 1,
  watch: 0,
  cuts: 0,
  cutSpend: 0,
  winnerShare: 100,
  activeCount: 1,
  topPerformer: "Ad",
};

describe("buildMarkdownReport (thumbnails)", () => {
  const generatedAt = new Date("2026-05-16T00:00:00Z");

  it("omits the Thumbnail column when no thumbnails are provided", () => {
    const md = buildMarkdownReport(
      [fakeRow({ creative: fakeCreative({ adId: "1" }) })],
      fakeSummary,
      DEFAULT_THRESHOLDS,
      generatedAt,
    );
    expect(md).toContain("| Ad name | School |");
    expect(md).not.toContain("| Thumbnail |");
  });

  it("omits the Thumbnail column when the map is empty or all-null", () => {
    const md = buildMarkdownReport(
      [fakeRow({ creative: fakeCreative({ adId: "1" }) })],
      fakeSummary,
      DEFAULT_THRESHOLDS,
      generatedAt,
      new Map([["1", null]]),
    );
    expect(md).not.toContain("| Thumbnail |");
  });

  it("adds the Thumbnail column and an image markdown cell when a URL is present", () => {
    const md = buildMarkdownReport(
      [fakeRow({ creative: fakeCreative({ adId: "1", adName: "Winner" }) })],
      fakeSummary,
      DEFAULT_THRESHOLDS,
      generatedAt,
      new Map([["1", "https://cdn/win.jpg"]]),
    );
    expect(md).toContain("| Thumbnail | Ad name |");
    expect(md).toContain("![Winner](https://cdn/win.jpg)");
  });

  it("renders an em dash for winners missing a thumbnail when others have one", () => {
    const md = buildMarkdownReport(
      [
        fakeRow({ creative: fakeCreative({ adId: "1", adName: "A" }) }),
        fakeRow({ creative: fakeCreative({ adId: "2", adName: "B" }) }),
      ],
      fakeSummary,
      DEFAULT_THRESHOLDS,
      generatedAt,
      new Map([
        ["1", "https://cdn/a.jpg"],
        ["2", null],
      ]),
    );
    expect(md).toContain("![A](https://cdn/a.jpg)");
    // The row for B should still have the thumbnail column slot but use an em dash.
    expect(md).toMatch(/\|\s—\s\|\sB\s\|/);
  });

  it("only injects thumbnails into the Winners table, not Watch or Cut", () => {
    const md = buildMarkdownReport(
      [
        fakeRow({
          status: "winner",
          creative: fakeCreative({ adId: "w1", adName: "Win" }),
        }),
        fakeRow({
          status: "watch",
          creative: fakeCreative({ adId: "w2", adName: "Watch" }),
        }),
      ],
      { ...fakeSummary, watch: 1 },
      DEFAULT_THRESHOLDS,
      generatedAt,
      new Map([
        ["w1", "https://cdn/win.jpg"],
        ["w2", "https://cdn/watch.jpg"],
      ]),
    );
    expect(md).toContain("![Win](https://cdn/win.jpg)");
    expect(md).not.toContain("![Watch](https://cdn/watch.jpg)");
  });
});
