import { Creative } from "./types";

export type Program = {
  name: string;
  aliases: string[];
  defaultRpl: number;
};

export type School = {
  name: string;
  aliases: string[];
  defaultRpl: number;
  programs: Program[];
};

// RPL defaults are seeded from the daily tracker the team currently uses.
// Aliases cover the abbreviations that show up in ad / campaign names.
export const SCHOOL_REGISTRY: School[] = [
  {
    name: "UMA",
    aliases: ["uma"],
    defaultRpl: 45,
    programs: [
      {
        name: "Medical Administrative Assistant",
        aliases: ["medical administrative assistant", "med admin", "maa"],
        defaultRpl: 45,
      },
      {
        name: "Medical Billing and Coding",
        aliases: [
          "medical billing and coding",
          "medical billing",
          "billing and coding",
          "mbc",
        ],
        defaultRpl: 45,
      },
      {
        name: "Healthcare Management",
        aliases: ["healthcare management", "hcm"],
        defaultRpl: 45,
      },
      {
        name: "Healthcare Administration",
        aliases: ["healthcare administration", "hca"],
        defaultRpl: 45,
      },
      {
        name: "Health and Human Services",
        aliases: ["health and human services", "hhs"],
        defaultRpl: 45,
      },
      {
        name: "Health Information Technology",
        aliases: ["health information technology", "hit"],
        defaultRpl: 45,
      },
      {
        name: "Pharmacy Technician",
        aliases: ["pharmacy technician", "pharmacy tech", "pht"],
        defaultRpl: 45,
      },
      {
        name: "Clinical Medical Assistant",
        aliases: ["clinical medical assistant", "cma"],
        defaultRpl: 45,
      },
      {
        name: "Nursing Assistant",
        aliases: ["nursing assistant", "cna"],
        defaultRpl: 45,
      },
      {
        name: "Phlebotomy Technician",
        aliases: ["phlebotomy technician", "phlebotomy", "phleb"],
        defaultRpl: 45,
      },
    ],
  },
  {
    name: "CCI",
    aliases: ["cci"],
    defaultRpl: 27,
    programs: [
      {
        name: "Pharmacy Technician",
        aliases: ["pharmacy technician", "pharmacy tech", "pht"],
        defaultRpl: 27,
      },
      {
        name: "Radiology",
        aliases: ["radiology", "rad"],
        defaultRpl: 27,
      },
      {
        name: "Medical Billing and Coding",
        aliases: ["medical billing and coding", "medical billing", "mbc"],
        defaultRpl: 27,
      },
      {
        name: "Medical Assistant",
        aliases: ["medical assistant", "med asst", "ma"],
        defaultRpl: 27,
      },
    ],
  },
  {
    name: "Herzing",
    aliases: ["herzing"],
    defaultRpl: 45,
    programs: [
      {
        name: "Sterile Processing",
        aliases: ["sterile processing", "sterileprocessing", "sterile", "sp"],
        defaultRpl: 45,
      },
    ],
  },
  {
    name: "MedCerts",
    aliases: ["medcerts", "med certs"],
    defaultRpl: 40,
    programs: [
      {
        name: "Phlebotomy",
        aliases: ["phlebotomy", "phleb", "pht"],
        defaultRpl: 40,
      },
      {
        name: "EKG Technician",
        aliases: ["ekg technician", "ekg tech", "ekg"],
        defaultRpl: 40,
      },
    ],
  },
  {
    name: "FSU",
    aliases: ["fsu", "full sail", "fullsail"],
    defaultRpl: 75,
    programs: [
      {
        name: "Music Production",
        aliases: ["music production", "music"],
        defaultRpl: 75,
      },
      {
        name: "Game Development",
        aliases: ["game development", "game dev", "gamedev", "game-dev", "gd"],
        defaultRpl: 75,
      },
      {
        name: "Information Technology",
        aliases: ["information technology", "it h&p", "it h p", "it"],
        defaultRpl: 75,
      },
      {
        name: "Cybersecurity",
        aliases: ["cybersecurity", "cyber security", "cybersec", "cyber"],
        defaultRpl: 75,
      },
    ],
  },
  {
    name: "SNHU",
    aliases: ["snhu"],
    defaultRpl: 50,
    programs: [
      {
        name: "Psychology",
        aliases: ["psychology", "psych"],
        defaultRpl: 50,
      },
    ],
  },
  {
    name: "AIU",
    aliases: ["aiu"],
    defaultRpl: 55,
    programs: [
      {
        name: "Criminal Justice",
        aliases: ["criminal justice", "cj"],
        defaultRpl: 55,
      },
    ],
  },
  {
    name: "CTU",
    aliases: ["ctu"],
    defaultRpl: 55,
    programs: [
      {
        name: "Information Technology",
        aliases: ["information technology", "it"],
        defaultRpl: 55,
      },
    ],
  },
];

export type SchoolKey = string;
export type ProgramKey = string;

