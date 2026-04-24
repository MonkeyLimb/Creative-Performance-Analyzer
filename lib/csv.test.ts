import { describe, expect, it } from "vitest";
import { parseCsv, splitRows } from "./csv";

describe("splitRows", () => {
  it("handles quoted fields with commas", () => {
    const rows = splitRows('a,b,c\n"hello, world",2,3\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["hello, world", "2", "3"],
    ]);
  });

  it("handles escaped quotes", () => {
    const rows = splitRows('a\n"she said ""hi"""\n');
    expect(rows).toEqual([["a"], ['she said "hi"']]);
  });

  it("handles CRLF line endings", () => {
    const rows = splitRows("a,b\r\n1,2\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCsv", () => {
  it("rejects empty input", () => {
    const r = parseCsv("");
    expect(r.ok).toBe(false);
  });

  it("rejects when ad name column is missing", () => {
    const r = parseCsv("foo,bar\n1,2\n");
    expect(r.ok).toBe(false);
  });

  it("parses a minimal Meta-style export", () => {
    const csv = [
      "Ad name,Ad ID,Amount spent (USD),Results,Impressions,Reach",
      "Creative A,123,100.50,5,10000,8000",
      "Creative B,456,200,2,12000,9500",
    ].join("\n");
    const r = parseCsv(csv);
    if (!r.ok) throw new Error(r.error);
    expect(r.creatives).toHaveLength(2);
    expect(r.creatives[0].adName).toBe("Creative A");
    expect(r.creatives[0].adId).toBe("123");
    expect(r.creatives[0].spend).toBe(100.5);
    expect(r.creatives[0].cpl).toBeCloseTo(20.1);
    expect(r.creatives[1].cpl).toBe(100);
  });

  it("aggregates duplicate ad ids by summing spend and results", () => {
    const csv = [
      "Ad name,Ad ID,Amount spent (USD),Results",
      "Creative A,123,50,2",
      "Creative A,123,150,3",
    ].join("\n");
    const r = parseCsv(csv);
    if (!r.ok) throw new Error(r.error);
    expect(r.creatives).toHaveLength(1);
    expect(r.creatives[0].spend).toBe(200);
    expect(r.creatives[0].results).toBe(5);
    expect(r.creatives[0].cpl).toBe(40);
  });

  it("falls back to Cost per result when results missing", () => {
    const csv = [
      "Ad name,Amount spent (USD),Cost per result",
      "Creative A,100,25",
    ].join("\n");
    const r = parseCsv(csv);
    if (!r.ok) throw new Error(r.error);
    expect(r.creatives[0].cpl).toBe(25);
  });

  it("strips currency symbols and commas from numbers", () => {
    const csv = [
      "Ad name,Amount spent (USD),Results",
      'Creative A,"$1,234.56",10',
    ].join("\n");
    const r = parseCsv(csv);
    if (!r.ok) throw new Error(r.error);
    expect(r.creatives[0].spend).toBeCloseTo(1234.56);
  });
});
