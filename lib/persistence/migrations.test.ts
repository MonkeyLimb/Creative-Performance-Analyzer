import { describe, expect, it } from "vitest";
import { CURRENT_VERSION, migrateCreatives } from "./migrations";
import { Creative } from "@/lib/types";

function fake(overrides: Partial<Creative> = {}): Creative {
  return {
    adName: "Ad",
    spend: 10,
    results: 1,
    cpl: 10,
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

describe("migrateCreatives", () => {
  it("returns null for non-array input", () => {
    expect(migrateCreatives(null, 1)).toBeNull();
    expect(migrateCreatives({}, 1)).toBeNull();
    expect(migrateCreatives("oops", 1)).toBeNull();
  });

  it("returns an empty list unchanged at the current version", () => {
    expect(migrateCreatives([], CURRENT_VERSION)).toEqual([]);
  });

  it("passes current-version creatives through unchanged", () => {
    const rows = [fake({ adId: "1" }), fake({ adId: "2" })];
    expect(migrateCreatives(rows, CURRENT_VERSION)).toEqual(rows);
  });

  it("refuses to load a blob written by a newer version than we understand", () => {
    expect(migrateCreatives([fake()], CURRENT_VERSION + 1)).toBeNull();
  });

  it("treats a missing/zero version as something to migrate from, not crash on", () => {
    const rows = [fake({ adId: "1" })];
    // At v1 there are no transforms, so v0 -> v1 is a passthrough. The
    // important behavior is that it returns a value, not null.
    expect(migrateCreatives(rows, 0)).toEqual(rows);
  });
});
