/**
 * What public pages show. With the D1 database bound, it comes from there (visible rows only; alumni also
 * need consent), cached for 60 seconds per Worker instance. Without it, it is the committed Sheet snapshot,
 * exactly as before the dashboard existed.
 */
import { listPublic, readSettings, type PublicContent } from "./db.ts";
import { hasDatabase, type AdminEnv } from "./env.ts";
import { SNAPSHOTS } from "./snapshots.ts";
import type { SettingsValues } from "../types/site.ts";

export type PublicKind = keyof PublicContent | "settings";
export type PublicData = PublicContent & { settings: SettingsValues };

export const PUBLIC_KINDS: PublicKind[] = [
  "team",
  "achievements",
  "placements",
  "alumni",
  "settings",
];
export const CACHE_MS = 60_000;

export function isPublicKind(v: unknown): v is PublicKind {
  return typeof v === "string" && (PUBLIC_KINDS as string[]).includes(v);
}

const cache = new Map<PublicKind, { at: number; value: unknown }>();

/** Called after every change made in the dashboard, so this Worker instance shows it at once. */
export function invalidatePublicCache() {
  cache.clear();
}

export async function getPublicContent<K extends PublicKind>(
  kind: K,
  env: AdminEnv,
  now = Date.now(),
): Promise<PublicData[K]> {
  if (!hasDatabase(env)) return SNAPSHOTS[kind] as PublicData[K];
  const hit = cache.get(kind);
  if (hit && now - hit.at < CACHE_MS) return hit.value as PublicData[K];
  try {
    const value = kind === "settings" ? await readSettings(env.DB) : await listPublic(env.DB, kind);
    cache.set(kind, { at: now, value });
    return value as PublicData[K];
  } catch (err) {
    // A database hiccup: keep showing the last good data rather than an error (never the sample snapshot).
    if (hit) {
      console.error(`public data: ${kind} read failed, serving cached copy`, err);
      return hit.value as PublicData[K];
    }
    throw err;
  }
}
