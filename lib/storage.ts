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
  sidebarCollapsed: "cpa.sidebar.collapsed.v1",
  chartOrder: "cpa.chart.order.v1",
  chartHidden: "cpa.chart.hidden.v1",
  chartSizes: "cpa.chart.sizes.v1",
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

export function loadSidebarCollapsed(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(KEYS.sidebarCollapsed) === "1";
  } catch {
    return false;
  }
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEYS.sidebarCollapsed, collapsed ? "1" : "0");
}

export function loadChartOrder(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEYS.chartOrder);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveChartOrder(order: string[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEYS.chartOrder, JSON.stringify(order));
}

export function loadChartHidden(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEYS.chartHidden);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveChartHidden(hidden: string[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEYS.chartHidden, JSON.stringify(hidden));
}

export function loadChartSizes(): Record<string, "sm" | "md" | "lg"> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(KEYS.chartSizes);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const out: Record<string, "sm" | "md" | "lg"> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v === "sm" || v === "md" || v === "lg") out[k] = v;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveChartSizes(
  sizes: Record<string, "sm" | "md" | "lg">,
): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEYS.chartSizes, JSON.stringify(sizes));
}
