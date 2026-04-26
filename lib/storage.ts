import { AdAccount, DEFAULT_THRESHOLDS, Thresholds } from "./types";
import {
  CreativeMatchOverrides,
  EMPTY_RPL_OVERRIDES,
  RplOverrides,
} from "./schools";

const KEYS = {
  thresholds: "cpa.thresholds.v2",
  account: "cpa.account.v1",
  rplOverrides: "cpa.rpl.v1",
  matchOverrides: "cpa.matches.v1",
} as const;

function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadThresholds(): Thresholds {
  if (!isBrowser()) return DEFAULT_THRESHOLDS;
  try {
    const raw = window.localStorage.getItem(KEYS.thresholds);
    if (!raw) return DEFAULT_THRESHOLDS;
    const parsed = JSON.parse(raw) as Partial<Thresholds>;
    return { ...DEFAULT_THRESHOLDS, ...parsed };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export function saveThresholds(t: Thresholds): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEYS.thresholds, JSON.stringify(t));
}

export function loadAccount(): AdAccount | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(KEYS.account);
    if (!raw) return null;
    return JSON.parse(raw) as AdAccount;
  } catch {
    return null;
  }
}

export function saveAccount(a: AdAccount): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEYS.account, JSON.stringify(a));
}

export function loadRplOverrides(): RplOverrides {
  if (!isBrowser()) return EMPTY_RPL_OVERRIDES;
  try {
    const raw = window.localStorage.getItem(KEYS.rplOverrides);
    if (!raw) return EMPTY_RPL_OVERRIDES;
    const parsed = JSON.parse(raw) as Partial<RplOverrides>;
    return {
      schools: parsed.schools ?? {},
      programs: parsed.programs ?? {},
    };
  } catch {
    return EMPTY_RPL_OVERRIDES;
  }
}

export function saveRplOverrides(o: RplOverrides): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEYS.rplOverrides, JSON.stringify(o));
}

export function loadMatchOverrides(): CreativeMatchOverrides {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(KEYS.matchOverrides);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CreativeMatchOverrides;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveMatchOverrides(o: CreativeMatchOverrides): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEYS.matchOverrides, JSON.stringify(o));
}
