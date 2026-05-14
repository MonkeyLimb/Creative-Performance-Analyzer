// Dreambound ad-copy compliance rules.
//
// The check is intentionally rule-based (no LLM). Rules come from the
// Dreambound Ad Copy & Production Rules doc and apply to paid ad copy.
// Each rule is either:
//   - "banned":   a pattern that must NOT appear in the copy
//   - "required": when `trigger` appears, `required` must also appear
//
// Source of truth for ad-name parsing remains lib/csv.ts. This module
// works on raw copy text the user pastes into the pre-flight checker.

export type Partner =
  | "UMA"
  | "FSU"
  | "SNHU"
  | "CTU"
  | "AIU"
  | "CCI"
  | "Herzing"
  | "Medcerts";

export const PARTNERS: Partner[] = [
  "UMA",
  "FSU",
  "SNHU",
  "CTU",
  "AIU",
  "CCI",
  "Herzing",
  "Medcerts",
];

export type Severity = "block" | "warn";

export type PartnerScope = "all" | Partner[];

type BannedRule = {
  id: string;
  kind: "banned";
  severity: Severity;
  partners: PartnerScope;
  pattern: RegExp;
  message: string;
  suggestion?: string;
};

type RequiredRule = {
  id: string;
  kind: "required";
  severity: Severity;
  partners: PartnerScope;
  trigger: RegExp;
  required: RegExp;
  message: string;
  suggestion?: string;
};

export type Rule = BannedRule | RequiredRule;

export type Flag = {
  ruleId: string;
  severity: Severity;
  message: string;
  suggestion?: string;
  excerpt: string;
  start: number;
  end: number;
};

