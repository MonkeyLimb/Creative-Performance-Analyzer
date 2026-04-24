import { describe, expect, it } from "vitest";
import {
  buildAdsManagerUrl,
  encodeAdNameFilter,
  normalizeActId,
} from "./ads-manager-url";

describe("normalizeActId", () => {
  it("prefixes raw numeric ids with act_", () => {
    expect(normalizeActId("123456")).toBe("act_123456");
  });
  it("leaves act_-prefixed ids alone", () => {
    expect(normalizeActId("act_123456")).toBe("act_123456");
  });
});

describe("encodeAdNameFilter", () => {
  it("matches the documented double-JSON encoding for one name", () => {
    expect(encodeAdNameFilter(["AD_NAME"])).toBe('"[\\"AD_NAME\\"]"');
  });

  it("encodes multiple names", () => {
    const out = encodeAdNameFilter(["A", "B"]);
    const decoded = JSON.parse(JSON.parse(out));
    expect(decoded).toEqual(["A", "B"]);
  });

  it("safely encodes names with quotes and commas", () => {
    const tricky = 'Hero "Spring", v2';
    const out = encodeAdNameFilter([tricky]);
    const decoded = JSON.parse(JSON.parse(out));
    expect(decoded).toEqual([tricky]);
  });
});

describe("buildAdsManagerUrl", () => {
  it("builds a minimal url with just account + ad name", () => {
    const url = buildAdsManagerUrl({
      account: { actId: "123" },
      adNames: ["Hero Spring"],
    });
    expect(url).toContain("act=act_123");
    expect(url).toContain("filter_set=SEARCH_BY_AD_NAME-STRING-EQUAL-");
    expect(url).not.toContain("business_id");
    expect(url).not.toContain("selected_ad_ids");
  });

  it("appends business_id and global_scope_id when provided", () => {
    const url = buildAdsManagerUrl({
      account: { actId: "act_123", businessId: "999" },
      adNames: ["Hero Spring"],
    });
    expect(url).toContain("business_id=999");
    expect(url).toContain("global_scope_id=999");
  });

  it("appends selected_ad_ids when ad ids are provided", () => {
    const url = buildAdsManagerUrl({
      account: { actId: "act_123" },
      adNames: ["A", "B"],
      adIds: ["111", "222"],
    });
    expect(url).toContain("selected_ad_ids=111%2C222");
  });

  it("omits selected_ad_ids when ad ids are empty", () => {
    const url = buildAdsManagerUrl({
      account: { actId: "act_123" },
      adNames: ["A"],
      adIds: [],
    });
    expect(url).not.toContain("selected_ad_ids");
  });

  it("throws when actId is missing", () => {
    expect(() =>
      buildAdsManagerUrl({ account: { actId: "" }, adNames: ["A"] }),
    ).toThrow();
  });

  it("throws when adNames is empty", () => {
    expect(() =>
      buildAdsManagerUrl({ account: { actId: "act_123" }, adNames: [] }),
    ).toThrow();
  });

  it("url-encodes the filter_set value exactly once", () => {
    const url = buildAdsManagerUrl({
      account: { actId: "act_123" },
      adNames: ["Hero Spring"],
    });
    const filterSet = new URL(url).searchParams.get("filter_set");
    expect(filterSet).toBe(
      'SEARCH_BY_AD_NAME-STRING-EQUAL-"[\\"Hero Spring\\"]"',
    );
    expect(JSON.parse(JSON.parse(filterSet!.replace(
      "SEARCH_BY_AD_NAME-STRING-EQUAL-",
      "",
    )))).toEqual(["Hero Spring"]);
  });
});
