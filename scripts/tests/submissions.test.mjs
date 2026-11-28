// The public alumni form (/api/alumni-submission) and its review queue (src/server/submissions.ts).
// Turnstile's siteverify endpoint is mocked; console output is captured to prove no personal data is logged.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { migratedDb } from "./d1-shim.mjs";
import { AUD, makeAccess } from "./access-jwt.mjs";
import { handleServerRoute } from "../../src/server/routes.ts";
import { createAdmin } from "../../src/server/db.ts";
import { getPublicContent, invalidatePublicCache } from "../../src/server/public-data.ts";
import { hashIp, submissionConfig, verifyTurnstile } from "../../src/server/submissions.ts";
import { CONSENT_TEXT_VERSION } from "../../src/shared/consent.ts";

const ORIGIN = "https://mesac.example.org";
const SECRET = "0x-sample-turnstile-secret-for-tests-only";
const SALT = "sample-salt-for-tests-0123456789abcdef";
const access = await makeAccess();

// Values that must never show up in logs, the audit log or responses that are not about them.
const PII = {
  name: "SAMPLE Priya Formfill",
  batch: "2015",
  company: "SAMPLE Formco",
  email: "sample.formfill@example.com",
  phone: "90000 00555",
};
const PII_PATTERNS = [/Formfill/, /Formco/, /sample\.formfill/, /0000\s?00555/, /9000000555/];

let logs;
const originals = {};
beforeEach(() => {
  logs = [];
  for (const k of ["log", "info", "warn", "error", "debug"]) {
    originals[k] = console[k];
    console[k] = (...args) =>
      logs.push(
        args
          .map((a) =>
            a instanceof Error
              ? `${a.message} ${a.stack}`
              : typeof a === "string"
                ? a
                : JSON.stringify(a),
          )
          .join(" "),
      );
  }
});
afterEach(() => {
  Object.assign(console, originals);
  for (const line of logs)
    for (const p of PII_PATTERNS) assert.doesNotMatch(line, p, "personal data in a log line");
});

function turnstile(mode = "pass") {
  const state = { mode, calls: [] };
  const fetchFn = async (url, init = {}) => {
    if (String(url).includes("cloudflareaccess.com")) return access.fetchFn(url, init);
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    state.calls.push({ secret: init.body.get("secret"), response: init.body.get("response") });
    if (state.mode === "throw") throw new Error("network down");
    if (state.mode === "500") return new Response("oops", { status: 500 });
    if (state.mode === "hang")
      return new Promise((_, reject) =>
        init.signal.addEventListener("abort", () => reject(init.signal.reason)),
      );
    return Response.json({ success: state.mode === "pass", "error-codes": [] });
  };
  return { state, fetchFn };
}

async function site({ env: extra = {}, mode = "pass" } = {}) {
  const DB = migratedDb();
  await createAdmin(DB, { email: "admin@example.com", role: "admin" }, "test");
  await createAdmin(DB, { email: "editor@example.com", role: "editor" }, "test");
  const env = {
    DB,
    CF_ACCESS_TEAM_DOMAIN: "sample-team",
    CF_ACCESS_AUD: AUD,
    TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    TURNSTILE_SECRET_KEY: SECRET,
    SUBMISSION_SALT: SALT,
    ...extra,
  };
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
  const ts = turnstile(mode);
  const clock = { now: Date.parse("2026-12-01T10:00:00Z") };
  const deps = { fetchFn: ts.fetchFn, nowMs: () => clock.now, timeoutMs: 50 };
  const tokens = {
    admin: await access.token({ email: "admin@example.com" }),
    editor: await access.token({ email: "editor@example.com" }),
  };
  async function submit(body = {}, { ip = "203.0.113.7", headers = {}, raw } = {}) {
    const h = {
      origin: ORIGIN,
      "x-mesac-form": "1",
      "content-type": "application/json",
      "cf-connecting-ip": ip,
      ...headers,
    };
    for (const [k, v] of Object.entries(h)) if (v === null) delete h[k];
    const full = {
      ...PII,
      consent: true,
      consentVersion: CONSENT_TEXT_VERSION,
      website: "",
      token: "sample-token",
      ...body,
    };
    for (const [k, v] of Object.entries(full)) if (v === undefined) delete full[k];
    const res = await handleServerRoute(
      new Request(`${ORIGIN}/api/alumni-submission`, {
        method: "POST",
        headers: h,
        body: raw ?? JSON.stringify(full),
      }),
      env,
      deps,
    );
    return { status: res.status, data: await res.json().catch(() => null), res };
  }
  async function admin(method, path, body, as = "admin") {
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
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
      deps,
    );
    return { status: res.status, data: await res.json().catch(() => null) };
  }
  const rows = (sql = "SELECT * FROM alumni_submissions") =>
    DB.sqlite
      .prepare(sql)
      .all()
      .map((r) => ({ ...r }));
  return { env, DB, ts, clock, submit, admin, rows };
}

