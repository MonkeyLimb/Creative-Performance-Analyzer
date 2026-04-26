import { describe, expect, it } from "vitest";
import { classify } from "./tiers";
import { Creative, DEFAULT_THRESHOLDS } from "./types";

function fakeCreative(overrides: Partial<Creative> = {}): Creative {
  return {
    adName: "Test",
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

describe("classify", () => {
  it("returns cut whenever spend > 0 and results == 0, even with ROAS provided", () => {
    const c = fakeCreative({ spend: 100, results: 0, cpl: null });
    expect(classify(c, DEFAULT_THRESHOLDS, 0)).toBe("cut");
    expect(classify(c, DEFAULT_THRESHOLDS, null)).toBe("cut");
  });

  it("uses ROAS thresholds when ROAS is provided", () => {
    const c = fakeCreative();
    expect(classify(c, DEFAULT_THRESHOLDS, 2.5)).toBe("winner");
    expect(classify(c, DEFAULT_THRESHOLDS, 1.5)).toBe("watch");
    expect(classify(c, DEFAULT_THRESHOLDS, 0.5)).toBe("cut");
  });

  it("treats break-even as watch (ROAS == 1)", () => {
    const c = fakeCreative();
    expect(classify(c, DEFAULT_THRESHOLDS, 1)).toBe("watch");
  });

  it("falls back to CPL when ROAS is null", () => {
    expect(classify(fakeCreative({ cpl: 15 }), DEFAULT_THRESHOLDS, null)).toBe(
      "winner",
    );
    expect(classify(fakeCreative({ cpl: 30 }), DEFAULT_THRESHOLDS, null)).toBe(
      "watch",
    );
    expect(classify(fakeCreative({ cpl: 60 }), DEFAULT_THRESHOLDS, null)).toBe(
      "cut",
    );
  });

  it("returns watch when ROAS is null and CPL is null", () => {
    expect(
      classify(
        fakeCreative({ cpl: null, results: 0, spend: 0 }),
        DEFAULT_THRESHOLDS,
        null,
      ),
    ).toBe("watch");
  });
});
