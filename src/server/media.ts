/**
 * Photos uploaded in the dashboard. The browser shrinks them to WebP (max 600 px) before upload; the server
 * still checks the real file type from its first bytes, the size, and stores it in R2 under a random name.
 * Public pages load them from /media/<name>, served by the Worker with a 7-day cache.
 */
import { MEDIA_PATH } from "../../scripts/lib/validate.mjs";
import { newId, photoReferences } from "./db.ts";
import type { AdminEnv, D1Database, R2Bucket } from "./env.ts";

export const MAX_UPLOAD_BYTES = 300 * 1024;

const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type ImageType = keyof typeof TYPES;

/** The image type from the file's magic bytes, or null. The declared Content-Type is not trusted. */
export function sniffImage(b: Uint8Array): ImageType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 8 && png.every((v, i) => b[i] === v)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

const EXT_TYPE: Record<string, ImageType> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** "/media/<32 hex>.webp" -> "<32 hex>.webp", anything else -> null. */
export function mediaKey(path: string): string | null {
  return MEDIA_PATH.test(path) ? path.slice("/media/".length) : null;
}

export function hasMedia(env: AdminEnv): env is AdminEnv & { MEDIA: R2Bucket } {
  const m = env.MEDIA as R2Bucket | undefined;
  return Boolean(m && typeof m.put === "function");
}

export type UploadResult =
  { ok: true; path: string } | { ok: false; status: number; error: string };

export async function storeUpload(
  env: AdminEnv,
  declaredType: string,
  bytes: Uint8Array,
): Promise<UploadResult> {
  if (!hasMedia(env))
    return { ok: false, status: 503, error: "Photo storage (R2) is not set up on this site yet." };
  const declared = declaredType.split(";")[0].trim().toLowerCase();
  if (!(declared in TYPES))
    return { ok: false, status: 415, error: "Only JPEG, PNG or WebP images." };
  if (bytes.byteLength === 0) return { ok: false, status: 400, error: "The file is empty." };
  if (bytes.byteLength > MAX_UPLOAD_BYTES)
    return { ok: false, status: 413, error: "The photo is larger than 300 KB." };
  const sniffed = sniffImage(bytes);
  if (!sniffed || sniffed !== declared)
    return { ok: false, status: 415, error: "The file is not a JPEG, PNG or WebP image." };
  const key = `${newId()}.${TYPES[sniffed]}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: sniffed } });
  return { ok: true, path: `/media/${key}` };
}

/** GET /media/<key> */
export async function serveMedia(request: Request, env: AdminEnv): Promise<Response> {
  const path = new URL(request.url).pathname;
  const key = mediaKey(path);
  const missing = () =>
    new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  if (!key || !hasMedia(env)) return missing();
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  const object = await env.MEDIA.get(key);
  if (!object) return missing();
  const type = EXT_TYPE[key.split(".")[1]];
  return new Response(request.method === "HEAD" ? null : object.body, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=604800",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "cross-origin-resource-policy": "same-origin",
    },
  });
}

/** Deletes an uploaded photo from R2 once no row uses it any more. Other kinds of links are left alone. */
export async function deletePhotoIfUnused(env: AdminEnv & { DB: D1Database }, path: unknown) {
  if (typeof path !== "string") return;
  const key = mediaKey(path);
  if (!key || !hasMedia(env)) return;
  if ((await photoReferences(env.DB, path)) === 0) await env.MEDIA.delete(key);
}
