import { Creative } from "@/lib/types";

// Bump this when the `Creative` shape changes and add a corresponding step
// to MIGRATIONS so previously-persisted blobs continue to load.
export const CURRENT_VERSION = 1;

// Each step transforms shape v(N-1) into shape vN. Day 1 ships with no
// transforms; this is the slot where Step 4 (engagement fields) and Step 5
// (tag fields) will plug in.
//
// Steps receive `any[]` because the on-disk shape is by definition older than
// the current Creative type — that's the whole point of migrating.
const MIGRATIONS: Record<number, (rows: any[]) => any[]> = {};

export function migrateCreatives(
  stored: unknown,
  fromVersion: number,
): Creative[] | null {
  if (!Array.isArray(stored)) return null;
  // Refuse to load a blob written by a newer build than this one understands —
  // silently downgrading risks dropping fields the user cares about.
  if (fromVersion > CURRENT_VERSION) return null;

  let current: any[] = stored;
  for (let v = Math.max(fromVersion, 0) + 1; v <= CURRENT_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (step) current = step(current);
  }
  return current as Creative[];
}
