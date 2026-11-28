// Scripts that write SQL for D1 (one-time Sheet import, first admins, local admin) and the wrangler config.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { migratedDb } from "./d1-shim.mjs";
import {
  addAdminSql,
  bootstrapSql,
  importSql,
  parseEmailList,
  sqlLiteral,
} from "../lib/d1-sql.mjs";
import {
  LOCAL_DB_ID,
  d1Id,
  renderDeployConfig,
  renderLocalConfig,
} from "../lib/wrangler-config.mjs";
import { listPublic, readSettings } from "../../src/server/db.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const node = (args, opts = {}) =>
  spawnSync(process.execPath, args, {
    encoding: "utf8",
    ...opts,
    env: { PATH: process.env.PATH, ...opts.env },
  });
const execAll = (db, sql) => db.exec(sql);
const plain = (db, sql) =>
  db.sqlite
    .prepare(sql)
    .all()
    .map((r) => ({ ...r }));

test("sqlLiteral escapes quotes and refuses odd numbers", () => {
  assert.equal(sqlLiteral("O'Brien'); DROP TABLE x; --"), "'O''Brien''); DROP TABLE x; --'");
  assert.equal(sqlLiteral(null), "NULL");
  assert.equal(sqlLiteral(3), "3");
  assert.equal(sqlLiteral("a\0b"), "'ab'");
  assert.throws(() => sqlLiteral(Number.NaN));
});

test("Sheet import: the fixtures import cleanly, alumni without consent are skipped", () => {
  const out = join(mkdtempSync(join(tmpdir(), "mesac-import-")), "x.d1-import.sql");
  const r = node([join(REPO, "scripts/import-sheet-to-d1.mjs"), "--fixtures", "--out", out]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /alumni 4,.*; 2 alumni rows skipped \(no consent\)/);
  assert.doesNotMatch(r.stdout, /@|SAMPLE/);
  const sql = readFileSync(out, "utf8");
  assert.doesNotMatch(sql, /noconsent|Unconsented|00000 00099|sample\.blank@/);
  const db = migratedDb();
  execAll(db, sql);
  return Promise.all([listPublic(db, "alumni"), listPublic(db, "team"), readSettings(db)]).then(
    ([alumni, team, settings]) => {
      assert.equal(alumni.length, 4);
      assert.equal(alumni[0].phone, "+910000000001");
      assert.equal(team.length, 6);
      assert.equal(settings.stat_members, "100");
      const sources = plain(db, "SELECT DISTINCT consent_source FROM alumni");
      assert.deepEqual(sources, [{ consent_source: "sheet_import" }]);
    },
  );
});

