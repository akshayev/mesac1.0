/** Calls to /admin/api from the dashboard. Every change carries the anti-CSRF header the server requires. */

export class ApiError extends Error {
  status: number;
  errors: Record<string, string>;
  constructor(status: number, message: string, errors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export interface Me {
  email: string;
  role: "admin" | "editor";
  uploads: boolean;
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "x-mesac-admin": "1" };
  let payload: BodyInit | undefined;
  if (body instanceof Blob) {
    headers["content-type"] = body.type;
    payload = body;
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`/admin/api${path}`, {
    method,
    headers,
    body: payload,
    credentials: "same-origin",
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; errors?: Record<string, string> };
    const message =
      d.error ??
      (d.errors ? "Please fix the highlighted fields." : `Request failed (HTTP ${res.status}).`);
    throw new ApiError(res.status, message, d.errors ?? {});
  }
  return data as T;
}

export const errorText = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong.";
