/**
 * Who is calling /admin/api?
 *
 * Cloudflare Access sits in front of /admin* and lets only the allowed emails through (one-time PIN login).
 * It then adds a signed token (Cf-Access-Jwt-Assertion). We check that token ourselves (RS256 signature
 * against Access's published keys, issuer, audience, expiry) and then require the email to be an active row
 * in the admins table. Anything missing or wrong is denied.
 */
import { accessAud, normalizeTeamDomain, strictEmail } from "../../scripts/lib/validate.mjs";

export { normalizeTeamDomain };
import { findAdmin, type Role } from "./db.ts";
import { devBypassEmail } from "./dev-bypass.ts";
import { hasDatabase, type AdminEnv } from "./env.ts";

export interface AccessConfig {
  /** e.g. mesac.cloudflareaccess.com */
  teamDomain: string;
  /** The Access application's Audience (AUD) tag. */
  aud: string;
}

export function accessConfig(env: AdminEnv): AccessConfig | null {
  const teamDomain = normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const aud = accessAud(env.CF_ACCESS_AUD);
  if (!teamDomain || !aud) return null;
  return { teamDomain, aud };
}

export interface VerifyDeps {
  fetchFn?: typeof fetch;
  now?: number;
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

const JWKS_TTL_MS = 5 * 60_000;
const REFETCH_GAP_MS = 30_000;
const SKEW_S = 60;
const jwksCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();
const keyCache = new Map<string, CryptoKey>();

/** For tests. */
export function clearJwksCache() {
  jwksCache.clear();
  keyCache.clear();
}

async function fetchJwks(teamDomain: string, fetchFn: typeof fetch, now: number): Promise<Jwk[]> {
  const res = await fetchFn(`https://${teamDomain}/cdn-cgi/access/certs`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Access keys: HTTP ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = Array.isArray(body.keys) ? body.keys.filter((k) => k.kty === "RSA" && k.kid) : [];
  jwksCache.set(teamDomain, { keys, fetchedAt: now });
  return keys;
}

async function keyFor(teamDomain: string, kid: string, deps: Required<VerifyDeps>) {
  let cached = jwksCache.get(teamDomain);
  if (!cached || deps.now - cached.fetchedAt > JWKS_TTL_MS) {
    await fetchJwks(teamDomain, deps.fetchFn, deps.now);
    cached = jwksCache.get(teamDomain);
  }
  let jwk = cached?.keys.find((k) => k.kid === kid);
  // Keys rotate: an unknown kid triggers one early refetch (at most every 30 s).
  if (!jwk && cached && deps.now - cached.fetchedAt > REFETCH_GAP_MS) {
    const keys = await fetchJwks(teamDomain, deps.fetchFn, deps.now);
    jwk = keys.find((k) => k.kid === kid);
  }
  if (!jwk) return null;
  const cacheKey = `${teamDomain}#${kid}#${jwk.n}`;
  let key = keyCache.get(cacheKey);
  if (!key) {
    key = await crypto.subtle.importKey(
      "jwk",
      { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    keyCache.set(cacheKey, key);
  }
  return key;
}

function b64urlBytes(s: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("bad base64url");
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const b64urlJson = (s: string) =>
  JSON.parse(new TextDecoder().decode(b64urlBytes(s))) as Record<string, unknown>;

/** Returns the verified email, or the reason the token was rejected. */
export async function verifyAccessJwt(
  token: string,
  cfg: AccessConfig,
  deps: VerifyDeps = {},
): Promise<{ email: string } | { error: string }> {
  const d = { fetchFn: deps.fetchFn ?? fetch, now: deps.now ?? Date.now() };
  const parts = token.split(".");
  if (parts.length !== 3 || token.length > 8192) return { error: "malformed token" };
  let header: Record<string, unknown>;
  let claims: Record<string, unknown>;
  let signature: Uint8Array<ArrayBuffer>;
  try {
    header = b64urlJson(parts[0]);
    claims = b64urlJson(parts[1]);
    signature = b64urlBytes(parts[2]);
  } catch {
    return { error: "malformed token" };
  }
  if (header.alg !== "RS256") return { error: "unexpected algorithm" };
  if (typeof header.kid !== "string" || !header.kid) return { error: "missing key id" };

  let key: CryptoKey | null;
  try {
    key = await keyFor(cfg.teamDomain, header.kid, d);
  } catch {
    return { error: "could not load Access keys" };
  }
  if (!key) return { error: "unknown key id" };
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed);
  if (!ok) return { error: "bad signature" };

  const nowS = Math.floor(d.now / 1000);
  if (claims.iss !== `https://${cfg.teamDomain}`) return { error: "wrong issuer" };
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(cfg.aud)) return { error: "wrong audience" };
  if (typeof claims.exp !== "number" || claims.exp < nowS - SKEW_S) return { error: "expired" };
  if (claims.nbf !== undefined && (typeof claims.nbf !== "number" || claims.nbf > nowS + SKEW_S))
    return { error: "not valid yet" };
  const email = strictEmail(claims.email);
  if (!email) return { error: "no email in token" };
  return { email };
}

export interface AdminUser {
  email: string;
  role: Role;
}

export type AuthResult =
  { ok: true; user: AdminUser } | { ok: false; status: 401 | 403 | 404; reason: string };

/** Default deny: every path that is not a verified, active admin returns a refusal. */
export async function authenticate(
  request: Request,
  env: AdminEnv,
  deps: VerifyDeps = {},
): Promise<AuthResult> {
  if (!hasDatabase(env)) return { ok: false, status: 404, reason: "not found" };

  // Removed at build time unless this is a local development build (see dev-bypass.ts).
  const devEmail = __MESAC_DEV_ADMIN__ ? devBypassEmail(request, env) : null;

  let email = devEmail;
  if (!email) {
    const cfg = accessConfig(env);
    if (!cfg)
      return { ok: false, status: 403, reason: "Admin sign-in is not configured on this site." };
    const token = request.headers.get("cf-access-jwt-assertion");
    if (!token) return { ok: false, status: 401, reason: "Not signed in." };
    const result = await verifyAccessJwt(token, cfg, deps);
    if ("error" in result)
      return { ok: false, status: 401, reason: "Sign-in could not be verified." };
    email = result.email;
  }
  const account = await findAdmin(env.DB, email);
  if (!account || !account.active)
    return { ok: false, status: 403, reason: "This email is not on the admin list." };
  return { ok: true, user: { email: account.email, role: account.role } };
}

/** editor < admin. */
export function hasRole(user: AdminUser, needed: Role): boolean {
  return needed === "editor" || user.role === "admin";
}
