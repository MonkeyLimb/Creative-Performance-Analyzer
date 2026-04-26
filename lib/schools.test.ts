import { describe, expect, it } from "vitest";
import {
  EMPTY_RPL_OVERRIDES,
  SCHOOL_REGISTRY,
  computeRevenue,
  computeRoas,
  detectSchool,
  getRpl,
  programKey,
  schoolKey,
} from "./schools";

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
