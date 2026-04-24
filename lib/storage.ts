import { AdAccount, DEFAULT_THRESHOLDS, Thresholds } from "./types";

const KEYS = {
  thresholds: "cpa.thresholds.v2",
  account: "cpa.account.v1",
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