// Universal banned terms from Section 5. These fire regardless of which
// partner is selected (and even when no partner is selected).
const UNIVERSAL_BANNED: BannedRule[] = [
  rb("u-guarantee", "block", /\bguarantee(d|s)?\b/i, "\"Guarantee\" implies a promised outcome.", "Use \"may lead to opportunities\" or remove."),
  rb("u-free", "block", /\bfree\b/i, "\"Free\" is restricted across partners (UMA prohibits outright).", "Use \"at no additional cost\" if accurate, or remove."),
  rb("u-official", "block", /\bofficial\b/i, "\"Official\" is restricted."),
  rb("u-scholarship", "block", /\bscholarship(s)?\b/i, "\"Scholarship(s)\" is restricted."),
  rb("u-grants", "block", /\bgrant(s)?\b/i, "\"Grant(s)\" is restricted."),
  rb("u-you-have-won", "block", /\byou have won\b/i, "\"You have won\" is restricted."),
  rb("u-lifetime-placement", "block", /\blifetime placement\b/i, "\"Lifetime placement\" is a banned outcome claim."),
  rb("u-dream-job", "block", /\bdream job\b/i, "\"Dream job\" is restricted.", "Frame around education, not employment outcomes."),
  rb("u-make-more-money", "block", /\bmake more money\b/i, "Income outcome language is restricted."),
  rb("u-average-salary", "block", /\baverage salary\b/i, "\"Average salary\" is restricted.", "If salary must be cited, use \"Median Salary\" from BLS."),
  rb("u-salary-descriptor", "block", /\b(high|top|up to)\s+\$?\d*\s*(salary|salaries|pay|wages?|income)\b/i, "Salary descriptors \"high/top/up to\" are restricted."),
  rb("u-start-working-in", "block", /\bstart working in as little as\b/i, "Time-to-employment claims are restricted."),
  rb("u-superlatives", "warn", /\b(best|greatest|largest)\b/i, "Superlative claim — restricted in most contexts."),
  rb("u-state-of-art", "block", /\bstate[- ]of[- ]the[- ]art\b/i, "\"State of the art\" is restricted."),
  rb("u-latest-tech", "warn", /\b(today'?s technology|cutting[- ]edge|leading[- ]edge|state[- ]of[- ]the[- ]industry|industry[- ]standard|up[- ]to[- ]date)\b/i, "Tech-modernity claims are restricted."),
  rb("u-absolutes", "warn", /\b(latest|ensure|definitely|always)\b/i, "Absolute language is restricted."),
  rb("u-promise", "block", /\bpromise(s|d)?\b/i, "\"Promise\" is restricted."),
  rb("u-exclusive", "block", /\bexclusive\b/i, "\"Exclusive\" is restricted."),
  rb("u-industry-leaders", "block", /\bindustry leaders?\b/i, "\"Industry leaders\" (re: instructors) is restricted."),
  rb("u-approved-program", "block", /\bapproved (program|school)\b/i, "\"Approved program/school\" is restricted."),
  rb("u-healthcare-degree", "block", /\bhealthcare degree\b/i, "Use \"degree in the healthcare field\".", "Replace with \"degree in the healthcare field\"."),
  rb("u-medical-school", "block", /\bmedical (school|programs?|careers?)\b/i, "\"Medical school/programs/careers\" is restricted."),
  rb("u-college", "block", /\bcollege\b/i, "\"College\" is restricted."),
  rb("u-affordable", "block", /\b(affordable|discount)\b/i, "\"Affordable/discount\" is restricted."),
  rb("u-qualifications", "warn", /\b(highly qualified|expert|experienced|specialized)\b/i, "Subjective qualification claims are restricted."),
  rb("u-fast-track", "warn", /\bfast[- ]track\b/i, "\"Fast track\" requires provability — restricted if unproven."),
  rb("u-on-the-job-training", "block", /\bon[- ]the[- ]job training\b/i, "\"On-the-job training\" is restricted."),
  rb("u-tutoring", "block", /\btutoring\b/i, "Use \"one-on-one academic support\".", "Replace with \"one-on-one academic support\"."),
];

// Outcome promises from Section 5.
const OUTCOME_PROMISES: BannedRule[] = [
  rb("o-students-will", "block", /\bstudents will (pass|learn|understand|know)\b/i, "Outcome promise — restricted.", "Use \"students practice\" or \"students may be eligible\"."),
  rb("o-expect-position", "block", /\bexpect a position\b/i, "Outcome promise — restricted."),
  rb("o-career-services-place", "block", /\bcareer services will place you\b/i, "Placement promise — restricted."),
  rb("o-graduates-typically", "block", /\bgraduates typically get jobs\b/i, "Outcome promise — restricted."),
  rb("o-many-graduates", "block", /\bmany graduates get positions\b/i, "Outcome promise — restricted."),
  rb("o-lucrative", "block", /\blucrative career\b/i, "\"Lucrative career\" — restricted."),
];

// Core framing rule (Section 2) — warn on job-framing language.
const CORE_FRAMING: BannedRule[] = [
  rb("f-want-to-work", "warn", /\bwant to work in\b/i, "Core framing: lead with education, not employment.", "Reframe around the program (\"study\", \"learn\", \"covers\")."),
  rb("f-behind-the-scenes", "warn", /\bbehind[- ]the[- ]scenes\b/i, "Hook framing: don't center the workplace.", "Lead with the learner or the program."),
  rb("f-do-this-every-day", "warn", /\bdo this every day\b/i, "Job-description framing — restricted."),
  rb("f-how-x-run", "warn", /\bhow (hospitals|clinics|offices) run\b/i, "Hook framing: centers workplace, not program."),
  rb("f-what-happens-bts", "warn", /\bwhat happens behind the scenes\b/i, "Hook framing: centers workplace."),
];

// Partner brand-name leaks (Section 1) — block in ALL contexts. The creative
// should only ever name Dreambound, never a partner school.
const BRAND_LEAKS: BannedRule[] = [
  rb("b-uma", "block", /\b(uma|ultimate medical(?: academy)?)\b/i, "Partner school name \"UMA\" must not appear in ad copy.", "Replace with \"Dreambound\"."),
  rb("b-fsu", "block", /\b(fsu|full[- ]?sail(?: university)?)\b/i, "Partner school name \"Full Sail\" must not appear in ad copy.", "Replace with \"Dreambound\"."),
  rb("b-snhu", "block", /\b(snhu|southern new hampshire(?: university)?)\b/i, "Partner school name \"SNHU\" must not appear in ad copy.", "Replace with \"Dreambound\"."),
  rb("b-ctu", "block", /\b(ctu|colorado technical(?: university)?)\b/i, "Partner school name \"CTU\" must not appear in ad copy.", "Replace with \"Dreambound\"."),
  rb("b-aiu", "block", /\b(aiu|american intercontinental(?: university)?)\b/i, "Partner school name \"AIU\" must not appear in ad copy.", "Replace with \"Dreambound\"."),
  rb("b-cci", "block", /\bcci\b/i, "Partner school name \"CCI\" must not appear in ad copy.", "Replace with \"Dreambound\"."),
  rb("b-herzing", "block", /\bherzing\b/i, "Partner school name \"Herzing\" must not appear in ad copy.", "Replace with \"Dreambound\"."),
  rb("b-medcerts", "block", /\b(medcerts|med ?certs)\b/i, "Partner school name \"MedCerts\" must not appear in ad copy.", "Replace with \"Dreambound\"."),
  rb("b-pec", "block", /\b(pec|perdoceo)\b/i, "PEC / Perdoceo must not be referenced in any creative."),
];

// UMA-specific (Section 7).
const UMA_RULES: BannedRule[] = [
  rb("uma-accredited-school", "block", /\baccredited school\b/i, "UMA: use \"institutionally accredited\" or \"licensed by\".", "Replace with \"institutionally accredited\".", ["UMA"]),
  rb("uma-join", "block", /\bjoin uma\b/i, "UMA: \"Join UMA\" is restricted.", undefined, ["UMA"]),
  rb("uma-coursework-anywhere", "block", /\bdo coursework anywhere\b/i, "UMA: \"Do coursework anywhere\" is restricted.", undefined, ["UMA"]),
  rb("uma-right-fit", "warn", /\bis the right fit for you\b/i, "UMA: use \"could be a good fit for you\".", "Replace with \"could be a good fit for you\".", ["UMA"]),
  rb("uma-attendance", "warn", /\battendance\b/i, "UMA: use \"participation\" instead of \"attendance\".", "Replace with \"participation\".", ["UMA"]),
  rb("uma-fulfilling", "block", /\bfulfilling\b/i, "UMA: \"Fulfilling\" is restricted.", undefined, ["UMA"]),
  rb("uma-resource-guidance", "warn", /\bresource guidance\b/i, "UMA: prefix with \"potential\" → \"potential resource guidance\".", undefined, ["UMA"]),
  rb("uma-as-little-as", "warn", /\bas little as\b/i, "UMA: time-to-complete language requires a disclaimer.", "Add UMA's completion-time disclaimer or remove.", ["UMA"]),
  rb("uma-months-window", "warn", /\b\d+\+?\s*months\b/i, "UMA: \"X months\" / \"X+ months\" requires a disclaimer.", "Add UMA's completion-time disclaimer.", ["UMA"]),
  rb("uma-associates", "warn", /\bassociate'?s degree\b/i, "UMA: use \"associate degree\" (no possessive).", "Replace with \"associate degree\".", ["UMA"]),
  rb("uma-train", "warn", /\btrain(ing)?\b/i, "UMA: \"train/training\" is banned for DEGREE programs (allowed for diploma/cert).", "If targeting a degree program, use \"study\" / \"education\".", ["UMA"]),
];

// FSU-specific (Section 8).
const FSU_RULES: BannedRule[] = [
  rb("fsu-were-looking", "block", /\bwe'?re looking\b/i, "FSU: \"We're looking…\" is restricted.", undefined, ["FSU"]),
  rb("fsu-we-want-you", "block", /\bwe want you\b/i, "FSU: \"We want you…\" is restricted.", undefined, ["FSU"]),
  rb("fsu-game-dev", "block", /\bgame dev\b/i, "FSU: use \"Game Development\" — never abbreviate.", "Replace with \"Game Development\".", ["FSU"]),
  rb("fsu-music-prod", "block", /\bmusic prod\b/i, "FSU: use \"Music Production\" — never abbreviate.", "Replace with \"Music Production\".", ["FSU"]),
  rb("fsu-it-abbrev", "warn", /\bIT\b/, "FSU: spell out \"Information Technology\" — never abbreviate to IT.", "Replace with \"Information Technology\".", ["FSU"]),
];

// SNHU-specific (Section 9).
const SNHU_RULES: BannedRule[] = [
  rb("snhu-flexible-schedules", "warn", /\bflexible schedules\b/i, "SNHU: use \"No set class times\".", "Replace with \"No set class times\".", ["SNHU"]),
  rb("snhu-own-pace", "warn", /\bgo at your own pace\b/i, "SNHU: use \"With no set class times and 24/7 access to courses, you can learn on your schedule.\"", undefined, ["SNHU"]),
  rb("snhu-start-today", "warn", /\bstart today\b/i, "SNHU: use \"Apply Today\" or \"Get more information\".", "Replace with \"Apply Today\".", ["SNHU"]),
  rb("snhu-psychologist", "block", /\bpsychologist\b/i, "SNHU: \"Psychologist\" implies licensure — restricted.", undefined, ["SNHU"]),
  rb("snhu-phd", "block", /\b(ph\.?d\.?|doctorate)\b/i, "SNHU: PhD references are restricted.", undefined, ["SNHU"]),
  rb("snhu-bachelor-degree", "warn", /\bbachelor degree\b/i, "SNHU: use \"Bachelor's in Psychology\" or \"Bachelor of Science in Psychology\".", "Use \"Bachelor's in Psychology\".", ["SNHU"]),
  rb("snhu-urgency", "warn", /\b(act now|hurry|limited time|today only|don'?t wait|last chance)\b/i, "SNHU: urgency language is restricted.", undefined, ["SNHU"]),
  rb("snhu-or-certificate", "warn", /\bor certificate\b/i, "SNHU: verify \"or certificate\" scope with Kayla before use.", undefined, ["SNHU"]),
];

// PEC-specific (Section 10): applies to CTU + AIU.
const PEC_RULES: BannedRule[] = [
  rb("pec-dream-career", "warn", /\bdream career\b/i, "PEC: replace with \"new career path\".", "Replace with \"new career path\".", ["CTU", "AIU"]),
  rb("pec-take-charge", "warn", /\btake charge of your career\b/i, "PEC: replace with \"Pursuing a new career path/journey\".", undefined, ["CTU", "AIU"]),
  rb("pec-start-new-career", "warn", /\bstart your new career\b/i, "PEC: replace with \"Beginning a new transition/journey/pathway\".", undefined, ["CTU", "AIU"]),
  rb("pec-train-for", "warn", /\btrain for\b/i, "PEC: use \"Study for\" or \"Prepare for\".", "Replace with \"Study for\".", ["CTU", "AIU"]),
  rb("pec-career-training", "warn", /\bcareer training\b/i, "PEC: use \"Career education\" or \"Programs\".", "Replace with \"Career education\".", ["CTU", "AIU"]),
  rb("pec-flexible-training", "warn", /\bflexible training formats?\b/i, "PEC: use \"Flexible learning formats\".", undefined, ["CTU", "AIU"]),
  rb("pec-free-matcher", "warn", /\bfree school matcher\b/i, "PEC: use \"Free matching tool for schools\".", undefined, ["CTU", "AIU"]),
  rb("pec-choose-cert", "warn", /\bchoose a certification and class\b/i, "PEC: use \"Explore Programs\" or \"View Matches\".", undefined, ["CTU", "AIU"]),
  rb("pec-already-signed-up", "warn", /\byou'?ve already signed up\b/i, "PEC: use \"Connect with a School\".", undefined, ["CTU", "AIU"]),
  rb("pec-career-standalone", "warn", /\bcareer\b(?!\s+(path|journey|education))/i, "PEC: pair \"career\" with \"path\" or \"journey\" — never standalone.", undefined, ["CTU", "AIU"]),
];

// POV timing (Section 20).
const POV_TIMING: BannedRule[] = [
  rb("pov-just-completed", "warn", /\bjust (completed|started|graduated|finished)\b/i, "POV timing: use \"About to Start\" or \"About to Complete/Graduate\"."),
];

// Financial aid phrasing (Section 6). Required-rule: if "financial aid" is
// mentioned, the partner's exact approved phrase must also appear.
const FINANCIAL_AID: RequiredRule[] = [
  rr("fa-uma-fsu", "warn", /\bfinancial aid\b/i, /financial aid is available for those who qualify/i, "Financial-aid mention requires the exact UMA/FSU phrase.", "Use \"Financial aid is available for those who qualify.\"", ["UMA", "FSU"]),
  rr("fa-snhu-pec", "warn", /\bfinancial aid\b/i, /financial aid may be available for those who qualify/i, "Financial-aid mention requires the exact SNHU/CTU/AIU phrase (note \"may be\").", "Use \"Financial aid may be available for those who qualify.\"", ["SNHU", "CTU", "AIU"]),
];

// Required Dreambound advertising disclaimer (Section 1).
const DISCLAIMER: RequiredRule[] = [
  rr(
    "disclaimer-missing",
    "warn",
    /\S/, // fires whenever the draft has any real content
    /this is an advertisement\. dreambound partners with education providers and may receive compensation if you inquire\./i,
    "Required disclaimer is missing.",
    "Add: \"This is an advertisement. Dreambound partners with education providers and may receive compensation if you inquire.\"",
  ),
];

export const RULES: Rule[] = [
  ...UNIVERSAL_BANNED,
  ...OUTCOME_PROMISES,
  ...CORE_FRAMING,
  ...BRAND_LEAKS,
  ...UMA_RULES,
  ...FSU_RULES,
  ...SNHU_RULES,
  ...PEC_RULES,
  ...POV_TIMING,
  ...FINANCIAL_AID,
  ...DISCLAIMER,
];

export function checkCompliance(
  text: string,
  partner: Partner | null,
): Flag[] {
  const flags: Flag[] = [];
  for (const rule of RULES) {
    if (!appliesTo(rule, partner)) continue;
    if (rule.kind === "banned") {
      const regex = ensureGlobal(rule.pattern);
      for (const match of text.matchAll(regex)) {
        const start = match.index ?? 0;
        flags.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.message,
          suggestion: rule.suggestion,
          excerpt: match[0],
          start,
          end: start + match[0].length,
        });
      }
    } else {
      if (rule.trigger.test(text) && !rule.required.test(text)) {
        flags.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.message,
          suggestion: rule.suggestion,
          excerpt: "",
          start: 0,
          end: 0,
        });
      }
    }
  }
  return flags;
}

function appliesTo(rule: Rule, partner: Partner | null): boolean {
  if (rule.partners === "all") return true;
  if (!partner) return false;
  return rule.partners.includes(partner);
}

function ensureGlobal(re: RegExp): RegExp {
  return re.flags.includes("g") ? re : new RegExp(re.source, re.flags + "g");
}

// Helper constructors — keep the long rule list readable.
function rb(
  id: string,
  severity: Severity,
  pattern: RegExp,
  message: string,
  suggestion?: string,
  partners: PartnerScope = "all",
): BannedRule {
  return { id, kind: "banned", severity, pattern, message, suggestion, partners };
}

function rr(
  id: string,
  severity: Severity,
  trigger: RegExp,
  required: RegExp,
  message: string,
  suggestion?: string,
  partners: PartnerScope = "all",
): RequiredRule {
  return {
    id,
    kind: "required",
    severity,
    trigger,
    required,
    message,
    suggestion,
    partners,
  };
}
