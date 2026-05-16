import { describe, expect, it } from "vitest";
import { mergeCreatives, summarizeReport } from "./merge";
import { Creative } from "@/lib/types";

function fake(overrides: Partial<Creative> = {}): Creative {
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

describe("mergeCreatives", () => {
  it("returns an empty result for empty inputs", () => {
    const { merged, report } = mergeCreatives([], []);
    expect(merged).toEqual([]);
    expect(report).toEqual({ added: 0, updated: 0, untouched: 0 });
  });

  it("counts new rows as added", () => {
    const incoming = [fake({ adId: "1", adName: "A" }), fake({ adId: "2", adName: "B" })];
    const { merged, report } = mergeCreatives([], incoming);
    expect(merged).toHaveLength(2);
    expect(report).toEqual({ added: 2, updated: 0, untouched: 0 });
  });

  it("matches by adId across uploads, takes new field values, and counts as updated", () => {
    const existing = [fake({ adId: "1", adName: "A", spend: 100, results: 5, cpl: 20 })];
    const incoming = [fake({ adId: "1", adName: "A", spend: 150, results: 8, cpl: 18.75 })];
    const { merged, report } = mergeCreatives(existing, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].spend).toBe(150);
    expect(merged[0].results).toBe(8);
    expect(merged[0].cpl).toBe(18.75);
    expect(report).toEqual({ added: 0, updated: 1, untouched: 0 });
  });

  it("falls back to adName when adId is missing", () => {
    const existing = [fake({ adName: "Same Name", spend: 100 })];
    const incoming = [fake({ adName: "Same Name", spend: 200 })];
    const { merged, report } = mergeCreatives(existing, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].spend).toBe(200);
    expect(report.updated).toBe(1);
  });

  it("counts existing rows not present in incoming as untouched", () => {
    const existing = [fake({ adId: "1" }), fake({ adId: "2" })];
    const incoming = [fake({ adId: "1", spend: 999 })];
    const { merged, report } = mergeCreatives(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(report).toEqual({ added: 0, updated: 1, untouched: 1 });
  });

  it("does not overwrite existing values with null from incoming", () => {
    const existing = [fake({ adId: "1", cpl: 20, frequency: 2.5 })];
    const incoming = [fake({ adId: "1", cpl: null, frequency: null })];
    const { merged } = mergeCreatives(existing, incoming);
    expect(merged[0].cpl).toBe(20);
    expect(merged[0].frequency).toBe(2.5);
  });

  it("reports no change when incoming row is identical to existing", () => {
    const existing = [fake({ adId: "1", spend: 100, raw: { Foo: "1" } })];
    const incoming = [fake({ adId: "1", spend: 100, raw: { Foo: "1" } })];
    const { report } = mergeCreatives(existing, incoming);
    expect(report).toEqual({ added: 0, updated: 0, untouched: 0 });
  });

  it("updates the raw blob when the source row changed", () => {
    const existing = [fake({ adId: "1", raw: { Foo: "1" } })];
    const incoming = [fake({ adId: "1", raw: { Foo: "2" } })];
    const { merged, report } = mergeCreatives(existing, incoming);
    expect(merged[0].raw).toEqual({ Foo: "2" });
    expect(report.updated).toBe(1);
  });

  it("processes a mixed upload with new, updated, and untouched rows", () => {
    const existing = [
      fake({ adId: "1", spend: 100 }),
      fake({ adId: "2", spend: 200 }),
      fake({ adId: "3", spend: 300 }),
    ];
    const incoming = [
      fake({ adId: "2", spend: 250 }),
      fake({ adId: "4", spend: 50 }),
    ];
    const { merged, report } = mergeCreatives(existing, incoming);
    expect(merged).toHaveLength(4);
    expect(report).toEqual({ added: 1, updated: 1, untouched: 2 });
  });
});

describe("summarizeReport", () => {
  it("omits zero counts", () => {
    expect(summarizeReport({ added: 3, updated: 0, untouched: 5 })).toBe(
      "+3 new · 5 untouched",
    );
  });

  it("returns 'No changes' when everything is zero", () => {
    expect(summarizeReport({ added: 0, updated: 0, untouched: 0 })).toBe(
      "No changes",
    );
  });
});