test("switched off unless the database, both Turnstile keys and a long salt are all present", async () => {
  for (const missing of [
    { DB: undefined },
    { TURNSTILE_SITE_KEY: undefined },
    { TURNSTILE_SECRET_KEY: undefined },
    { SUBMISSION_SALT: undefined },
    { SUBMISSION_SALT: "too-short" },
  ]) {
    const s = await site({ env: missing });
    const label = JSON.stringify(Object.keys(missing));
    assert.equal((await s.submit()).status, 404, label);
    assert.deepEqual(submissionConfig(s.env), { enabled: false, siteKey: "" }, label);
    if (s.env.DB) {
      assert.equal((await s.admin("GET", "/submissions")).status, 404, label);
      assert.equal((await s.admin("GET", "/me")).data.submissions, false, label);
    }
    assert.equal(s.ts.state.calls.length, 0);
  }
  const on = await site();
  assert.deepEqual(submissionConfig(on.env), {
    enabled: true,
    siteKey: "1x00000000000000000000AA",
  });
  assert.equal((await on.admin("GET", "/me")).data.submissions, true);
});

test("a valid submission is stored as pending, normalised, with a hashed IP and the consent version", async () => {
  const s = await site();
  const r = await s.submit({
    linkedin: "https://www.linkedin.com/in/sample-formfill",
    helpWith: "referrals; Career advice",
  });
  assert.deepEqual([r.status, r.data], [200, { ok: true }]);
  const [row] = s.rows();
  assert.equal(row.status, "pending");
  assert.equal(row.phone, "+919000000555");
  assert.equal(row.help_with, "Referrals; Career advice");
  assert.equal(row.photo, "");
  assert.equal(row.consent_text_version, CONSENT_TEXT_VERSION);
  assert.equal(row.consent_at, "2026-12-01T10:00:00.000Z");
  assert.equal(row.ip_hash, await hashIp(SALT, "203.0.113.7"));
  assert.doesNotMatch(row.ip_hash, /203\.0/);
  assert.deepEqual(s.ts.state.calls, [{ secret: SECRET, response: "sample-token" }]);
  // Never public before approval.
  invalidatePublicCache();
  assert.deepEqual(await getPublicContent("alumni", s.env), []);
});

test("Turnstile is fail-closed: failure, HTTP error, network error, timeout, missing token", async () => {
  for (const mode of ["fail", "500", "throw", "hang"]) {
    const s = await site({ mode });
    const r = await s.submit();
    assert.equal(r.status, 400, mode);
    assert.match(r.data.error, /spam check/);
    assert.equal(s.rows().length, 0, mode);
  }
  const s = await site();
  assert.equal((await s.submit({ token: "" })).status, 400);
  assert.equal((await s.submit({ token: undefined })).status, 400);
  assert.equal(s.ts.state.calls.length, 0, "no call without a token");
  assert.equal(await verifyTurnstile(SECRET, "x".repeat(3000), { fetchFn: s.ts.fetchFn }), false);
});

test("honeypot: a filled hidden field gets the normal answer but nothing is stored or verified", async () => {
  const s = await site();
  const r = await s.submit({ website: "http://spam.example" });
  assert.deepEqual([r.status, r.data], [200, { ok: true }]);
  assert.equal(s.rows().length, 0);
  assert.equal(s.ts.state.calls.length, 0);
});

test("consent is required, and must be for the current wording", async () => {
  const s = await site();
  assert.match((await s.submit({ consent: false })).data.errors.consent, /consent/);
  assert.equal((await s.submit({ consent: "yes" })).status, 400);
  assert.equal((await s.submit({ consentVersion: "2020-01-01.1" })).status, 409);
  assert.equal(s.rows().length, 0);
});

