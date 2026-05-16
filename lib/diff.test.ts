import { describe, expect, it } from "vitest";
import { computeDiff, DiffItem, diffKey } from "./diff";
import { Creative } from "./types";
import { CreativeRoas } from "./schools";

function fakeItem(
  over: Partial<Creative> & {
    roas?: number | null;
    rpl?: number | null;
    revenue?: number | null;
  } = {},
): DiffItem {
  const { roas, rpl, revenue, ...creativeOver } = over;
  const creative: Creative = {
    adName: "X",
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
    ...creativeOver,
  };
  const roasInfo: CreativeRoas = {
    match: null,
    matchSource: "auto",
    rpl: rpl ?? null,
    revenue: revenue ?? null,
    roas: roas ?? null,
  };
  return { creative, roas: roasInfo, status: "watch" };
}

describe("diffKey", () => {
  it("prefers adId when present", () => {
    expect(diffKey({ adId: "123", adName: "Ad" })).toBe("123");
  });
  it("falls back to adName when adId is missing", () => {
    expect(diffKey({ adId: undefined, adName: "OnlyName" })).toBe("OnlyName");
  });
});

describe("computeDiff", () => {
  it("returns parallel keys for each input creative", () => {
    const r = computeDiff([
      fakeItem({ adId: "a", adName: "A" }),
      fakeItem({ adId: "b", adName: "B" }),
    ]);
    expect(r.keys).toEqual(["a", "b"]);
  });

  it("marks lowest CPL as best (lower-is-better)", () => {
    const r = computeDiff([
      fakeItem({ adId: "high", cpl: 50 }),
      fakeItem({ adId: "low", cpl: 10 }),
    ]);
    const row = r.numeric.find((x) => x.key === "cpl")!;
    expect(row.direction).toBe("lower");
    expect(row.bestIndex).toBe(1);
    expect(row.worstIndex).toBe(0);
  });

  it("marks highest ROAS as best (higher-is-better)", () => {
    const r = computeDiff([
      fakeItem({ adId: "loser", roas: 0.5 }),
      fakeItem({ adId: "winner", roas: 3.0 }),
      fakeItem({ adId: "mid", roas: 1.5 }),
    ]);
    const row = r.numeric.find((x) => x.key === "roas")!;
    expect(row.bestIndex).toBe(1);
    expect(row.worstIndex).toBe(0);
  });

  it("returns null best/worst for neutral metrics like spend", () => {
    const r = computeDiff([
      fakeItem({ spend: 100 }),
      fakeItem({ spend: 1000 }),
    ]);
    const row = r.numeric.find((x) => x.key === "spend")!;
    expect(row.direction).toBe("neutral");
    expect(row.bestIndex).toBeNull();
    expect(row.worstIndex).toBeNull();
  });

  it("skips highlights when values are within 5% (tie)", () => {
    const r = computeDiff([
      fakeItem({ cpl: 100 }),
      fakeItem({ cpl: 103 }),
    ]);
    const row = r.numeric.find((x) => x.key === "cpl")!;
    expect(row.bestIndex).toBeNull();
    expect(row.worstIndex).toBeNull();
  });

  it("highlights when values are outside the 5% tie band", () => {
    const r = computeDiff([
      fakeItem({ cpl: 100 }),
      fakeItem({ cpl: 110 }),
    ]);
    const row = r.numeric.find((x) => x.key === "cpl")!;
    expect(row.bestIndex).toBe(0);
    expect(row.worstIndex).toBe(1);
  });

  it("excludes null values from min/max but preserves array shape", () => {
    const r = computeDiff([
      fakeItem({ cpl: null }),
      fakeItem({ cpl: 10 }),
      fakeItem({ cpl: 50 }),
    ]);
    const row = r.numeric.find((x) => x.key === "cpl")!;
    expect(row.values).toEqual([null, 10, 50]);
    expect(row.bestIndex).toBe(1);
    expect(row.worstIndex).toBe(2);
  });

  it("returns null indices when only one valid value exists", () => {
    const r = computeDiff([
      fakeItem({ cpl: 50 }),
      fakeItem({ cpl: null }),
    ]);
    const row = r.numeric.find((x) => x.key === "cpl")!;
    expect(row.bestIndex).toBeNull();
    expect(row.worstIndex).toBeNull();
  });

  it("returns null indices when all values are zero (treated as tied)", () => {
    const r = computeDiff([fakeItem({ cpl: 0 }), fakeItem({ cpl: 0 })]);
    const row = r.numeric.find((x) => x.key === "cpl")!;
    expect(row.bestIndex).toBeNull();
    expect(row.worstIndex).toBeNull();
  });

  it("treats NaN and Infinity as null", () => {
    const r = computeDiff([
      fakeItem({ cpl: NaN }),
      fakeItem({ cpl: Infinity }),
      fakeItem({ cpl: 25 }),
    ]);
    const row = r.numeric.find((x) => x.key === "cpl")!;
    expect(row.values).toEqual([null, null, 25]);
    expect(row.bestIndex).toBeNull();
    expect(row.worstIndex).toBeNull();
  });

  it("flips best/worst direction for higher-is-better frequency (which is lower-is-better)", () => {
    // Frequency rising = fatigue, so lower frequency is the winner.
    const r = computeDiff([
      fakeItem({ frequency: 1.2 }),
      fakeItem({ frequency: 4.5 }),
    ]);
    const row = r.numeric.find((x) => x.key === "frequency")!;
    expect(row.direction).toBe("lower");
    expect(row.bestIndex).toBe(0);
    expect(row.worstIndex).toBe(1);
  });
});
