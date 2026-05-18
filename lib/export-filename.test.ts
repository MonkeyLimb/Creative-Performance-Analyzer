import { describe, expect, it } from "vitest";
import { parseExportFilename } from "./export-filename";

describe("parseExportFilename", () => {
  it("extracts account label + date range from the reference Meta filename", () => {
    const ctx = parseExportFilename("Dream-ound-Ads-Apr-18-2026-May-17-2026.csv");
    expect(ctx.accountLabel).toBe("Dream Ound");
    expect(ctx.startDate?.toISOString().slice(0, 10)).toBe("2026-04-18");
    expect(ctx.endDate?.toISOString().slice(0, 10)).toBe("2026-05-17");
    expect(ctx.rangeLabel).toBe("April 18 – May 17, 2026");
  });

  it("handles underscore-separated filenames", () => {
    const ctx = parseExportFilename(
      "Account_Name_Jan_1_2026_Feb_28_2026.csv",
    );
    expect(ctx.accountLabel).toBe("Account Name");
    expect(ctx.rangeLabel).toBe("January 1 – February 28, 2026");
  });

  it("strips export-type prefixes (Campaigns-, Ads-, Ad-Sets-)", () => {
    expect(
      parseExportFilename("Campaigns-Acme-Inc-Mar-1-2026-Mar-31-2026.csv")
        .accountLabel,
    ).toBe("Acme Inc");
    expect(
      parseExportFilename("Ad-Sets-Acme-Inc-Mar-1-2026-Mar-31-2026.csv")
        .accountLabel,
    ).toBe("Acme Inc");
  });

  it("renders different years on both sides when the range crosses Jan 1", () => {
    const ctx = parseExportFilename("Acct-Dec-15-2025-Jan-14-2026.csv");
    expect(ctx.rangeLabel).toBe("December 15, 2025 – January 14, 2026");
  });

  it("returns null dates when the filename has no recognizable range", () => {
    const ctx = parseExportFilename("just-some-export.csv");
    expect(ctx.startDate).toBeNull();
    expect(ctx.endDate).toBeNull();
    expect(ctx.rangeLabel).toBeNull();
    expect(ctx.accountLabel).toBe("Just Some Export");
  });

  it("returns nulls for an empty filename", () => {
    const ctx = parseExportFilename("");
    expect(ctx.accountLabel).toBeNull();
    expect(ctx.startDate).toBeNull();
    expect(ctx.rangeLabel).toBeNull();
  });

  it("preserves brand-styled mixed-case tokens (does not lowercase MedCerts)", () => {
    const ctx = parseExportFilename(
      "MedCerts-Phlebotomy-Apr-1-2026-Apr-30-2026.csv",
    );
    expect(ctx.accountLabel).toBe("MedCerts Phlebotomy");
  });

  it("rejects implausible dates (day > 31, year out of range)", () => {
    const ctx = parseExportFilename("Acct-Apr-42-2026-May-17-2026.csv");
    expect(ctx.startDate).toBeNull();
    expect(ctx.rangeLabel).toBeNull();
  });

  it("is case-insensitive on month names", () => {
    const ctx = parseExportFilename("Acct-APR-1-2026-MAY-1-2026.csv");
    expect(ctx.rangeLabel).toBe("April 1 – May 1, 2026");
  });
});
