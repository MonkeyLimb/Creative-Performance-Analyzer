import { describe, expect, it } from "vitest";
import {
  EMPTY_RPL_OVERRIDES,
  SCHOOL_REGISTRY,
  computeRevenue,
  computeRoas,
  deriveRoas,
  detectSchool,
  getRpl,
  programKey,
  schoolKey,
} from "./schools";
import { Creative } from "./types";

function fakeCreative(adName: string, campaignName?: string) {
  return { adName, campaignName, adSetName: undefined };
}

describe("detectSchool", () => {
  it("detects FSU + Game Development from a campaign name", () => {
    const m = detectSchool(fakeCreative("Promo|Spring", "FSU Game Dev H&P"));
    expect(m).toEqual({ school: "FSU", program: "Game Development" });
  });

  it("detects MedCerts EKG from pipe-delimited ad name", () => {
    const m = detectSchool(fakeCreative("MedCerts|EKG|H&P|4.17.26-1"));
    expect(m).toEqual({ school: "MedCerts", program: "EKG Technician" });
  });

  it("detects CCI MBC from pipe-delimited ad name", () => {
    const m = detectSchool(fakeCreative("CCI|MBC|Week 3.22-28.2026"));
    expect(m).toEqual({
      school: "CCI",
      program: "Medical Billing and Coding",
    });
  });

  it("detects Herzing Sterile Processing", () => {
    const m = detectSchool(fakeCreative("SterileProcessing|Static|5", "Herzing"));
    expect(m).toEqual({ school: "Herzing", program: "Sterile Processing" });
  });

  it("returns null when no school keyword is present", () => {
    expect(detectSchool(fakeCreative("Generic|Promo|2024"))).toBeNull();
  });

  it("prefers the longest matching program alias", () => {
    // "Medical Billing and Coding" should beat the shorter "MA" alias.
    const m = detectSchool(
      fakeCreative("UMA|Medical Billing and Coding|Q2"),
    );
    expect(m?.program).toBe("Medical Billing and Coding");
  });

  it("returns school with null program when only the school is named", () => {
    const m = detectSchool(fakeCreative("AIU|Brand|Q2"));
    expect(m).toEqual({ school: "AIU", program: null });
  });

  it("matches FSU Cyber via the cyber alias", () => {
    expect(detectSchool(fakeCreative("FSU|Cyber|Static|3"))).toEqual({
      school: "FSU",
      program: "Cybersecurity",
    });
  });

  it("matches FSU IT via the IT alias", () => {
    expect(detectSchool(fakeCreative("FSU|IT|Static|3"))).toEqual({
      school: "FSU",
      program: "Information Technology",
    });
  });

  it("matches FSU Game Dev via the gamedev alias (no space)", () => {
    expect(detectSchool(fakeCreative("FSU|GameDev|Static|3"))).toEqual({
      school: "FSU",
      program: "Game Development",
    });
  });

  it("matches FSU IT when only the IT alias is present (no school prefix)", () => {
    expect(detectSchool(fakeCreative("IT|NewCreatives|4.23"))).toEqual({
      school: "FSU",
      program: "Information Technology",
    });
  });

  it("matches FSU Cyber from a bare Cyber-prefixed ad name", () => {
    expect(detectSchool(fakeCreative("Cyber|Static|3"))).toEqual({
      school: "FSU",
      program: "Cybersecurity",
    });
  });

  it("matches FSU GameDev from a bare GameDev-prefixed ad name", () => {
    expect(detectSchool(fakeCreative("GameDev|Week 3.15-21.2026_creatives"))).toEqual({
      school: "FSU",
      program: "Game Development",
    });
  });

  it("still routes CTU IT to CTU when the school is named", () => {
    expect(detectSchool(fakeCreative("CTU|IT|Q2"))).toEqual({
      school: "CTU",
      program: "Information Technology",
    });
  });
});

describe("getRpl", () => {
  it("uses program defaultRpl when program is detected", () => {
    const m = { school: "FSU", program: "Music Production" };
    expect(getRpl(m, SCHOOL_REGISTRY, EMPTY_RPL_OVERRIDES)).toBe(75);
  });

  it("falls back to school defaultRpl when program is missing", () => {
    expect(
      getRpl({ school: "AIU", program: null }, SCHOOL_REGISTRY, EMPTY_RPL_OVERRIDES),
    ).toBe(55);
  });

  it("respects program-level overrides", () => {
    const overrides = {
      schools: {},
      programs: { [programKey("FSU", "Music Production")]: 90 },
    };
    expect(
      getRpl({ school: "FSU", program: "Music Production" }, SCHOOL_REGISTRY, overrides),
    ).toBe(90);
  });

  it("respects school-level overrides as fallback", () => {
    const overrides = {
      schools: { [schoolKey("AIU")]: 60 },
      programs: {},
    };
    expect(
      getRpl({ school: "AIU", program: null }, SCHOOL_REGISTRY, overrides),
    ).toBe(60);
  });

  it("returns null for unknown match", () => {
    expect(getRpl(null, SCHOOL_REGISTRY, EMPTY_RPL_OVERRIDES)).toBeNull();
  });
});

function fullCreative(adName: string, results = 10, spend = 100): Creative {
  return {
    adName,
    spend,
    results,
    cpl: results > 0 ? spend / results : null,
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
  };
}

describe("deriveRoas with manual overrides", () => {
  it("uses the manual school+program override when provided", () => {
    const c = fullCreative("Generic|Promo|2024", 10, 100);
    const out = deriveRoas(c, SCHOOL_REGISTRY, EMPTY_RPL_OVERRIDES, {
      "Generic|Promo|2024": { school: "FSU", program: "Music Production" },
    });
    expect(out.match).toEqual({ school: "FSU", program: "Music Production" });
    expect(out.matchSource).toBe("manual");
    expect(out.rpl).toBe(75);
    expect(out.revenue).toBe(750);
    expect(out.roas).toBeCloseTo(7.5);
  });

  it("supports manual-cleared (explicit no match) overrides", () => {
    const c = fullCreative("FSU|Music|spring", 10, 100);
    const out = deriveRoas(c, SCHOOL_REGISTRY, EMPTY_RPL_OVERRIDES, {
      "FSU|Music|spring": { school: null, program: null },
    });
    expect(out.match).toBeNull();
    expect(out.matchSource).toBe("manual-cleared");
    expect(out.revenue).toBeNull();
  });

  it("falls back to auto detection when no override exists", () => {
    const c = fullCreative("FSU|Cyber|H&P|3", 10, 100);
    const out = deriveRoas(c, SCHOOL_REGISTRY, EMPTY_RPL_OVERRIDES, {});
    expect(out.matchSource).toBe("auto");
    expect(out.match).toEqual({
      school: "FSU",
      program: "Cybersecurity",
    });
  });
});

describe("computeRevenue / computeRoas", () => {
  it("multiplies leads by RPL", () => {
    expect(computeRevenue(10, 45)).toBe(450);
  });
  it("returns null revenue when RPL is missing", () => {
    expect(computeRevenue(10, null)).toBeNull();
  });
  it("computes roas from revenue/spend", () => {
    expect(computeRoas(450, 100)).toBeCloseTo(4.5);
  });
  it("returns null roas when spend is zero", () => {
    expect(computeRoas(450, 0)).toBeNull();
  });
});