test("Sheet import from snapshots refuses sample data unless told", () => {
  const root = mkdtempSync(join(tmpdir(), "mesac-import-root-"));
  try {
    cpSync(join(REPO, "src/data/generated"), join(root, "src/data/generated"), { recursive: true });
    const env = { MESAC_PROJECT_ROOT: root };
    const refused = node([join(REPO, "scripts/import-sheet-to-d1.mjs")], { env });
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /sample data/);
    const allowed = node([join(REPO, "scripts/import-sheet-to-d1.mjs"), "--allow-sample"], { env });
    assert.equal(allowed.status, 0, allowed.stderr);
    execAll(
      migratedDb(),
      readFileSync(join(root, ".wrangler/import/sheet-import.d1-import.sql"), "utf8"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("bootstrap emails: strict list, no value echoed back on error", () => {
  assert.deepEqual(parseEmailList(" A@Example.org, b@example.org ,a@example.org,"), [
    "a@example.org",
    "b@example.org",
  ]);
  assert.deepEqual(parseEmailList(""), []);
  for (const bad of [
    "a@example.org, x'); DROP TABLE admins; --",
    "not-an-email",
    "a@b",
    "a b@example.org",
    "a@example.org;b@example.org",
  ]) {
    assert.throws(
      () => parseEmailList(bad),
      (err) => !err.message.includes("DROP") && /entry \d+/.test(err.message),
      bad,
    );
  }
});

test("bootstrap SQL adds the first admins only while the admin list is empty", () => {
  const db = migratedDb();
  const sql = bootstrapSql(parseEmailList("first@example.org, second@example.org"));
  db.exec(sql);
  assert.deepEqual(plain(db, "SELECT email, role, active FROM admins ORDER BY email"), [
    { email: "first@example.org", role: "admin", active: 1 },
    { email: "second@example.org", role: "admin", active: 1 },
  ]);
  // An admin removed in the dashboard is not re-added by the next deploy.
  db.exec("DELETE FROM admins WHERE email = 'second@example.org'");
  db.exec(sql);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM admins").get().n, 1);
  assert.throws(() => bootstrapSql(["x'@example.org"]));
});

test("bootstrap CLI: validates before running anything and prints no emails", () => {
  const script = join(REPO, "scripts/bootstrap-admins.mjs");
  const bad = node([script, "--dry-run"], {
    env: { ADMIN_BOOTSTRAP_EMAILS: "ok@example.org, evil'--" },
  });
  assert.equal(bad.status, 1);
  assert.doesNotMatch(bad.stderr + bad.stdout, /evil|ok@example/);
  const good = node([script, "--dry-run"], { env: { ADMIN_BOOTSTRAP_EMAILS: "ok@example.org" } });
  assert.equal(good.status, 0);
  assert.match(good.stdout, /1 valid email/);
  assert.doesNotMatch(good.stdout, /ok@example/);
  assert.equal(node([script], { env: {} }).status, 0);
});

test("local admin SQL is validated", () => {
  const db = migratedDb();
  db.exec(addAdminSql("Me@Example.org", "editor"));
  db.exec(addAdminSql("me@example.org", "admin"));
  assert.deepEqual(plain(db, "SELECT email, role FROM admins"), [
    { email: "me@example.org", role: "admin" },
  ]);
  assert.throws(() => addAdminSql("x'@y.org", "admin"));
  assert.throws(() => addAdminSql("me@example.org", "owner"));
});

const BASE = { name: "mesac-cusat", main: "index.mjs", compatibility_date: "2026-11-01" };
const ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const ACCESS = { CF_ACCESS_TEAM_DOMAIN: "sample-team", CF_ACCESS_AUD: "b".repeat(64) };

test("wrangler config: Sheet mode leaves it untouched", () => {
  const r = renderDeployConfig(BASE, {}, { migrationsDir: "../../migrations" });
  assert.equal(r.changed, false);
  assert.equal(r.config, BASE);
  const stray = renderDeployConfig(BASE, { R2_BUCKET_NAME: "x-y" }, { migrationsDir: "m" });
  assert.equal(stray.changed, false);
  assert.match(stray.warnings[0], /ignored/);
});

test("wrangler config: admin mode adds DB, MEDIA and the Access vars", () => {
  const r = renderDeployConfig(
    BASE,
    { D1_DATABASE_ID: ID.toUpperCase(), R2_BUCKET_NAME: "mesac-media", ...ACCESS },
    { migrationsDir: "../../migrations" },
  );
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.config.d1_databases, [
    {
      binding: "DB",
      database_name: "mesac-admin",
      database_id: ID,
      migrations_dir: "../../migrations",
    },
  ]);
  assert.deepEqual(r.config.r2_buckets, [{ binding: "MEDIA", bucket_name: "mesac-media" }]);
  assert.deepEqual(r.config.vars, {
    CF_ACCESS_TEAM_DOMAIN: "sample-team.cloudflareaccess.com",
    CF_ACCESS_AUD: "b".repeat(64),
  });
  // Rendering twice gives the same result.
  assert.deepEqual(
    renderDeployConfig(
      r.config,
      { D1_DATABASE_ID: ID, R2_BUCKET_NAME: "mesac-media", ...ACCESS },
      { migrationsDir: "../../migrations" },
    ).config,
    r.config,
  );
});

test("wrangler config: placeholders and bad values never get through", () => {
  for (const bad of [
    "xxxx",
    "00000000-0000-0000-0000-000000000000",
    LOCAL_DB_ID,
    "<your-d1-id>",
    `${ID} `.repeat(2),
  ]) {
    assert.equal(d1Id(bad), "", bad);
    assert.ok(
      renderDeployConfig(BASE, { D1_DATABASE_ID: bad }, { migrationsDir: "m" }).errors.length,
      bad,
    );
  }
  assert.ok(
    renderDeployConfig(
      BASE,
      { D1_DATABASE_ID: ID, R2_BUCKET_NAME: "Bad_Bucket" },
      { migrationsDir: "m" },
    ).errors.length,
  );
  const noAccess = renderDeployConfig(BASE, { D1_DATABASE_ID: ID }, { migrationsDir: "m" });
  assert.equal(noAccess.accessProblem, true);
  assert.equal(noAccess.config.vars, undefined);
});

test("render-wrangler CLI: no-op without D1, fails under DEPLOY with half a configuration", () => {
  const root = mkdtempSync(join(tmpdir(), "mesac-render-"));
  try {
    mkdirSync(join(root, ".output/server"), { recursive: true });
    const file = join(root, ".output/server/wrangler.json");
    const original = `${JSON.stringify(BASE, null, 2)}\n`;
    writeFileSync(file, original);
    const script = join(REPO, "scripts/render-wrangler.mjs");
    assert.equal(node([script], { env: { MESAC_PROJECT_ROOT: root } }).status, 0);
    assert.equal(readFileSync(file, "utf8"), original, "Sheet mode: byte-for-byte unchanged");
    const half = node([script], {
      env: { MESAC_PROJECT_ROOT: root, DEPLOY: "1", D1_DATABASE_ID: ID },
    });
    assert.equal(half.status, 1);
    assert.equal(readFileSync(file, "utf8"), original);
    assert.equal(
      node([script], { env: { MESAC_PROJECT_ROOT: root, D1_DATABASE_ID: "placeholder" } }).status,
      1,
    );
    const full = node([script], {
      env: { MESAC_PROJECT_ROOT: root, DEPLOY: "1", D1_DATABASE_ID: ID, ...ACCESS },
    });
    assert.equal(full.status, 0, full.stderr);
    const rendered = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(rendered.d1_databases[0].database_id, ID);
    assert.equal(rendered.d1_databases[0].migrations_dir, "../../migrations");
    // --local writes elsewhere and never touches .output.
    assert.equal(node([script, "--local"], { env: { MESAC_PROJECT_ROOT: root } }).status, 0);
    assert.equal(
      JSON.parse(readFileSync(join(root, ".wrangler/local/wrangler.json"), "utf8")).d1_databases[0]
        .database_id,
      LOCAL_DB_ID,
    );
    assert.equal(JSON.parse(readFileSync(file, "utf8")).d1_databases[0].database_id, ID);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("local config has local-only names and no Access settings", () => {
  const c = renderLocalConfig(
    { ...BASE, vars: { CF_ACCESS_AUD: "x" } },
    {
      main: "../../.output-dev/server/index.mjs",
      assetsDir: "../../.output-dev/public",
      migrationsDir: "../../migrations",
    },
  );
  assert.equal(c.d1_databases[0].database_id, LOCAL_DB_ID);
  assert.equal(c.r2_buckets[0].bucket_name, "mesac-media-local");
  assert.equal(c.vars, undefined);
  assert.equal(c.main, "../../.output-dev/server/index.mjs");
});
