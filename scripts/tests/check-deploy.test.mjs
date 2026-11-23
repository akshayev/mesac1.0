import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const script = new URL("../check-deploy.mjs", import.meta.url).pathname;
const report = (source) => `# r\n\n\`\`\`json\n{\n  "source": "${source}"\n}\n\`\`\`\n`;

function run(driveSource, sheetSource, deploy, siteUrl = "https://real.example.org") {
  const dir = mkdtempSync(join(tmpdir(), "check-deploy-"));
  if (driveSource) writeFileSync(join(dir, "drive-report.md"), report(driveSource));
  if (sheetSource) writeFileSync(join(dir, "sheet-report.md"), report(sheetSource));
  const env = { ...process.env, CHECK_DEPLOY_DATA_DIR: dir };
  delete env.DEPLOY;
  delete env.SITE_URL;
  if (siteUrl) env.SITE_URL = siteUrl;
  if (deploy) env.DEPLOY = deploy;
  return spawnSync(process.execPath, [script], { env, encoding: "utf8" }).status;
}

test("DEPLOY=1 fails when either report is fixture", () => {
  assert.equal(run("fixture", "sheet", "1"), 1);
  assert.equal(run("drive", "fixture", "1"), 1);
  assert.equal(run("fixture", "fixture", "1"), 1);
});

test("DEPLOY=1 fails when a report is missing", () => {
  assert.equal(run("drive", null, "1"), 1);
});

test("DEPLOY=1 passes with real sources", () => {
  assert.equal(run("drive", "sheet", "1"), 0);
});

test("DEPLOY=1 fails when SITE_URL is missing or the placeholder", () => {
  assert.equal(run("drive", "sheet", "1", ""), 1);
  assert.equal(run("drive", "sheet", "1", "https://mesac.example"), 1);
  assert.equal(run("drive", "sheet", "1", "https://real.example.org"), 0);
});

test("without DEPLOY it always exits 0", () => {
  assert.equal(run("fixture", "fixture", undefined), 0);
  assert.equal(run(null, null, undefined), 0);
});

test("the committed drive report is marked as fixture or drive", () => {
  const out = spawnSync(
    process.execPath,
    [
      "-e",
      `
    const t=require("fs").readFileSync("data/drive-report.md","utf8");
    process.exit(/"source":\\s*"(fixture|drive)"/.test(t)?0:1)`,
    ],
    { cwd: new URL("../..", import.meta.url).pathname },
  );
  assert.equal(out.status, 0);
});
