/**
 * Finds and deletes uploaded photos that no row uses any more (admin only). Looks only at names that the
 * upload code creates (32 hex characters + .webp/.jpg/.png), never at anything else in the bucket, and keeps
 * anything younger than 24 hours (someone may be in the middle of editing).
 */
import { MEDIA_PATH } from "../../scripts/lib/validate.mjs";
import type { AdminEnv, D1Database, R2Bucket } from "./env.ts";
import { MEDIA_REFERENCED_SQL } from "./sql.ts";

export const MIN_AGE_MS = 24 * 60 * 60 * 1000;
export const PAGE_SIZE = 1000;
export const MAX_PAGES = 5;
export const MAX_DELETE = 1000;

type Env = AdminEnv & { DB: D1Database; MEDIA: R2Bucket };

export interface UnusedScan {
  /** Keys that would be deleted (kept on the server; only counts go to the browser). */
  keys: string[];
  unused: number;
  tooNew: number;
  scanned: number;
  bytes: number;
  /** More objects than one run looks at; run it again afterwards. */
  truncated: boolean;
}

export async function findUnused(
  env: Env,
  now = Date.now(),
  minAgeMs = MIN_AGE_MS,
): Promise<UnusedScan> {
  const { results } = await env.DB.prepare(MEDIA_REFERENCED_SQL).all<{ path: string }>();
  const used = new Set(results.map((r) => r.path));
  const scan: UnusedScan = {
    keys: [],
    unused: 0,
    tooNew: 0,
    scanned: 0,
    bytes: 0,
    truncated: false,
  };
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const listed = await env.MEDIA.list({ cursor, limit: PAGE_SIZE });
    for (const o of listed.objects) {
      scan.scanned++;
      const path = `/media/${o.key}`;
      if (!MEDIA_PATH.test(path) || used.has(path)) continue;
      if (now - new Date(o.uploaded).getTime() < minAgeMs) {
        scan.tooNew++;
        continue;
      }
      scan.unused++;
      scan.bytes += o.size ?? 0;
      scan.keys.push(o.key);
    }
    if (!listed.truncated) return scan;
    cursor = listed.cursor;
  }
  scan.truncated = true;
  return scan;
}

/** Deletes at most MAX_DELETE unused photos (re-checked now, not taken from the browser). */
export async function deleteUnused(env: Env, now = Date.now(), minAgeMs = MIN_AGE_MS) {
  const scan = await findUnused(env, now, minAgeMs);
  const keys = scan.keys.slice(0, MAX_DELETE);
  if (keys.length) await env.MEDIA.delete(keys);
  return { deleted: keys.length, remaining: scan.unused - keys.length, truncated: scan.truncated };
}
