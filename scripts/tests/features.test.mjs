// Optional-feature configuration checks (scripts/lib/features.mjs, scripts/check-features.mjs), the
// Turnstile site key in the rendered Worker config, the sitemap rule for /alumni/join and the Worker
// secrets upload script.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkFeatures, isTurnstileTestKey, joinPageEnabled } from "../lib/features.mjs";
import { renderDeployConfig } from "../lib/wrangler-config.mjs";
import { staticPathsFromRouteTree } from "../lib/seo.mjs";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const SITE = "0x4AAAAAAAsampleSITEkey";
const SECRET = "0x4AAAAAAAsampleSECRETkeyForTests";
const SALT = "a".repeat(40);
const node = (args, env = {}) =>
  spawnSync(process.execPath, args, { encoding: "utf8", env: { PATH: process.env.PATH, ...env } });

test("Turnstile test keys are recognised", () => {
  for (const k of [
    "1x00000000000000000000AA",
    "2x00000000000000000000AB",
    "3x00000000000000000000FF",
    "1x0000000000000000000000000000000AA",
    "2x0000000000000000000000000000000AA",
  ])
    assert.equal(isTurnstileTestKey(k), true, k);
  for (const k of [SITE, SECRET, "", "1x123"]) assert.equal(isTurnstileTestKey(k), false, k);
});

test("checkFeatures: off, dashboard only, dashboard + form", () => {
  assert.deepEqual(checkFeatures({}), {
    d1: false,
    submissions: false,
    refresh: false,
    errors: [],
  });
  assert.deepEqual(checkFeatures({ D1_DATABASE_ID: ID }), {
    d1: true,
    submissions: false,
    refresh: false,
    errors: [],
  });
  assert.deepEqual(
    checkFeatures({
      D1_DATABASE_ID: ID,
      TURNSTILE_SITE_KEY: SITE,
      TURNSTILE_SECRET_KEY: SECRET,
      SUBMISSION_SALT: SALT,
    }),
    { d1: true, submissions: true, refresh: false, errors: [] },
  );
});

test("checkFeatures: partial, test-key, short-salt and no-database setups fail without showing values", () => {
  const cases = [
    [
      { D1_DATABASE_ID: ID, TURNSTILE_SITE_KEY: SITE },
      /partly set up: TURNSTILE_SECRET_KEY, SUBMISSION_SALT missing/,
    ],
    [
      { D1_DATABASE_ID: ID, TURNSTILE_SECRET_KEY: SECRET, SUBMISSION_SALT: SALT },
      /TURNSTILE_SITE_KEY missing/,
    ],
    [
      { TURNSTILE_SITE_KEY: SITE, TURNSTILE_SECRET_KEY: SECRET, SUBMISSION_SALT: SALT },
      /needs the admin database/,
    ],
    [
      {
        D1_DATABASE_ID: ID,
        TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
        TURNSTILE_SECRET_KEY: SECRET,
        SUBMISSION_SALT: SALT,
      },
      /test key/,
    ],
    [
      {
        D1_DATABASE_ID: ID,
        TURNSTILE_SITE_KEY: SITE,
        TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
        SUBMISSION_SALT: SALT,
      },
      /test key/,
    ],
    [
      {
        D1_DATABASE_ID: ID,
        TURNSTILE_SITE_KEY: SITE,
        TURNSTILE_SECRET_KEY: SECRET,
        SUBMISSION_SALT: "short",
      },
      /at least 32/,
    ],
    [
      {
        D1_DATABASE_ID: ID,
        TURNSTILE_SITE_KEY: "nope",
        TURNSTILE_SECRET_KEY: SECRET,
        SUBMISSION_SALT: SALT,
      },
      /site key/,
    ],
    [{ D1_DATABASE_ID: "placeholder" }, /not a D1 database id/],
  ];
  for (const [env, re] of cases) {
    const r = checkFeatures(env);
    assert.equal(r.submissions, false);
    assert.match(r.errors.join(" "), re, JSON.stringify(Object.keys(env)));
    assert.doesNotMatch(r.errors.join(" "), /sampleSECRET|aaaaaaaa|sampleSITE/);
  }
});

