/**
 * The few Cloudflare runtime types the admin server uses (no @cloudflare/workers-types dependency), and how
 * to reach the Worker's bindings. nitro's Cloudflare handler puts them on request.runtime.cloudflare.env and
 * on globalThis.__env__ (bindings are the same for every request in an isolate).
 */

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: { changes?: number; last_row_id?: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

export interface R2ObjectBody {
  body: ReadableStream | null;
  httpMetadata?: { contentType?: string };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2ListedObject {
  key: string;
  uploaded: Date;
  size: number;
}

export interface R2Bucket {
  list(options?: { cursor?: string; limit?: number; prefix?: string }): Promise<{
    objects: R2ListedObject[];
    truncated: boolean;
    cursor?: string;
  }>;
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
}

export interface AdminEnv {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  /** Read only by dev-bypass.ts, which is removed from production builds. */
  [key: string]: unknown;
}

type RequestWithRuntime = Request & { runtime?: { cloudflare?: { env?: AdminEnv } } };

/** The Worker's bindings, or {} when running outside Cloudflare (vite dev, Node). */
export function getEnv(request?: Request): AdminEnv {
  const fromRequest = (request as RequestWithRuntime | undefined)?.runtime?.cloudflare?.env;
  const fromGlobal = (globalThis as { __env__?: AdminEnv }).__env__;
  return fromRequest ?? fromGlobal ?? {};
}

/** True when the D1 database is bound, i.e. the admin dashboard and D1-backed pages are switched on. */
export function hasDatabase(env: AdminEnv): env is AdminEnv & { DB: D1Database } {
  const db = env.DB as D1Database | undefined;
  return Boolean(db && typeof db.prepare === "function");
}
