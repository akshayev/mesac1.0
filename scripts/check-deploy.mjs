#!/usr/bin/env node
// Pre-deploy guard: refuse to ship sample data.
//   DEPLOY=1 npm run check:deploy   -> exit 1 if data/drive-report.md or data/sheet-report.md says "source": "fixture"
//   npm run check:deploy            -> always exit 0 (just prints a note)
// It also fails if SITE_URL is empty or the placeholder (canonical links and the sitemap would be wrong), and
// checks the built Worker (.output/server):
//   - it must not contain the local-development sign-in shortcut or the local database id;
//   - with D1_DATABASE_ID set (admin dashboard mode) the D1 binding must use exactly that id, and the Sheet
//     report may be sample data (pages read D1); without it there must be no D1 binding at all.
// CHECK_DEPLOY_DATA_DIR and CHECK_DEPLOY_OUTPUT_DIR override the folders (used by the tests).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { isPlaceholderSiteUrl } from "./lib/seo.mjs";
import { d1Id, LOCAL_DB_ID } from "./lib/wrangler-config.mjs";
import { isTurnstileTestKey } from "./lib/features.mjs";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.CHECK_DEPLOY_DATA_DIR || join(ROOT, "data");
const outputDir = process.env.CHECK_DEPLOY_OUTPUT_DIR || join(ROOT, ".output");
const deploying = ["1", "true"].includes(String(process.env.DEPLOY ?? "").toLowerCase());
const d1Mode = String(process.env.D1_DATABASE_ID ?? "").trim() !== "";

const REPORTS = [
  ["data/drive-report.md", "the GOOGLE_API_KEY and DRIVE_ROOT_ID secrets"],
  ["data/sheet-report.md", "the five SHEET_*_CSV secrets"],
];

const problems = [];
for (const [rel, fix] of REPORTS) {
  const file = join(dataDir, rel.replace(/^data\//, ""));
  if (!existsSync(file)) {
    problems.push(`${rel} is missing. Check ${fix}, then run the build again.`);
    continue;
  }
  if (/"source":\s*"fixture"/.test(readFileSync(file, "utf8"))) {
    if (d1Mode && rel === "data/sheet-report.md") {
      console.log("check:deploy: Sheet report is sample data; fine, pages read the D1 database.");
      continue;
    }
    problems.push(
      `${rel} says "source": "fixture" (sample data). Check ${fix} (HANDOVER.md section 6), then run the build again. Do not commit real reports.`,
    );
  }
}

if (isPlaceholderSiteUrl(process.env.SITE_URL)) {
  problems.push(
    "SITE_URL is not set (or is the placeholder). Set it to the site's public address.",
  );
}

// Markers that only a development build or the local config contain.
const DEV_MARKERS = ["ADMIN_DEV_EMAIL", "MEDIA_CLEANUP_MIN_AGE_HOURS", LOCAL_DB_ID];
function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}
const serverDir = join(outputDir, "server");
if (existsSync(serverDir)) {
  for (const f of files(serverDir)) {
    if (!/\.(m?js|json)$/.test(f)) continue;
    const text = readFileSync(f, "utf8");
    const hit = DEV_MARKERS.find((m) => text.includes(m));
    if (hit) {
      problems.push(
        `${f.slice(outputDir.length - ".output".length)} contains "${hit}": this is a local development build. Run npm run build.`,
      );
      break;
    }
  }
  const configFile = join(serverDir, "wrangler.json");
  const config = existsSync(configFile) ? JSON.parse(readFileSync(configFile, "utf8")) : {};
  const bound = config.d1_databases?.find((d) => d.binding === "DB")?.database_id;
  if (d1Mode && bound !== d1Id(process.env.D1_DATABASE_ID)) {
    problems.push(
      "D1_DATABASE_ID is set but the built Worker does not use it. Run npm run build with D1_DATABASE_ID set.",
    );
  }
  if (isTurnstileTestKey(config.vars?.TURNSTILE_SITE_KEY)) {
    problems.push(
      "The built Worker uses a Turnstile test site key. Set the real TURNSTILE_SITE_KEY variable.",
    );
  }
  if (!d1Mode && bound) {
    problems.push(
      "The built Worker has a D1 database but D1_DATABASE_ID is not set. Run npm run build again.",
    );
  }
}

if (problems.length === 0) {
  console.log("check:deploy: OK, all reports come from real sources.");
} else if (deploying) {
  console.error("check:deploy: FAILED (DEPLOY is set)");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
} else {
  console.log("check:deploy: sample data present (ignored because DEPLOY is not set)");
  for (const p of problems) console.log(`  - ${p}`);
}
