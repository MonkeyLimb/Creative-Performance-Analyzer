import { Creative } from "@/lib/types";
import { CURRENT_VERSION, migrateCreatives } from "./migrations";

export const CREATIVES_KEY = "cpa.creatives.v1";

// Thin abstraction over the underlying byte store. Pure CRUD over a typed
// list of Creatives, with migration handled inside `load` so callers always
// see today's shape. Swap the localStorage implementation for a Supabase
// one later by passing a different backend.
export interface CreativeStore {
  load(): Creative[] | null;
  save(creatives: Creative[]): void;
  clear(): void;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function localStorageCreativeStore(): CreativeStore {
  return {
    load() {
      if (!isBrowser()) return null;
      try {
        const raw = window.localStorage.getItem(CREATIVES_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        const version =
          typeof parsed.version === "number" ? parsed.version : 0;
        const stored = Array.isArray(parsed.creatives) ? parsed.creatives : [];
        return migrateCreatives(stored, version);
      } catch {
        return null;
      }
    },
    save(creatives) {
      if (!isBrowser()) return;
      try {
        const blob = { version: CURRENT_VERSION, creatives };
        window.localStorage.setItem(CREATIVES_KEY, JSON.stringify(blob));
      } catch {
        // Quota exceeded or other serialization error — best-effort persistence.
      }
    },
    clear() {
      if (!isBrowser()) return;
      try {
        window.localStorage.removeItem(CREATIVES_KEY);
      } catch {
        // Ignored — clearing storage shouldn't crash the app.
      }
    },
  };
}
