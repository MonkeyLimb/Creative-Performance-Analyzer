const KEY = "cpa.metaToken.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadMetaToken(): string {
  if (!isBrowser()) return "";
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveMetaToken(token: string): void {
  if (!isBrowser()) return;
  if (token) window.localStorage.setItem(KEY, token);
  else window.localStorage.removeItem(KEY);
}
