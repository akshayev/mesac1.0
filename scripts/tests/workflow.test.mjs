import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// js-yaml ships with the eslint toolchain; skip (rather than fail) if it is ever not installed.
let yaml = null;
try {
  yaml = (await import("js-yaml")).default;
} catch {
  /* skip below */
}

const file = new URL("../../.github/workflows/deploy.yml", import.meta.url);
const text = readFileSync(file, "utf8");
const doc = yaml ? yaml.load(text) : null;
const opts = { skip: yaml ? false : "js-yaml not installed" };

test("workflow triggers: push to main, manual run and a nightly 20:30 UTC schedule", opts, () => {
  assert.deepEqual(doc.on.push.branches, ["main"]);
  assert.ok("workflow_dispatch" in doc.on);
  assert.deepEqual(doc.on.schedule, [{ cron: "30 20 * * *" }]);
});

test("workflow is least-privilege and never overlaps", opts, () => {
  assert.deepEqual(doc.permissions, { contents: "read" });
  assert.equal(doc.concurrency["cancel-in-progress"], false);
  assert.ok(doc.concurrency.group);
});

test("steps run in order: tests, build, check:deploy, deploy", opts, () => {
  const steps = doc.jobs.deploy.steps;
  const idx = (needle) => steps.findIndex((s) => String(s.run ?? s.uses ?? "").includes(needle));
  const order = [
    idx("npm run test:data"),
    idx("npm run build"),
    idx("npm run check:deploy"),
    idx("cloudflare/wrangler-action"),
  ];
  assert.ok(
    order.every((i) => i >= 0),
    `missing step: ${order}`,
  );
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
  assert.equal(
    steps.some((s) => String(s.run ?? "").includes("data:all")),
    false,
  );
  assert.equal(steps[idx("npm run check:deploy")].env.DEPLOY, "1");
  // The data guards run during the build, which regenerates the reports read by check:deploy.
  assert.equal(steps[idx("npm run build")].env.DEPLOY, "1");
});

test("the data reports are uploaded even when a step fails", opts, () => {
  const step = doc.jobs.deploy.steps.find((s) =>
    String(s.uses ?? "").startsWith("actions/upload-artifact"),
  );
  assert.ok(step, "no upload-artifact step");
  assert.equal(step.if, "always()");
});

test("every action is pinned to a major version", opts, () => {
  for (const s of doc.jobs.deploy.steps) {
    if (s.uses) assert.match(s.uses, /@v\d+$/, s.uses);
  }
});

test("the workflow only reads the documented secrets", opts, () => {
  const used = [...text.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]);
  const allowed = new Set([
    "GOOGLE_API_KEY",
    "DRIVE_ROOT_ID",
    "SHEET_TEAM_CSV",
    "SHEET_ACHIEVEMENTS_CSV",
    "SHEET_PLACEMENTS_CSV",
    "SHEET_ALUMNI_CSV",
    "SHEET_SETTINGS_CSV",
    "VITE_REPORT_FORM_URL",
    "VITE_REPORT_FORM_FILE_ENTRY",
    "SITE_URL",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
  ]);
  for (const name of used) assert.ok(allowed.has(name), `unexpected secret ${name}`);
  assert.equal(new Set(used).size >= 12, true);
});

test("no risky triggers, no secret echo, no untrusted input in run scripts", opts, () => {
  assert.ok(!("pull_request_target" in doc.on) && !("pull_request" in doc.on));
  for (const s of doc.jobs.deploy.steps) {
    const script = String(s.run ?? "");
    assert.doesNotMatch(script, /\$\{\{\s*(secrets|github\.event)\./, s.name);
    assert.doesNotMatch(script, /\b(echo|printf)\b.*\$\{?[A-Z_]*(KEY|TOKEN|SECRET)/, s.name);
  }
});

test("guards compare against the last good run, restored before the build", opts, () => {
  const steps = doc.jobs.deploy.steps;
  const restore = steps.findIndex(
    (s) =>
      String(s.uses ?? "").startsWith("actions/cache") &&
      String(s.with?.key ?? "").startsWith("last-good-data-"),
  );
  const build = steps.findIndex((s) => String(s.run ?? "").includes("npm run build"));
  assert.ok(restore >= 0 && restore < build, "snapshot must be restored before the build");
  assert.match(steps[restore].with.path, /data\/drive-files\.json/);
  for (const tab of ["team", "achievements", "placements", "alumni", "settings"]) {
    assert.ok(steps[restore].with.path.includes(`src/data/generated/${tab}.json`), tab);
    assert.ok(`SHEET_${tab.toUpperCase()}_CSV` in steps[build].env, tab);
  }
  assert.ok("allow_shrink" in doc.on.workflow_dispatch.inputs);
  assert.match(String(steps[build].env.ARCHIVE_ALLOW_SHRINK), /inputs\.allow_shrink/);
});

test("the job only deploys from main", opts, () => {
  assert.match(doc.jobs.deploy.if, /refs\/heads\/main/);
});

test("HANDOVER lists exactly the secrets the workflow reads", () => {
  const handover = readFileSync(new URL("../../HANDOVER.md", import.meta.url), "utf8");
  const table = handover.split("## 6. Secrets")[1].split("### Address of the site")[0];
  const listed = [...table.matchAll(/^\| `([A-Z0-9_]+)`/gm)].map((m) => m[1]);
  const used = new Set([...text.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]));
  assert.deepEqual(listed.sort(), [...used].sort());
  assert.match(handover, new RegExp(`All ${used.size} secrets`));
});
