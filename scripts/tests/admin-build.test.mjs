// The local sign-in shortcut must not exist in a production build, and the deploy check must notice if a
// development build is about to be deployed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDefines, isDevAdminBuild, outputDir } from "../lib/build-flags.mjs";

const REPO = fileURLToPath(new URL("../..", import.meta.url));

test("only MESAC_DEV_ADMIN_BUILD=1 turns the flag on, and it moves the output to .output-dev", () => {
  assert.deepEqual(buildDefines({}), { __MESAC_DEV_ADMIN__: "false" });
  assert.deepEqual(buildDefines({ MESAC_DEV_ADMIN_BUILD: "true" }), {
    __MESAC_DEV_ADMIN__: "false",
  });
  assert.deepEqual(buildDefines({ MESAC_DEV_ADMIN_BUILD: "1" }), { __MESAC_DEV_ADMIN__: "true" });
  assert.equal(outputDir({}), ".output");
  assert.equal(outputDir({ MESAC_DEV_ADMIN_BUILD: "1" }), ".output-dev");
  assert.equal(isDevAdminBuild({ NODE_ENV: "development" }), false);
});

async function bundleAuth(env) {
  const { build } = await import("vite");
  const outDir = mkdtempSync(join(tmpdir(), "mesac-auth-build-"));
  await build({
    configFile: false,
    logLevel: "silent",
    root: REPO,
    define: buildDefines(env),
    build: {
      ssr: join(REPO, "src/server/auth.ts"),
      outDir,
      emptyOutDir: true,
      minify: false,
      rollupOptions: { output: { format: "es" } },
    },
  });
  const text = readdirSync(outDir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => readFileSync(join(d.parentPath, d.name), "utf8"))
    .join("\n");
  rmSync(outDir, { recursive: true, force: true });
  return text;
}

test("a production build of the auth code contains no trace of the dev sign-in shortcut", async () => {
  const prod = await bundleAuth({});
  assert.match(prod, /cf-access-jwt-assertion/, "sanity: the real check is there");
  assert.doesNotMatch(prod, /ADMIN_DEV_EMAIL|devBypassEmail|localhost/);
  // Control: the same build with the flag on does contain it, so the test above is meaningful.
  const dev = await bundleAuth({ MESAC_DEV_ADMIN_BUILD: "1" });
  assert.match(dev, /ADMIN_DEV_EMAIL/);
});

function checkDeploy(env) {
  return spawnSync(process.execPath, [join(REPO, "scripts/check-deploy.mjs")], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, SITE_URL: "https://real.example.org", DEPLOY: "1", ...env },
  });
}

function fakeSite({ drive = "drive", sheet = "sheet", server = {}, config = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "mesac-check-"));
  mkdirSync(join(root, "data"));
  mkdirSync(join(root, ".output/server"), { recursive: true });
  writeFileSync(join(root, "data/drive-report.md"), `{"source": "${drive}"}`);
  writeFileSync(join(root, "data/sheet-report.md"), `{"source": "${sheet}"}`);
  writeFileSync(
    join(root, ".output/server/wrangler.json"),
    JSON.stringify({ name: "x", ...config }),
  );
  for (const [name, text] of Object.entries(server))
    writeFileSync(join(root, ".output/server", name), text);
  return {
    root,
    env: {
      CHECK_DEPLOY_DATA_DIR: join(root, "data"),
      CHECK_DEPLOY_OUTPUT_DIR: join(root, ".output"),
    },
  };
}

const ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const D1 = { d1_databases: [{ binding: "DB", database_id: ID }] };

test("check:deploy: a development build or a local database id is refused", () => {
  for (const server of [
    { "index.mjs": "const e = env.ADMIN_DEV_EMAIL;" },
    { "chunk.mjs": '"local-dev-only-not-for-deploy"' },
  ]) {
    const { root, env } = fakeSite({ server });
    const r = checkDeploy(env);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stderr, /local development build/);
    rmSync(root, { recursive: true, force: true });
  }
  const { root, env } = fakeSite({ server: { "index.mjs": "ok" } });
  assert.equal(checkDeploy(env).status, 0);
  rmSync(root, { recursive: true, force: true });
});

test("check:deploy: admin mode accepts a sample Sheet report but needs the matching D1 binding", () => {
  let site = fakeSite({ sheet: "fixture", config: D1 });
  assert.equal(
    checkDeploy({ ...site.env, D1_DATABASE_ID: ID }).status,
    0,
    "D1 mode: Sheet sample is fine",
  );
  assert.equal(
    checkDeploy({ ...site.env, D1_DATABASE_ID: "3f2b8c1e-4d5a-4b6c-8d7e-000000000001" }).status,
    1,
    "id mismatch",
  );
  assert.equal(
    checkDeploy(site.env).status,
    1,
    "binding present without D1_DATABASE_ID (and Sheet sample)",
  );
  rmSync(site.root, { recursive: true, force: true });
  site = fakeSite({ sheet: "fixture" });
  assert.equal(
    checkDeploy({ ...site.env, D1_DATABASE_ID: ID }).status,
    1,
    "D1 set but build not rendered",
  );
  rmSync(site.root, { recursive: true, force: true });
  site = fakeSite({ drive: "fixture", config: D1 });
  assert.equal(
    checkDeploy({ ...site.env, D1_DATABASE_ID: ID }).status,
    1,
    "Drive sample still refused",
  );
  rmSync(site.root, { recursive: true, force: true });
});

test("check:deploy: a Turnstile test site key in the built Worker is refused", () => {
  const site = fakeSite({
    sheet: "fixture",
    config: { ...D1, vars: { TURNSTILE_SITE_KEY: "1x00000000000000000000AA" } },
  });
  const r = checkDeploy({ ...site.env, D1_DATABASE_ID: ID });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Turnstile test site key/);
  rmSync(site.root, { recursive: true, force: true });
  const real = fakeSite({
    sheet: "fixture",
    config: { ...D1, vars: { TURNSTILE_SITE_KEY: "0x4AAAAAAAsampleSITEkey" } },
  });
  assert.equal(checkDeploy({ ...real.env, D1_DATABASE_ID: ID }).status, 0);
  rmSync(real.root, { recursive: true, force: true });
});
