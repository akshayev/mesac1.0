// The /admin/api and /media routes end to end (src/server/routes.ts), against the D1 and R2 shims.
import { test } from "node:test";
import assert from "node:assert/strict";
import { R2Shim, migratedDb } from "./d1-shim.mjs";
import { AUD, makeAccess } from "./access-jwt.mjs";
import { handleServerRoute } from "../../src/server/routes.ts";
import { createAdmin } from "../../src/server/db.ts";
import { getPublicContent, invalidatePublicCache, CACHE_MS } from "../../src/server/public-data.ts";
import { SNAPSHOTS } from "../../src/server/snapshots.ts";

const ORIGIN = "https://mesac.example.org";
const access = await makeAccess();
const deps = { fetchFn: access.fetchFn };

async function site({ media = true } = {}) {
  const DB = migratedDb();
  await createAdmin(DB, { email: "admin@example.com", role: "admin" }, "test");
  await createAdmin(DB, { email: "editor@example.com", role: "editor" }, "test");
  const env = { DB, CF_ACCESS_TEAM_DOMAIN: "sample-team", CF_ACCESS_AUD: AUD };
  if (media) env.MEDIA = new R2Shim();
  const tokens = {
    admin: await access.token({ email: "admin@example.com" }),
    editor: await access.token({ email: "editor@example.com" }),
  };
  async function call(method, path, { body, as = "admin", headers = {}, raw } = {}) {
    const defaults = { "cf-access-jwt-assertion": tokens[as] };
    if (method !== "GET") {
      defaults.origin = ORIGIN;
      defaults["x-mesac-admin"] = "1";
      if (body !== undefined) defaults["content-type"] = "application/json";
    }
    // A header given as null in `headers` is left out entirely.
    const h = { ...defaults, ...headers };
    for (const [k, v] of Object.entries(h)) if (v === null) delete h[k];
    const res = await handleServerRoute(
      new Request(ORIGIN + path, {
        method,
        headers: h,
        body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
      }),
      env,
      deps,
    );
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {}
    return { res, status: res.status, data, text };
  }
  return { env, call };
}

const webp = (size = 100) => {
  const b = new Uint8Array(size);
  b.set(new TextEncoder().encode("RIFF"), 0);
  b.set(new TextEncoder().encode("WEBP"), 8);
  return b;
};

test("without a database: /admin/api is a plain 404, other paths are not ours", async () => {
  const res = await handleServerRoute(new Request(`${ORIGIN}/admin/api/me`), {});
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(await handleServerRoute(new Request(`${ORIGIN}/team`), {}), null);
  assert.equal(
    (await handleServerRoute(new Request(`${ORIGIN}/media/${"a".repeat(32)}.webp`), {})).status,
    404,
  );
});

test("every admin response is no-store, noindex and not frameable", async () => {
  const { call } = await site();
  for (const r of [
    await call("GET", "/admin/api/me"),
    await call("GET", "/admin/api/me", { as: "nobody" }),
    await call("GET", "/admin/api/nope"),
  ]) {
    assert.equal(r.res.headers.get("cache-control"), "no-store");
    assert.match(r.res.headers.get("x-robots-tag"), /noindex/);
    assert.equal(r.res.headers.get("x-frame-options"), "DENY");
  }
});

test("me: who is signed in", async () => {
  const { call } = await site();
  assert.deepEqual((await call("GET", "/admin/api/me", { as: "editor" })).data, {
    email: "editor@example.com",
    role: "editor",
    uploads: true,
  });
  assert.equal((await call("GET", "/admin/api/me", { as: "nobody" })).status, 401);
});