test("check-features CLI writes the outputs and never prints values", () => {
  const dir = mkdtempSync(join(tmpdir(), "mesac-features-"));
  try {
    const out = join(dir, "out");
    writeFileSync(out, "");
    const env = {
      GITHUB_OUTPUT: out,
      D1_DATABASE_ID: ID,
      TURNSTILE_SITE_KEY: SITE,
      TURNSTILE_SECRET_KEY: SECRET,
      SUBMISSION_SALT: SALT,
    };
    const ok = node([join(REPO, "scripts/check-features.mjs")], env);
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(readFileSync(out, "utf8"), "d1=true\nsubmissions=true\nrefresh=false\n");
    assert.match(ok.stdout, /admin dashboard on, alumni form on, papers refresh button off/);
    const bad = node([join(REPO, "scripts/check-features.mjs")], {
      ...env,
      SUBMISSION_SALT: "",
      GITHUB_OUTPUT: out,
    });
    assert.equal(bad.status, 1);
    for (const text of [ok.stdout, ok.stderr, bad.stdout, bad.stderr])
      assert.doesNotMatch(text, /sampleSECRET|sampleSITE|aaaaaaaaaa|3f2b8c1e/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rendered Worker config: public site key in vars (D1 mode only), never the secrets", () => {
  const env = {
    D1_DATABASE_ID: ID,
    CF_ACCESS_TEAM_DOMAIN: "sample-team",
    CF_ACCESS_AUD: "b".repeat(64),
    TURNSTILE_SITE_KEY: SITE,
    TURNSTILE_SECRET_KEY: SECRET,
    SUBMISSION_SALT: SALT,
  };
  const r = renderDeployConfig({ name: "x" }, env, { migrationsDir: "m" });
  assert.equal(r.config.vars.TURNSTILE_SITE_KEY, SITE);
  const text = JSON.stringify(r.config);
  assert.doesNotMatch(text, /sampleSECRET|aaaaaaaaaa|SUBMISSION_SALT|TURNSTILE_SECRET_KEY/);
  assert.equal(
    renderDeployConfig({ name: "x" }, { TURNSTILE_SITE_KEY: SITE }, { migrationsDir: "m" }).changed,
    false,
  );
  assert.ok(
    renderDeployConfig(
      { name: "x" },
      { ...env, TURNSTILE_SITE_KEY: "bad key" },
      { migrationsDir: "m" },
    ).errors.length,
  );
});

test("sitemap lists /alumni/join only when the build has the database and a site key; /alumni/remove always", () => {
  const tree = readFileSync(join(REPO, "src/routeTree.gen.ts"), "utf8");
  const seo = JSON.parse(readFileSync(join(REPO, "src/data/seo.json"), "utf8"));
  const paths = (env) =>
    staticPathsFromRouteTree(
      tree,
      joinPageEnabled(env) ? seo : { ...seo, exclude: [...seo.exclude, "/alumni/join"] },
    );
  assert.ok(!paths({}).includes("/alumni/join"));
  assert.ok(!paths({ TURNSTILE_SITE_KEY: SITE }).includes("/alumni/join"));
  assert.ok(paths({ D1_DATABASE_ID: ID, TURNSTILE_SITE_KEY: SITE }).includes("/alumni/join"));
  assert.ok(paths({}).includes("/alumni/remove"));

  const root = mkdtempSync(join(tmpdir(), "mesac-seo-"));
  try {
    for (const f of [
      "src/routeTree.gen.ts",
      "src/data/seo.json",
      "src/data/generated/archive.json",
    ]) {
      mkdirSync(join(root, f, ".."), { recursive: true });
      writeFileSync(join(root, f), readFileSync(join(REPO, f)));
    }
    // seo.mjs works from its own folder: run a copy inside the temporary root.
    mkdirSync(join(root, "scripts/lib"), { recursive: true });
    for (const f of [
      "scripts/seo.mjs",
      "scripts/lib/seo.mjs",
      "scripts/lib/features.mjs",
      "scripts/lib/wrangler-config.mjs",
      "scripts/lib/validate.mjs",
    ])
      writeFileSync(join(root, f), readFileSync(join(REPO, f)));
    assert.equal(node([join(root, "scripts/seo.mjs")]).status, 0);
    assert.doesNotMatch(readFileSync(join(root, "public/sitemap.xml"), "utf8"), /alumni\/join/);
    assert.equal(
      node([join(root, "scripts/seo.mjs")], { D1_DATABASE_ID: ID, TURNSTILE_SITE_KEY: SITE })
        .status,
      0,
    );
    assert.match(readFileSync(join(root, "public/sitemap.xml"), "utf8"), /alumni\/join/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("upload-worker-secrets: uploads only what the enabled features need, never prints values", () => {
  const script = join(REPO, "scripts/upload-worker-secrets.mjs");
  const nothing = node([script], { TURNSTILE_SECRET_KEY: SECRET });
  assert.equal(nothing.status, 0);
  assert.match(nothing.stdout, /nothing to do/);
  const r = node([script], { UPLOAD_SUBMISSIONS: "true", TURNSTILE_SECRET_KEY: SECRET });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /SUBMISSION_SALT not set/);
  const t = node([script], { UPLOAD_REFRESH: "true" });
  assert.equal(t.status, 1);
  assert.match(t.stderr, /PAPERS_REFRESH_TOKEN not set/);
  for (const out of [r, t, nothing]) assert.doesNotMatch(out.stdout + out.stderr, /sampleSECRET/);
});

const PAT = "github_pat_SAMPLEtokenForTestsOnly_abcdefghijklmnopqrstuvwxyz";

test("checkFeatures: papers refresh token must be fine-grained and needs the database", () => {
  assert.equal(checkFeatures({ D1_DATABASE_ID: ID, PAPERS_REFRESH_TOKEN: PAT }).refresh, true);
  const classic = checkFeatures({
    D1_DATABASE_ID: ID,
    PAPERS_REFRESH_TOKEN: "ghp_" + "a".repeat(36),
  });
  assert.equal(classic.refresh, false);
  assert.match(classic.errors.join(), /fine-grained/);
  const noDb = checkFeatures({ PAPERS_REFRESH_TOKEN: PAT });
  assert.match(noDb.errors.join(), /needs the admin database/);
  for (const r of [classic, noDb]) assert.doesNotMatch(r.errors.join(), /SAMPLEtoken|aaaa/);
});

test("rendered Worker config: GITHUB_REPO / GITHUB_WORKFLOW_FILE vars only in D1 mode, never the token", () => {
  const env = {
    D1_DATABASE_ID: ID,
    REFRESH_REPO: "sample-org/sample-site",
    REFRESH_WORKFLOW_FILE: "deploy.yml",
    PAPERS_REFRESH_TOKEN: PAT,
  };
  const r = renderDeployConfig({ name: "x" }, env, { migrationsDir: "m" });
  assert.equal(r.config.vars.GITHUB_REPO, "sample-org/sample-site");
  assert.equal(r.config.vars.GITHUB_WORKFLOW_FILE, "deploy.yml");
  assert.doesNotMatch(JSON.stringify(r.config), /github_pat_|GITHUB_DISPATCH_TOKEN/);
  assert.equal(
    renderDeployConfig(
      { name: "x" },
      { REFRESH_REPO: "a/b", REFRESH_WORKFLOW_FILE: "deploy.yml" },
      { migrationsDir: "m" },
    ).changed,
    false,
  );
  const bad = renderDeployConfig(
    { name: "x" },
    { ...env, REFRESH_REPO: "evil.com/a/b" },
    { migrationsDir: "m" },
  );
  assert.equal(bad.config.vars?.GITHUB_REPO, undefined);
});
