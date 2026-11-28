// Cloudflare Access token checks and the admins table (src/server/auth.ts).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { migratedDb } from "./d1-shim.mjs";
import { AUD, TEAM, makeAccess } from "./access-jwt.mjs";
import {
  accessConfig,
  authenticate,
  clearJwksCache,
  hasRole,
  normalizeTeamDomain,
  verifyAccessJwt,
} from "../../src/server/auth.ts";
import { createAdmin, updateAdmin } from "../../src/server/db.ts";

const access = await makeAccess();
const cfg = { teamDomain: TEAM, aud: AUD };
const deps = { fetchFn: access.fetchFn };
beforeEach(() => clearJwksCache());

async function setup() {
  const DB = migratedDb();
  const admin = await createAdmin(DB, { email: "admin@example.com", role: "admin" }, "test");
  await createAdmin(DB, { email: "editor@example.com", role: "editor" }, "test");
  const env = { DB, CF_ACCESS_TEAM_DOMAIN: "sample-team", CF_ACCESS_AUD: AUD };
  return { env, DB, adminId: admin.account.id };
}

const req = (token, url = "https://mesac.example.org/admin/api/me") =>
  new Request(url, token ? { headers: { "cf-access-jwt-assertion": token } } : {});

test("team domain and AUD are normalised and strictly checked", () => {
  for (const v of [
    "sample-team",
    "sample-team.cloudflareaccess.com",
    "https://Sample-Team.cloudflareaccess.com/",
  ])
    assert.equal(normalizeTeamDomain(v), TEAM, v);
  for (const v of [
    "",
    "evil.com",
    "sample-team.cloudflareaccess.com.evil.com",
    "a/b",
    "https://x.cloudflareaccess.com/path",
  ])
    assert.equal(normalizeTeamDomain(v), "", v);
  assert.equal(
    accessConfig({ CF_ACCESS_TEAM_DOMAIN: "sample-team", CF_ACCESS_AUD: "short" }),
    null,
  );
  assert.deepEqual(accessConfig({ CF_ACCESS_TEAM_DOMAIN: "sample-team", CF_ACCESS_AUD: AUD }), cfg);
});

test("a valid token is accepted and the keys are cached", async () => {
  assert.deepEqual(await verifyAccessJwt(await access.token(), cfg, deps), {
    email: "admin@example.com",
  });
  const before = access.state.fetches;
  await verifyAccessJwt(await access.token(), cfg, deps);
  assert.equal(access.state.fetches, before);
  // audience as a single string is also fine
  assert.ok("email" in (await verifyAccessJwt(await access.token({ aud: AUD }), cfg, deps)));
});

test("bad tokens are rejected", async () => {
  const now = Math.floor(Date.now() / 1000);
  const cases = {
    expired: await access.token({ exp: now - 3600 }),
    "not valid yet": await access.token({ nbf: now + 3600 }),
    "wrong audience": await access.token({ aud: ["b".repeat(64)] }),
    "wrong issuer": await access.token({ iss: "https://other.cloudflareaccess.com" }),
    "unknown key id": await access.token({}, { kid: "kid-unknown" }),
    "bad signature": await access.token({}, { key: access.otherKey }),
    "unexpected algorithm": (await access.token()).replace(
      /^[^.]+/,
      Buffer.from(JSON.stringify({ alg: "none", kid: "kid-1" })).toString("base64url"),
    ),
    "no email in token": await access.token({ email: undefined }),
    "missing key id": await access.token({}, { kid: "" }),
  };
  for (const [reason, token] of Object.entries(cases)) {
    const r = await verifyAccessJwt(token, cfg, deps);
    assert.equal(r.error, reason, reason);
  }
  assert.equal((await verifyAccessJwt("a.b", cfg, deps)).error, "malformed token");
  assert.equal((await verifyAccessJwt("!!.!!.!!", cfg, deps)).error, "malformed token");
});

test("a rotated key is picked up after the refetch gap", async () => {
  const t0 = Date.now();
  await verifyAccessJwt(await access.token(), cfg, { ...deps, now: t0 });
  const rotated = { ...access.state.keys[0], kid: "kid-2" };
  access.state.keys = [access.state.keys[0], rotated];
  const token = await access.token({}, { kid: "kid-2" });
  assert.equal(
    (await verifyAccessJwt(token, cfg, { ...deps, now: t0 + 1000 })).error,
    "unknown key id",
  );
  assert.ok("email" in (await verifyAccessJwt(token, cfg, { ...deps, now: t0 + 31_000 })));
  access.state.keys = [access.state.keys[0]];
});

test("authenticate: default deny for every missing piece", async () => {
  const { env, DB, adminId } = await setup();
  assert.equal(
    (await authenticate(req(await access.token()), { ...env, DB: undefined }, deps)).status,
    404,
  );
  assert.equal(
    (await authenticate(req(await access.token()), { DB }, deps)).status,
    403,
    "Access not configured",
  );
  assert.equal((await authenticate(req(null), env, deps)).status, 401, "no token");
  assert.equal((await authenticate(req("x.y.z"), env, deps)).status, 401, "garbage token");
  assert.equal(
    (await authenticate(req(await access.token({ email: "stranger@example.com" })), env, deps))
      .status,
    403,
    "not in admins",
  );
  const ok = await authenticate(req(await access.token({ email: "ADMIN@example.com" })), env, deps);
  assert.deepEqual(ok, { ok: true, user: { email: "admin@example.com", role: "admin" } });
  const editor = await authenticate(
    req(await access.token({ email: "editor@example.com" })),
    env,
    deps,
  );
  assert.equal(editor.user.role, "editor");
  await createAdmin(DB, { email: "second@example.com", role: "admin" }, "test");
  await updateAdmin(DB, adminId, { active: false }, "test");
  assert.equal(
    (await authenticate(req(await access.token()), env, deps)).status,
    403,
    "inactive admin",
  );
});

test("roles: editor < admin", () => {
  assert.equal(hasRole({ role: "editor" }, "editor"), true);
  assert.equal(hasRole({ role: "editor" }, "admin"), false);
  assert.equal(hasRole({ role: "admin" }, "admin"), true);
});

test("dev bypass: off unless the build flag is on, and only on localhost", async () => {
  const { env } = await setup();
  const devEnv = {
    ...env,
    CF_ACCESS_TEAM_DOMAIN: undefined,
    CF_ACCESS_AUD: undefined,
    ADMIN_DEV_EMAIL: "editor@example.com",
  };
  const local = req(null, "http://localhost:8787/admin/api/me");
  try {
    globalThis.__MESAC_DEV_ADMIN__ = false;
    assert.equal((await authenticate(local, devEnv, deps)).ok, false, "flag off");
    globalThis.__MESAC_DEV_ADMIN__ = true;
    assert.equal((await authenticate(local, devEnv, deps)).user.email, "editor@example.com");
    assert.equal(
      (await authenticate(req(null, "https://mesac.example.org/admin/api/me"), devEnv, deps)).ok,
      false,
      "not localhost",
    );
    assert.equal(
      (await authenticate(local, { ...devEnv, ADMIN_DEV_EMAIL: "stranger@example.com" }, deps))
        .status,
      403,
      "still needs an admins row",
    );
  } finally {
    globalThis.__MESAC_DEV_ADMIN__ = false;
  }
});