test("CSRF: changes need same Origin, same-site fetch and the custom header", async () => {
  const { call } = await site();
  const body = { name: "SAMPLE" };
  assert.equal(
    (await call("POST", "/admin/api/content/team", { body, headers: { origin: null } })).status,
    403,
  );
  assert.equal(
    (
      await call("POST", "/admin/api/content/team", {
        body,
        headers: { origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("POST", "/admin/api/content/team", {
        body,
        headers: { "sec-fetch-site": "cross-site" },
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("POST", "/admin/api/content/team", { body, headers: { "x-mesac-admin": null } }))
      .status,
    403,
  );
  assert.equal(
    (
      await call("POST", "/admin/api/content/team", {
        body,
        headers: { "content-type": "text/plain" },
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await call("POST", "/admin/api/content/team", {
        raw: "{not json",
        headers: { "content-type": "application/json" },
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("GET", "/admin/api/content/team")).data.items.length,
    0,
    "nothing was created",
  );
  assert.equal(
    (
      await call("POST", "/admin/api/content/team", {
        body,
        headers: { "sec-fetch-site": "same-origin" },
      })
    ).status,
    201,
  );
});

test("size limits", async () => {
  const { call } = await site();
  const big = { name: "SAMPLE", role: "x".repeat(40 * 1024) };
  assert.equal((await call("POST", "/admin/api/content/team", { body: big })).status, 413);
  const huge = { title: "SAMPLE", description: "x".repeat(70 * 1024) };
  assert.equal((await call("POST", "/admin/api/content/achievements", { body: huge })).status, 413);
});

test("content: create, validate, update, hide, move, delete, each logged without values", async () => {
  const { call, env } = await site();
  const bad = await call("POST", "/admin/api/content/placements", { body: { name: "SAMPLE" } });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.errors.company);
  const a = (
    await call("POST", "/admin/api/content/placements", {
      body: { name: "SAMPLE A", company: "SAMPLE Co" },
    })
  ).data.item;
  const b = (
    await call("POST", "/admin/api/content/placements", {
      body: { name: "SAMPLE B", company: "SAMPLE Co" },
    })
  ).data.item;
  assert.equal(
    (await call("PUT", `/admin/api/content/placements/${a.id}`, { body: { role: "Engineer" } }))
      .data.item.role,
    "Engineer",
  );
  assert.equal(
    (await call("PUT", `/admin/api/content/placements/${a.id}`, { body: { visible: false } })).data
      .item.visible,
    false,
  );
  assert.deepEqual(
    (
      await call("POST", `/admin/api/content/placements/${b.id}/move`, {
        body: { direction: "up" },
      })
    ).data,
    { moved: true },
  );
  assert.equal(
    (
      await call("POST", `/admin/api/content/placements/${b.id}/move`, {
        body: { direction: "sideways" },
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("PUT", `/admin/api/content/placements/${"0".repeat(32)}`, { body: { role: "x" } }))
      .status,
    404,
  );
  assert.equal(
    (await call("PUT", "/admin/api/content/placements/not-an-id", { body: {} })).status,
    404,
  );
  assert.equal(
    (await call("DELETE", `/admin/api/content/placements/${a.id}`, { as: "editor" })).status,
    200,
  );
  const log = (await call("GET", "/admin/api/audit")).data.entries;
  assert.deepEqual(log.map((e) => e.action).sort(), [
    "create",
    "create",
    "delete",
    "hide",
    "move",
    "update",
  ]);
  assert.ok(log.every((e) => e.label?.startsWith("SAMPLE")));
  assert.deepEqual(log.find((e) => e.action === "update").fields, ["role"]);
  assert.equal((await call("GET", "/admin/api/content/unknown")).status, 404);
  void env;
});

test("alumni: consent rule over the API, admin-only permanent delete, nothing personal in the log", async () => {
  const { call, env } = await site();
  const noConsent = await call("POST", "/admin/api/content/alumni", {
    body: { name: "SAMPLE A", visible: true },
  });
  assert.equal(noConsent.status, 400);
  assert.match(noConsent.data.errors.visible, /consent/);
  const created = await call("POST", "/admin/api/content/alumni", {
    as: "editor",
    body: {
      name: "SAMPLE Private Person",
      consent: true,
      visible: true,
      email: "sample.private@example.com",
      phone: "90000 00042",
    },
  });
  assert.equal(created.status, 201);
  const id = created.data.item.id;
  await call("PUT", `/admin/api/content/alumni/${id}`, {
    as: "editor",
    body: { phone: "90000 00043", email: "sample.other@example.com" },
  });
  assert.equal(
    (await call("DELETE", `/admin/api/content/alumni/${id}`, { as: "editor" })).status,
    403,
  );
  assert.equal(
    (
      await call("PUT", `/admin/api/content/alumni/${id}`, {
        as: "editor",
        body: { visible: false },
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("DELETE", `/admin/api/content/alumni/${id}`, { as: "admin" })).status,
    200,
  );
  const rows = JSON.stringify(env.DB.sqlite.prepare("SELECT * FROM audit_log").all());
  assert.doesNotMatch(rows, /9000000004|00000 0004|sample\.(private|other)|Private Person/);
  assert.ok(rows.includes('\\"phone\\"'), "the field name is logged");
});

test("roles: editors cannot manage admins; admins can, with the last-admin guard", async () => {
  const { call } = await site();
  assert.equal((await call("GET", "/admin/api/admins", { as: "editor" })).status, 403);
  assert.equal(
    (
      await call("POST", "/admin/api/admins", {
        as: "editor",
        body: { email: "x@example.com", role: "admin" },
      })
    ).status,
    403,
  );
  const list = (await call("GET", "/admin/api/admins")).data.admins;
  assert.equal(list.length, 2);
  const created = await call("POST", "/admin/api/admins", {
    body: { email: "new@example.com", role: "editor" },
  });
  assert.equal(created.status, 201);
  assert.equal(
    (await call("POST", "/admin/api/admins", { body: { email: "bad email", role: "editor" } }))
      .status,
    400,
  );
  const me = list.find((a) => a.email === "admin@example.com");
  assert.equal(
    (await call("PUT", `/admin/api/admins/${me.id}`, { body: { role: "editor" } })).status,
    409,
  );
  assert.equal((await call("DELETE", `/admin/api/admins/${created.data.admin.id}`)).status, 200);
});

test("settings: known keys only", async () => {
  const { call } = await site();
  assert.equal(
    (await call("PUT", "/admin/api/settings", { as: "editor", body: { mystery: "x" } })).status,
    400,
  );
  const ok = await call("PUT", "/admin/api/settings", {
    as: "editor",
    body: { footer_text: "SAMPLE footer" },
  });
  assert.deepEqual(ok.data.values, { footer_text: "SAMPLE footer" });
  const log = (await call("GET", "/admin/api/audit")).data.entries;
  assert.equal(log[0].label, "footer_text");
});

test("upload: type sniffed from bytes, size capped, stored under a random key, served with safe headers", async () => {
  const { call, env } = await site();
  const up = (bytes, type) =>
    call("POST", "/admin/api/upload", { raw: bytes, headers: { "content-type": type } });
  assert.equal(
    (await up(new TextEncoder().encode("<svg onload=alert(1)>"), "image/webp")).status,
    415,
    "bad magic bytes",
  );
  assert.equal((await up(webp(), "image/png")).status, 415, "declared type does not match");
  assert.equal((await up(webp(), "image/gif")).status, 415, "type not allowed");
  assert.equal((await up(webp(300 * 1024 + 1), "image/webp")).status, 413, "over 300 KB");
  assert.equal((await up(new Uint8Array(), "image/webp")).status, 400, "empty");
  const ok = await up(webp(), "image/webp");
  assert.equal(ok.status, 201);
  assert.match(ok.data.path, /^\/media\/[0-9a-f]{32}\.webp$/);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
  assert.match((await up(png, "image/png")).data.path, /\.png$/);
  assert.match(
    (await up(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).data.path,
    /\.jpg$/,
  );

  const media = await handleServerRoute(new Request(ORIGIN + ok.data.path), env);
  assert.equal(media.status, 200);
  assert.equal(media.headers.get("content-type"), "image/webp");
  assert.equal(media.headers.get("cache-control"), "public, max-age=604800");
  assert.equal(media.headers.get("x-content-type-options"), "nosniff");
  assert.match(media.headers.get("content-security-policy"), /sandbox/);
  assert.equal(
    (await handleServerRoute(new Request(`${ORIGIN}/media/..%2Fsecret`), env)).status,
    404,
  );
  assert.equal(
    (await handleServerRoute(new Request(`${ORIGIN}/media/${"a".repeat(32)}.svg`), env)).status,
    404,
  );
  assert.equal(
    (await handleServerRoute(new Request(`${ORIGIN}/media/${"b".repeat(32)}.webp`), env)).status,
    404,
  );

  // A person's photo is deleted with them (and when it is replaced), unless another row still uses it.
  const person = (
    await call("POST", "/admin/api/content/team", { body: { name: "SAMPLE", photo: ok.data.path } })
  ).data.item;
  const twin = (
    await call("POST", "/admin/api/content/team", {
      body: { name: "SAMPLE Twin", photo: ok.data.path },
    })
  ).data.item;
  const key = ok.data.path.slice(7);
  await call("DELETE", `/admin/api/content/team/${person.id}`);
  assert.ok(env.MEDIA.objects.has(key), "still used by the twin");
  const second = (await up(webp(120), "image/webp")).data.path;
  await call("PUT", `/admin/api/content/team/${twin.id}`, { body: { photo: second } });
  assert.equal(env.MEDIA.objects.has(key), false, "replaced photo removed");
  await call("DELETE", `/admin/api/content/team/${twin.id}`);
  assert.equal(env.MEDIA.objects.has(second.slice(7)), false);
});

test("upload without R2 explains itself", async () => {
  const { call } = await site({ media: false });
  const r = await call("POST", "/admin/api/upload", {
    raw: webp(),
    headers: { "content-type": "image/webp" },
  });
  assert.equal(r.status, 503);
  assert.match(r.data.error, /R2/);
});

test("without R2, pasted https and Drive image links still work (shared photo validator)", async () => {
  const { call } = await site({ media: false });
  assert.equal((await call("GET", "/admin/api/me")).data.uploads, false);
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
  const drive = await call("POST", "/admin/api/content/team", {
    body: { name: "SAMPLE Drive", photo: `https://drive.google.com/file/d/${id}/view?usp=sharing` },
  });
  assert.equal(drive.status, 201);
  assert.equal(drive.data.item.photo, `https://drive.google.com/thumbnail?id=${id}&sz=w600`);
  const https = await call("POST", "/admin/api/content/alumni", {
    body: { name: "SAMPLE Https", photo: "https://example.org/sample.jpg" },
  });
  assert.equal(https.data.item.photo, "https://example.org/sample.jpg");
  for (const photo of ["javascript:alert(1)", "not a photo", "ftp://example.org/x.jpg"]) {
    const bad = await call("POST", "/admin/api/content/team", {
      body: { name: "SAMPLE Bad", photo },
    });
    assert.equal(bad.status, 400, photo);
    assert.match(bad.data.errors.photo, /not a usable image link/);
  }
  const upload = await call("POST", "/admin/api/upload", {
    raw: webp(),
    headers: { "content-type": "image/webp" },
  });
  assert.equal(upload.status, 503);
});

test("public data: snapshots without a database, D1 (visible, consented, cached 60 s) with one", async () => {
  for (const kind of ["team", "achievements", "placements", "alumni", "settings"])
    assert.deepEqual(await getPublicContent(kind, {}), SNAPSHOTS[kind], kind);

  const { call, env } = await site();
  invalidatePublicCache();
  await call("POST", "/admin/api/content/alumni", {
    body: { name: "SAMPLE Shown", consent: true, visible: true },
  });
  await call("POST", "/admin/api/content/alumni", {
    body: { name: "SAMPLE Hidden", consent: true },
  });
  await call("POST", "/admin/api/content/alumni", { body: { name: "SAMPLE No Consent" } });
  const t0 = Date.now();
  assert.deepEqual(
    (await getPublicContent("alumni", env, t0)).map((a) => a.name),
    ["SAMPLE Shown"],
  );
  assert.deepEqual(await getPublicContent("settings", env, t0), {});
  // Another Worker instance's change is not seen until the cache expires...
  env.DB.sqlite.prepare("UPDATE alumni SET visible = 0").run();
  assert.equal((await getPublicContent("alumni", env, t0 + 1000)).length, 1);
  assert.equal((await getPublicContent("alumni", env, t0 + CACHE_MS + 1)).length, 0);
  // ...but a change made through this instance's API is seen at once.
  await call("POST", "/admin/api/content/team", { body: { name: "SAMPLE New" } });
  assert.deepEqual(
    (await getPublicContent("team", env, t0 + CACHE_MS + 2)).map((p) => p.name),
    ["SAMPLE New"],
  );
  // A database error serves the last good copy instead of failing (and never the sample snapshot).
  const broken = {
    ...env,
    DB: {
      prepare: () => ({
        all: async () => {
          throw new Error("down");
        },
      }),
    },
  };
  assert.deepEqual(
    (await getPublicContent("team", broken, t0 + CACHE_MS + 3)).map((p) => p.name),
    ["SAMPLE New"],
  );
  invalidatePublicCache();
  await assert.rejects(getPublicContent("team", broken, t0));
});
