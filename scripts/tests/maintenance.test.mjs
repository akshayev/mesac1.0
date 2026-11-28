// "Refresh papers now" (src/server/refresh.ts, mocked GitHub) and unused-photo cleanup
// (src/server/media-cleanup.ts, R2 shim). Console output is captured: the token must never appear.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { R2Shim, migratedDb } from "./d1-shim.mjs";
import { AUD, makeAccess } from "./access-jwt.mjs";
import { handleServerRoute } from "../../src/server/routes.ts";
import { createAdmin, createContent, readSettings } from "../../src/server/db.ts";
import { refreshConfig } from "../../src/server/refresh.ts";

const ORIGIN = "https://mesac.example.org";
const TOKEN = "github_pat_SAMPLEtokenForTestsOnly_abcdefghijklmnopqrstuvwxyz0123456789";
const access = await makeAccess();
let logs;
const saved = {};
beforeEach(() => {
  logs = [];
  for (const k of ["log", "info", "warn", "error", "debug"]) {
    saved[k] = console[k];
    console[k] = (...a) => logs.push(a.map(String).join(" "));
  }
});
afterEach(() => {
  Object.assign(console, saved);
  for (const l of logs) assert.doesNotMatch(l, /github_pat_|SAMPLEtoken/);
});

function github(mode = 204) {
  const state = { calls: [] };
  const fetchFn = async (url, init = {}) => {
    if (String(url).includes("cloudflareaccess.com")) return access.fetchFn(url, init);
    state.calls.push({ url, init });
    if (mode === "throw") throw new Error("network down");
    if (mode === "hang")
      return new Promise((_, reject) =>
        init.signal.addEventListener("abort", () => reject(init.signal.reason)),
      );
    if (mode === "ratelimit")
      return new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0" } });
    return new Response(mode === 204 ? null : "{}", { status: mode });
  };
  return { state, fetchFn };
}

async function site({ env: extra = {}, mode = 204, media = true } = {}) {
  const DB = migratedDb();
  await createAdmin(DB, { email: "admin@example.com", role: "admin" }, "t");
  await createAdmin(DB, { email: "editor@example.com", role: "editor" }, "t");
  const env = {
    DB,
    CF_ACCESS_TEAM_DOMAIN: "sample-team",
    CF_ACCESS_AUD: AUD,
    GITHUB_REPO: "sample-org/sample-site",
    GITHUB_WORKFLOW_FILE: "deploy.yml",
    GITHUB_DISPATCH_TOKEN: TOKEN,
    ...extra,
  };
  if (media) env.MEDIA = new R2Shim();
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
  const gh = github(mode);
  const clock = { now: Date.parse("2026-12-01T10:00:00Z") };
  const deps = { fetchFn: gh.fetchFn, nowMs: () => clock.now, timeoutMs: 50 };
  const tokens = {
    admin: await access.token({ email: "admin@example.com" }),
    editor: await access.token({ email: "editor@example.com" }),
  };
  async function call(method, path, as = "admin") {
    const h = { "cf-access-jwt-assertion": tokens[as] };
    if (method !== "GET")
      Object.assign(h, {
        origin: ORIGIN,
        "x-mesac-admin": "1",
        "content-type": "application/json",
      });
    const res = await handleServerRoute(
      new Request(`${ORIGIN}/admin/api${path}`, {
        method,
        headers: h,
        body: method === "GET" ? undefined : "{}",
      }),
      env,
      deps,
    );
    const text = await res.text();
    assert.doesNotMatch(text, /github_pat_|SAMPLEtoken/, "token in a response");
    return { status: res.status, data: JSON.parse(text) };
  }
  return { env, DB, gh, clock, call };
}

