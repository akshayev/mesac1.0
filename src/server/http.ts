/** Small HTTP helpers for /admin/api and /media: JSON responses, admin headers, CSRF and body limits. */

/** Sent on every /admin and /admin/api response (pages, data and errors alike). */
export const ADMIN_HEADERS: Record<string, string> = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "x-frame-options": "DENY",
};

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...ADMIN_HEADERS },
  });
}

export const notFound = () => json({ error: "Not found" }, 404);

export function withAdminHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(ADMIN_HEADERS)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** The header the dashboard adds to every change. A plain HTML form on another site cannot send it. */
export const CSRF_HEADER = "x-mesac-admin";

/**
 * Cross-site request checks for anything that changes data: the Origin must be this site, the browser must
 * not report a cross-site request, and the custom header must be present. Returns a reason, or null if OK.
 */
export function csrfProblem(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return "missing Origin header";
  if (origin !== new URL(request.url).origin) return "request from another site";
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return "request from another site";
  if (request.headers.get(CSRF_HEADER) !== "1") return `missing ${CSRF_HEADER} header`;
  return null;
}

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Reads the whole body, refusing anything larger than maxBytes (whether or not Content-Length is sent). */
export async function readLimited(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new HttpError(413, `Too large (limit ${Math.round(maxBytes / 1024)} KB).`);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, `Too large (limit ${Math.round(maxBytes / 1024)} KB).`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** A JSON body: Content-Type must be application/json and the size within maxBytes. */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json(\s*;|$)/i.test(type))
    throw new HttpError(415, "Send JSON (Content-Type: application/json).");
  const bytes = await readLimited(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "The request body is not valid JSON.");
  }
}