test("fields use the shared validators; photos are refused; nothing is echoed back", async () => {
  const s = await site();
  const bad = await s.submit({
    name: "",
    batch: "",
    linkedin: "https://linkedin.com.evil.com/in/x",
    email: "sample.formfill@example.com?bcc=x",
    phone: "call me maybe",
    photo: "https://example.org/me.jpg",
    surprise: "x",
  });
  assert.equal(bad.status, 400);
  assert.deepEqual(Object.keys(bad.data.errors).sort(), [
    "_",
    "batch",
    "email",
    "linkedin",
    "name",
    "phone",
    "photo",
  ]);
  assert.doesNotMatch(JSON.stringify(bad.data), /evil|call me|bcc|example\.org/);
  const photoOnly = await s.submit({ photo: "" });
  assert.match(photoOnly.data.errors.photo, /Photos cannot be sent/);
  assert.equal(s.rows().length, 0);
  assert.equal(s.ts.state.calls.length, 0, "validation happens before the spam check");
});

test("CSRF, JSON only and the 8 KB cap", async () => {
  const s = await site();
  assert.equal((await s.submit({}, { headers: { origin: null } })).status, 403);
  assert.equal((await s.submit({}, { headers: { origin: "https://evil.example" } })).status, 403);
  assert.equal((await s.submit({}, { headers: { "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal((await s.submit({}, { headers: { "x-mesac-form": null } })).status, 403);
  assert.equal((await s.submit({}, { headers: { "content-type": "text/plain" } })).status, 415);
  assert.equal((await s.submit({}, { raw: "{broken" })).status, 400);
  assert.equal((await s.submit({ location: "x".repeat(9 * 1024) })).status, 413);
  assert.equal(s.rows().length, 0);
});

test("rate limits: 3 per IP per day, 50 pending overall, the same vague message", async () => {
  const s = await site();
  for (let i = 0; i < 3; i++)
    assert.equal((await s.submit({ name: `SAMPLE Person ${i}` })).status, 200);
  const limited = await s.submit({ name: "SAMPLE Person 3" });
  assert.equal(limited.status, 429);
  assert.equal((await s.submit({ name: "SAMPLE Other IP" }, { ip: "198.51.100.9" })).status, 200);
  s.clock.now += 25 * 60 * 60 * 1000;
  assert.equal((await s.submit({ name: "SAMPLE Next Day" })).status, 200);

  const g = await site();
  const old = new Date(g.clock.now - 60 * 1000).toISOString();
  const insert = g.DB.sqlite.prepare(
    "INSERT INTO alumni_submissions (id, created_at, name, consent_text_version, consent_at, ip_hash) VALUES (?, ?, 'SAMPLE Filler', 'v', ?, ?)",
  );
  for (let i = 0; i < 50; i++) insert.run(i.toString(16).padStart(32, "0"), old, old, `h${i}`);
  const full = await g.submit({}, { ip: "192.0.2.1" });
  assert.equal(full.status, 429);
  assert.equal(full.data.error, limited.data.error);
  assert.doesNotMatch(full.data.error, /50|3|pending|limit/i);
});

test("review: edit (and add a photo), approve into a consented alumni row, PII stripped from the submission", async () => {
  const s = await site();
  await s.submit({ name: "SAMPLE Priya Formfil" });
  const list = await s.admin("GET", "/submissions", undefined, "editor");
  assert.equal(list.status, 200);
  const [item] = list.data.items;
  assert.equal(item.name, "SAMPLE Priya Formfil");
  assert.equal(item.phone, "+919000000555");
  assert.equal("ipHash" in item || "ip_hash" in item, false);
  const consentAt = item.consentAt;

  const edited = await s.admin(
    "PUT",
    `/submissions/${item.id}`,
    { name: "SAMPLE Priya Formfill", photo: "https://example.org/sample.jpg" },
    "editor",
  );
  assert.equal(edited.status, 200);
  assert.equal(edited.data.item.photo, "https://example.org/sample.jpg");
  assert.equal(
    (await s.admin("PUT", `/submissions/${item.id}`, { photo: "not a photo" })).status,
    400,
  );
  assert.equal((await s.admin("PUT", `/submissions/${item.id}`, { visible: true })).status, 400);

  const approved = await s.admin(
    "POST",
    `/submissions/${item.id}/approve`,
    { visible: true },
    "editor",
  );
  assert.equal(approved.status, 200);
  const alumni = s.rows("SELECT * FROM alumni");
  assert.equal(alumni.length, 1);
  assert.deepEqual(
    [
      alumni[0].id,
      alumni[0].name,
      alumni[0].consent,
      alumni[0].consent_source,
      alumni[0].consent_at,
      alumni[0].visible,
      alumni[0].photo,
    ],
    [approved.data.alumniId, PII.name, 1, "form", consentAt, 1, "https://example.org/sample.jpg"],
  );
  const [sub] = s.rows();
  assert.equal(sub.status, "approved");
  for (const col of [
    "name",
    "batch",
    "company",
    "email",
    "phone",
    "photo",
    "help_with",
    "linkedin",
  ])
    assert.equal(sub[col], "", col);
  assert.equal(sub.ip_hash, null);
  assert.equal(sub.alumni_id, approved.data.alumniId);
  assert.equal(sub.consent_text_version, CONSENT_TEXT_VERSION);
  assert.equal(sub.consent_at, consentAt);
  assert.equal(sub.reviewed_by, "editor@example.com");
  invalidatePublicCache();
  assert.deepEqual(
    (await getPublicContent("alumni", s.env)).map((a) => a.name),
    [PII.name],
  );
  assert.equal(
    (await s.admin("POST", `/submissions/${item.id}/approve`, {})).status,
    404,
    "only once",
  );
});

test("approve hidden, reject, purge, and the database refuses a reviewed row that still has PII", async () => {
  const s = await site();
  await s.submit({ name: "SAMPLE Hidden One" }, { ip: "192.0.2.10" });
  await s.submit({ name: "SAMPLE Rejected One" }, { ip: "192.0.2.11" });
  const [hidden, rejected] = (await s.admin("GET", "/submissions")).data.items;
  await s.admin("POST", `/submissions/${hidden.id}/approve`, { visible: false });
  assert.equal(s.rows("SELECT visible FROM alumni")[0].visible, 0);
  invalidatePublicCache();
  assert.deepEqual(await getPublicContent("alumni", s.env), []);
  assert.equal(
    (await s.admin("POST", `/submissions/${hidden.id}/approve`, { visible: "no" })).status,
    400,
  );

  assert.equal(
    (await s.admin("POST", `/submissions/${rejected.id}/reject`, {}, "editor")).status,
    200,
  );
  const r = s.rows(`SELECT * FROM alumni_submissions WHERE id = '${rejected.id}'`)[0];
  assert.deepEqual([r.status, r.name, r.email, r.phone, r.ip_hash], ["rejected", "", "", "", null]);

  // An old pending row and the rejected row go at the next queue load; the approved consent log stays.
  const old = new Date(s.clock.now - 31 * 24 * 60 * 60 * 1000).toISOString();
  s.DB.sqlite
    .prepare(
      "INSERT INTO alumni_submissions (id, created_at, name, consent_text_version, consent_at) VALUES (?, ?, 'SAMPLE Stale', 'v', ?)",
    )
    .run("f".repeat(32), old, old);
  const list = await s.admin("GET", "/submissions");
  assert.deepEqual(list.data.items, []);
  assert.deepEqual(s.rows("SELECT status FROM alumni_submissions"), [{ status: "approved" }]);

  s.DB.sqlite
    .prepare(
      "INSERT INTO alumni_submissions (id, created_at, name, consent_text_version, consent_at) VALUES (?, 't', 'SAMPLE X', 'v', 't')",
    )
    .run("e".repeat(32));
  assert.throws(
    () =>
      s.DB.sqlite
        .prepare("UPDATE alumni_submissions SET status = 'approved' WHERE id = ?")
        .run("e".repeat(32)),
    /CHECK constraint failed/,
  );
});

test("audit log: actions and field names only, no labels or values for submissions and alumni", async () => {
  const s = await site();
  await s.submit();
  const [item] = (await s.admin("GET", "/submissions")).data.items;
  await s.admin("PUT", `/submissions/${item.id}`, { company: "SAMPLE Formco Two" });
  await s.admin("POST", `/submissions/${item.id}/approve`, {});
  const audit = s.rows("SELECT * FROM audit_log");
  assert.deepEqual(audit.map((a) => `${a.action}:${a.entity}`).sort(), [
    "approve:submissions",
    "create:alumni",
    "update:submissions",
  ]);
  assert.ok(audit.every((a) => a.label === null));
  const text = JSON.stringify(audit);
  for (const p of PII_PATTERNS) assert.doesNotMatch(text, p);
  assert.match(text, /company/);
});
