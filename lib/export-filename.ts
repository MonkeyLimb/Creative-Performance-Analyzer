// Parses Meta Ads Manager export filenames to recover the account label
// and the reporting date range, so the dashboard's reports can reflect the
// source CSV rather than just "Generated today".
//
// Common shapes (the right-hand date range is the anchor we lock onto):
//   Dream-ound-Ads-Apr-18-2026-May-17-2026.csv
//   Account_Name_Jan_1_2026_Feb_28_2026.csv
//   Campaigns-Ads-Mar-15-2026-Apr-14-2026.csv

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_SHORT_TO_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const DATE_RANGE_RX =
  /[_\-\s](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[_\-\s]?(\d{1,2})[_\-\s,]+(\d{4})[_\-\s]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[_\-\s]?(\d{1,2})[_\-\s,]+(\d{4})\s*(?:\.[a-z]+)?$/i;

export type FilenameContext = {
  rawFilename: string;
  accountLabel: string | null;
  startDate: Date | null;
  endDate: Date | null;
  rangeLabel: string | null;
};

export function parseExportFilename(filename: string): FilenameContext {
  const trimmed = filename.trim();
  const ctx: FilenameContext = {
    rawFilename: trimmed,
    accountLabel: null,
    startDate: null,
    endDate: null,
    rangeLabel: null,
  };
  if (!trimmed) return ctx;

  const match = trimmed.match(DATE_RANGE_RX);
  if (match) {
    const startMo = MONTHS_SHORT_TO_INDEX[match[1].toLowerCase()];
    const startDay = parseInt(match[2], 10);
    const startYr = parseInt(match[3], 10);
    const endMo = MONTHS_SHORT_TO_INDEX[match[4].toLowerCase()];
    const endDay = parseInt(match[5], 10);
    const endYr = parseInt(match[6], 10);

    if (
      startMo != null &&
      endMo != null &&
      isPlausibleDay(startDay) &&
      isPlausibleDay(endDay) &&
      isPlausibleYear(startYr) &&
      isPlausibleYear(endYr)
    ) {
      ctx.startDate = new Date(Date.UTC(startYr, startMo, startDay));
      ctx.endDate = new Date(Date.UTC(endYr, endMo, endDay));
      ctx.rangeLabel = formatRange(ctx.startDate, ctx.endDate);

      // Strip the trailing date range + extension to recover the account
      // label prefix.
      const stripped = trimmed.slice(0, match.index ?? 0);
      ctx.accountLabel = cleanLabel(stripped);
    }
  } else {
    // No date range — still try to expose a clean account label from the stem.
    const stem = trimmed.replace(/\.[a-z]+$/i, "");
    ctx.accountLabel = cleanLabel(stem) || null;
  }

  return ctx;
}

function isPlausibleDay(d: number): boolean {
  return Number.isInteger(d) && d >= 1 && d <= 31;
}

function isPlausibleYear(y: number): boolean {
  return Number.isInteger(y) && y >= 2000 && y <= 2100;
}

function cleanLabel(raw: string): string | null {
  const stem = raw
    .replace(/\.[a-z]+$/i, "")
    .replace(/^(campaigns?|ad[\s_-]?sets?|ads)[_\-\s]+/i, "")
    .replace(/[_\-\s]+(campaigns?|ad[\s_-]?sets?|ads)$/i, "")
    .replace(/[_\-]+$/g, "");
  const collapsed = stem.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  // Title-case each word that is currently lower or all-upper, but leave
  // mixed-case tokens alone (preserves brand styling like "MedCerts").
  return collapsed
    .split(" ")
    .map((tok) => {
      if (!tok) return tok;
      if (/^[A-Z]+$/.test(tok)) return tok.charAt(0) + tok.slice(1).toLowerCase();
      if (/^[a-z]+$/.test(tok)) return tok.charAt(0).toUpperCase() + tok.slice(1);
      return tok;
    })
    .join(" ");
}

function formatRange(start: Date, end: Date): string {
  const startStr = formatLong(start);
  const endStr = formatLong(end);
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    // "April 18 – May 17, 2026" — drop the start year when both share it.
    const noYear = startStr.replace(`, ${start.getUTCFullYear()}`, "");
    return `${noYear} – ${endStr}`;
  }
  return `${startStr} – ${endStr}`;
}

function formatLong(d: Date): string {
  const mo = MONTHS_LONG[d.getUTCMonth()];
  return `${mo} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