export function schoolKey(school: string): SchoolKey {
  return school.toLowerCase();
}

export function programKey(school: string, program: string): ProgramKey {
  return `${school.toLowerCase()}::${program.toLowerCase()}`;
}

export type RplOverrides = {
  schools: Record<SchoolKey, number>;
  programs: Record<ProgramKey, number>;
};

export const EMPTY_RPL_OVERRIDES: RplOverrides = {
  schools: {},
  programs: {},
};

export type SchoolMatch = {
  school: string;
  program: string | null;
};

const WORD_BOUNDARY = /[^a-z0-9]/g;

function normalize(s: string): string {
  return ` ${s.toLowerCase().replace(WORD_BOUNDARY, " ").replace(/\s+/g, " ")} `;
}

function containsAlias(haystack: string, alias: string): boolean {
  const needle = alias.toLowerCase().trim();
  if (!needle) return false;
  // Match against the normalized haystack with word boundaries on both sides.
  const padded = ` ${needle.replace(WORD_BOUNDARY, " ").replace(/\s+/g, " ")} `;
  return haystack.includes(padded);
}

function aliasScore(haystack: string, alias: string): number {
  // Longer aliases beat shorter ones so "medical billing and coding" wins
  // over a stray "ma" inside "Medical Assistant".
  return containsAlias(haystack, alias) ? alias.length : 0;
}

export function detectSchool(
  c: Pick<Creative, "adName" | "campaignName" | "adSetName">,
  schools: School[] = SCHOOL_REGISTRY,
): SchoolMatch | null {
  const haystack = normalize(
    [c.adName, c.campaignName ?? "", c.adSetName ?? ""].join(" "),
  );

  let bestSchool: { school: School; score: number } | null = null;
  for (const school of schools) {
    let score = 0;
    for (const alias of [school.name, ...school.aliases]) {
      score = Math.max(score, aliasScore(haystack, alias));
    }
    if (score > 0 && (!bestSchool || score > bestSchool.score)) {
      bestSchool = { school, score };
    }
  }

  if (!bestSchool) return null;

  let bestProgram: { program: Program; score: number } | null = null;
  for (const program of bestSchool.school.programs) {
    let score = 0;
    for (const alias of [program.name, ...program.aliases]) {
      score = Math.max(score, aliasScore(haystack, alias));
    }
    if (score > 0 && (!bestProgram || score > bestProgram.score)) {
      bestProgram = { program, score };
    }
  }

  return {
    school: bestSchool.school.name,
    program: bestProgram?.program.name ?? null,
  };
}

export function getRpl(
  match: SchoolMatch | null,
  schools: School[],
  overrides: RplOverrides,
): number | null {
  if (!match) return null;
  const school = schools.find((s) => s.name === match.school);
  if (!school) return null;

  if (match.program) {
    const pKey = programKey(match.school, match.program);
    if (overrides.programs[pKey] != null) return overrides.programs[pKey];
    const program = school.programs.find((p) => p.name === match.program);
    if (program) return program.defaultRpl;
  }

  const sKey = schoolKey(match.school);
  if (overrides.schools[sKey] != null) return overrides.schools[sKey];
  return school.defaultRpl;
}

export function computeRevenue(results: number, rpl: number | null): number | null {
  if (rpl == null || !Number.isFinite(rpl)) return null;
  return results * rpl;
}

export function computeRoas(
  revenue: number | null,
  spend: number,
): number | null {
  if (revenue == null) return null;
  if (spend <= 0) return null;
  return revenue / spend;
}

export type CreativeRoas = {
  match: SchoolMatch | null;
  matchSource: "auto" | "manual" | "manual-cleared";
  rpl: number | null;
  revenue: number | null;
  roas: number | null;
};

// Map from creative key (adId || adName) to a manual school/program override.
// `school: null` means the user explicitly marked the creative as "no match".
export type CreativeMatchOverride = {
  school: string | null;
  program: string | null;
};

export type CreativeMatchOverrides = Record<string, CreativeMatchOverride>;

export function creativeMatchKey(c: Pick<Creative, "adId" | "adName">): string {
  return c.adId || c.adName;
}

export function deriveRoas(
  c: Creative,
  schools: School[],
  overrides: RplOverrides,
  matchOverrides: CreativeMatchOverrides = {},
): CreativeRoas {
  const key = creativeMatchKey(c);
  const manual = matchOverrides[key];
  let match: SchoolMatch | null;
  let matchSource: CreativeRoas["matchSource"];
  if (manual === undefined) {
    match = detectSchool(c, schools);
    matchSource = "auto";
  } else if (manual.school === null) {
    match = null;
    matchSource = "manual-cleared";
  } else {
    match = { school: manual.school, program: manual.program };
    matchSource = "manual";
  }
  const rpl = getRpl(match, schools, overrides);
  const revenue = computeRevenue(c.results, rpl);
  const roas = computeRoas(revenue, c.spend);
  return { match, matchSource, rpl, revenue, roas };
}