test("refresh config: on only with token, repo and workflow; link otherwise", () => {
  assert.deepEqual(
    refreshConfig({
      GITHUB_REPO: "sample-org/sample-site",
      GITHUB_WORKFLOW_FILE: "deploy.yml",
      GITHUB_DISPATCH_TOKEN: TOKEN,
    }),
    {
      enabled: true,
      actionsUrl: "https://github.com/sample-org/sample-site/actions/workflows/deploy.yml",
    },
  );
  assert.deepEqual(
    refreshConfig({ GITHUB_REPO: "sample-org/sample-site", GITHUB_WORKFLOW_FILE: "deploy.yml" }),
    {
      enabled: false,
      actionsUrl: "https://github.com/sample-org/sample-site/actions/workflows/deploy.yml",
    },
  );
  assert.deepEqual(refreshConfig({}), { enabled: false, actionsUrl: null });
  for (const repo of ["evil.com/x/y", "../x", "a/b/c", "sample-org/site.git"])
    assert.equal(
      refreshConfig({
        GITHUB_REPO: repo,
        GITHUB_WORKFLOW_FILE: "deploy.yml",
        GITHUB_DISPATCH_TOKEN: TOKEN,
      }).enabled,
      false,
      repo,
    );
});

test("refresh: one exact request to api.github.com, audit without details, then a 5-minute wait", async () => {
  const s = await site();
  const me = await s.call("GET", "/me", "editor");
  assert.equal(me.data.refresh.enabled, true);
  const r = await s.call("POST", "/refresh-papers", "editor");
  assert.deepEqual([r.status, r.data.ok], [200, true]);
  assert.equal(s.gh.state.calls.length, 1);
  const { url, init } = s.gh.state.calls[0];
  assert.equal(
    url,
    "https://api.github.com/repos/sample-org/sample-site/actions/workflows/deploy.yml/dispatches",
  );
  assert.equal(init.method, "POST");
  assert.equal(init.headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(init.headers.accept, "application/vnd.github+json");
  assert.ok(init.headers["user-agent"]);
  assert.deepEqual(JSON.parse(init.body), { ref: "main" });

  const again = await s.call("POST", "/refresh-papers");
  assert.equal(again.status, 429);
  assert.match(again.data.error, /wait a few minutes/);
  assert.equal(s.gh.state.calls.length, 1, "no second request");
  s.clock.now += 5 * 60_000 + 1;
  assert.equal((await s.call("POST", "/refresh-papers")).status, 200);

  const audit = s.DB.sqlite
    .prepare("SELECT action, entity, label, changed_fields FROM audit_log WHERE entity = 'papers'")
    .all()
    .map((x) => ({ ...x }));
  assert.deepEqual(audit, [
    { action: "refresh_papers", entity: "papers", label: null, changed_fields: "[]" },
    { action: "refresh_papers", entity: "papers", label: null, changed_fields: "[]" },
  ]);
  assert.deepEqual(await readSettings(s.DB), {}, "the internal key is not a public setting");
  assert.doesNotMatch(
    JSON.stringify(s.DB.sqlite.prepare("SELECT * FROM audit_log").all()),
    /github_pat_/,
  );
});

test("refresh: GitHub errors give friendly messages and free the slot", async () => {
  const cases = [
    [401, /did not accept the saved token/],
    [403, /may not start workflows/],
    ["ratelimit", /rate limit/],
    [429, /rate limit/],
    [404, /could not find/],
    [422, /refused to start/],
    [500, /answered with an error/],
    ["throw", /did not answer/],
    ["hang", /did not answer/],
  ];
  for (const [mode, re] of cases) {
    const s = await site({ mode });
    const r = await s.call("POST", "/refresh-papers");
    assert.ok(r.status >= 500, `${mode}: ${r.status}`);
    assert.match(r.data.error, re, String(mode));
    // Nothing started, so a retry is allowed at once.
    const retry = await s.call("POST", "/refresh-papers");
    assert.notEqual(retry.status, 429, `${mode}: slot released`);
  }
});

test("refresh: 404 when not configured; editors allowed; CSRF applies", async () => {
  const off = await site({ env: { GITHUB_DISPATCH_TOKEN: undefined } });
  assert.equal((await off.call("POST", "/refresh-papers")).status, 404);
  assert.equal((await off.call("GET", "/me")).data.refresh.enabled, false);
  assert.equal(off.gh.state.calls.length, 0);
  const s = await site();
  const res = await handleServerRoute(
    new Request(`${ORIGIN}/admin/api/refresh-papers`, {
      method: "POST",
      headers: {
        "cf-access-jwt-assertion": await access.token({ email: "editor@example.com" }),
        "content-type": "application/json",
      },
      body: "{}",
    }),
    s.env,
    { fetchFn: s.gh.fetchFn },
  );
  assert.equal(res.status, 403, "no Origin / custom header");
  assert.equal(s.gh.state.calls.length, 0);
});

const OLD = new Date("2026-11-01T00:00:00Z");
const hex = (n) => n.toString(16).padStart(32, "0");

async function seedPhotos(s) {
  const put = (key, uploaded) =>
    s.env.MEDIA.put(key, new Uint8Array(2048), {
      httpMetadata: { contentType: "image/webp" },
      uploaded,
    });
  await put(`${hex(1)}.webp`, OLD); // orphan, old -> deleted
  await put(`${hex(2)}.webp`, new Date(s.clock.now - 60_000)); // orphan, new -> kept
  await put(`${hex(3)}.webp`, OLD); // used by a team member
  await put(`${hex(4)}.jpg`, OLD); // used by a pending submission
  await put("notes/readme.txt", OLD); // not ours -> never touched
  await createContent(s.DB, "team", { name: "SAMPLE", photo: `/media/${hex(3)}.webp` }, "t");
  s.DB.sqlite
    .prepare(
      "INSERT INTO alumni_submissions (id, created_at, name, photo, consent_text_version, consent_at) VALUES (?, 't', 'SAMPLE', ?, 'v', 't')",
    )
    .run(hex(9), `/media/${hex(4)}.jpg`);
}

test("cleanup: counts first, deletes only old unreferenced media keys, audit has counts only", async () => {
  const s = await site();
  await seedPhotos(s);
  const scan = await s.call("GET", "/media/unused");
  assert.deepEqual(scan.data, { unused: 1, tooNew: 1, scanned: 5, bytes: 2048, truncated: false });
  const done = await s.call("POST", "/media/cleanup");
  assert.deepEqual(done.data, { deleted: 1, remaining: 0, truncated: false });
  assert.deepEqual(
    [...s.env.MEDIA.objects.keys()].sort(),
    [`${hex(2)}.webp`, `${hex(3)}.webp`, `${hex(4)}.jpg`, "notes/readme.txt"].sort(),
  );
  const [entry] = s.DB.sqlite
    .prepare("SELECT label, changed_fields FROM audit_log WHERE action = 'cleanup'")
    .all();
  assert.deepEqual({ ...entry }, { label: "1 deleted", changed_fields: "[]" });
});

test("cleanup: admin only, explains when R2 is missing, caps one run", async () => {
  const s = await site();
  assert.equal((await s.call("GET", "/media/unused", "editor")).status, 403);
  assert.equal((await s.call("POST", "/media/cleanup", "editor")).status, 403);
  const noR2 = await site({ media: false });
  const r = await noR2.call("GET", "/media/unused");
  assert.equal(r.status, 503);
  assert.match(r.data.error, /R2/);

  const big = await site();
  for (let i = 0; i < 5200; i++)
    await big.env.MEDIA.put(`${hex(100000 + i)}.webp`, new Uint8Array(1), { uploaded: OLD });
  const scan = await big.call("GET", "/media/unused");
  assert.equal(scan.data.scanned, 5000);
  assert.equal(scan.data.truncated, true);
  const first = await big.call("POST", "/media/cleanup");
  assert.equal(first.data.deleted, 1000);
  assert.equal(big.env.MEDIA.objects.size, 4200);
});
