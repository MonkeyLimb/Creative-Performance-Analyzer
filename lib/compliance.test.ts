import { describe, expect, it } from "vitest";
import { checkCompliance, Flag, PARTNERS } from "./compliance";

function ids(flags: Flag[]): string[] {
  return flags.map((f) => f.ruleId);
}

const DISCLAIMER =
  "This is an advertisement. Dreambound partners with education providers and may receive compensation if you inquire.";

describe("checkCompliance — universal banned terms", () => {
  it("flags 'guarantee' regardless of selected partner", () => {
    for (const p of [null, ...PARTNERS] as const) {
      const f = checkCompliance("We guarantee results.", p);
      expect(ids(f)).toContain("u-guarantee");
    }
  });

  it("flags 'free' as a block", () => {
    const f = checkCompliance("Free coursework!", "UMA");
    const free = f.find((x) => x.ruleId === "u-free");
    expect(free?.severity).toBe("block");
  });

  it("flags healthcare degree with suggestion", () => {
    const f = checkCompliance("Earn a healthcare degree today.", null);
    const hit = f.find((x) => x.ruleId === "u-healthcare-degree");
    expect(hit).toBeTruthy();
    expect(hit?.suggestion).toContain("healthcare field");
  });

  it("does not fire on benign clean copy", () => {
    const f = checkCompliance(
      `Study Pharmacy Technician 100% online. ${DISCLAIMER}`,
      "Herzing",
    );
    // Herzing is independent and the text avoids banned terms.
    expect(ids(f)).not.toContain("u-guarantee");
    expect(ids(f)).not.toContain("u-free");
    expect(ids(f)).not.toContain("u-healthcare-degree");
  });

  it("is case-insensitive for /i rules", () => {
    const f = checkCompliance("DREAM JOB awaits!", null);
    expect(ids(f)).toContain("u-dream-job");
  });

  it("respects word boundaries (no substring false-positives)", () => {
    // "ensure" is restricted but "censured" is not.
    const f = checkCompliance("The board censured the partner.", null);
    expect(ids(f)).not.toContain("u-absolutes");
  });
});

describe("checkCompliance — partner scoping", () => {
  it("fires UMA-specific rule only when partner is UMA", () => {
    const text = "Join UMA today.";
    expect(ids(checkCompliance(text, "UMA"))).toContain("uma-join");
    expect(ids(checkCompliance(text, "FSU"))).not.toContain("uma-join");
    expect(ids(checkCompliance(text, null))).not.toContain("uma-join");
  });

  it("fires PEC rule for CTU and AIU but not for UMA", () => {
    const text = "Train for a new career.";
    expect(ids(checkCompliance(text, "CTU"))).toContain("pec-train-for");
    expect(ids(checkCompliance(text, "AIU"))).toContain("pec-train-for");
    expect(ids(checkCompliance(text, "UMA"))).not.toContain("pec-train-for");
  });

  it("fires SNHU psychologist block", () => {
    const f = checkCompliance("Become a psychologist.", "SNHU");
    const hit = f.find((x) => x.ruleId === "snhu-psychologist");
    expect(hit?.severity).toBe("block");
  });

  it("fires FSU game-dev abbreviation block but only for FSU", () => {
    expect(ids(checkCompliance("Try our Game Dev program.", "FSU"))).toContain(
      "fsu-game-dev",
    );
    expect(
      ids(checkCompliance("Try our Game Dev program.", null)),
    ).not.toContain("fsu-game-dev");
  });
});

describe("checkCompliance — required rules", () => {
  it("warns when financial aid mentioned without exact UMA/FSU phrasing", () => {
    const f = checkCompliance("Ask about financial aid options.", "UMA");
    expect(ids(f)).toContain("fa-uma-fsu");
  });

  it("does not warn when the exact UMA/FSU phrase is present", () => {
    const f = checkCompliance(
      "Ask about financial aid. Financial aid is available for those who qualify.",
      "UMA",
    );
    expect(ids(f)).not.toContain("fa-uma-fsu");
  });

  it("warns when SNHU/PEC financial-aid wording omits 'may be'", () => {
    const f = checkCompliance(
      "Financial aid is available for those who qualify.",
      "SNHU",
    );
    // The trigger fires because "financial aid" is mentioned, and the
    // SNHU-required phrase ("may be available") is NOT present.
    expect(ids(f)).toContain("fa-snhu-pec");
  });

  it("warns when the Dreambound disclaimer is missing", () => {
    const f = checkCompliance("Study Pharmacy Technician 100% online.", null);
    expect(ids(f)).toContain("disclaimer-missing");
  });

  it("does not warn when the full disclaimer is present", () => {
    const f = checkCompliance(
      `Study Pharmacy Technician 100% online. ${DISCLAIMER}`,
      null,
    );
    expect(ids(f)).not.toContain("disclaimer-missing");
  });
});

describe("checkCompliance — brand leak rules", () => {
  it("blocks all partner school names regardless of selected partner", () => {
    const samples: Array<[string, string]> = [
      ["Study at UMA today.", "b-uma"],
      ["Full Sail offers great programs.", "b-fsu"],
      ["SNHU has a psych program.", "b-snhu"],
      ["CTU is for you.", "b-ctu"],
      ["AIU criminal justice.", "b-aiu"],
      ["CCI offers radiology.", "b-cci"],
      ["Herzing sterile processing.", "b-herzing"],
      ["MedCerts EKG class.", "b-medcerts"],
      ["Powered by Perdoceo.", "b-pec"],
    ];
    for (const [text, expectedId] of samples) {
      const f = checkCompliance(text, "UMA");
      expect(ids(f)).toContain(expectedId);
    }
  });
});

describe("checkCompliance — multiple matches", () => {
  it("returns one flag per occurrence of the same banned term", () => {
    const f = checkCompliance("We guarantee results. Guaranteed jobs!", null);
    const guaranteeHits = f.filter((x) => x.ruleId === "u-guarantee");
    expect(guaranteeHits.length).toBe(2);
  });

  it("returns excerpts with positions", () => {
    const text = "We guarantee outcomes.";
    const f = checkCompliance(text, null);
    const hit = f.find((x) => x.ruleId === "u-guarantee");
    expect(hit?.excerpt.toLowerCase()).toBe("guarantee");
    expect(text.slice(hit!.start, hit!.end).toLowerCase()).toBe("guarantee");
  });
});

describe("checkCompliance — POV timing", () => {
  it("warns on 'just completed' POV timing", () => {
    const f = checkCompliance("I just completed my program!", null);
    expect(ids(f)).toContain("pov-just-completed");
  });
  it("doesn't warn on 'about to complete' POV timing", () => {
    const f = checkCompliance("I'm about to complete my program!", null);
    expect(ids(f)).not.toContain("pov-just-completed");
  });
});

describe("checkCompliance — empty input", () => {
  it("returns no flags on empty text", () => {
    expect(checkCompliance("", null)).toEqual([]);
  });
  it("returns no flags on whitespace-only text", () => {
    expect(checkCompliance("   \n  ", null)).toEqual([]);
  });
});

describe("checkCompliance — PEC standalone 'career'", () => {
  it("flags 'career' without 'path'/'journey'/'education' for CTU/AIU", () => {
    const f = checkCompliance("Build a career you love.", "CTU");
    expect(ids(f)).toContain("pec-career-standalone");
  });
  it("does not flag 'career path' for CTU/AIU", () => {
    const f = checkCompliance("Explore a new career path.", "CTU");
    expect(ids(f)).not.toContain("pec-career-standalone");
  });
});
