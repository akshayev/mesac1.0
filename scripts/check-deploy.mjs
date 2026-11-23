#!/usr/bin/env node
// Pre-deploy guard: refuse to ship sample data.
//   DEPLOY=1 npm run check:deploy   -> exit 1 if data/drive-report.md or data/sheet-report.md says "source": "fixture"
//   npm run check:deploy            -> always exit 0 (just prints a note)
// CHECK_DEPLOY_DATA_DIR overrides the data folder (used by the tests).

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.CHECK_DEPLOY_DATA_DIR || join(ROOT, "data");
const deploying = ["1", "true"].includes(String(process.env.DEPLOY ?? "").toLowerCase());

const REPORTS = [
  ["data/drive-report.md", "npm run data:archive (needs GOOGLE_API_KEY)"],
  ["data/sheet-report.md", "npm run data:sheet (needs SHEET_*_CSV)"],
];

const problems = [];
for (const [rel, fix] of REPORTS) {
  const file = join(dataDir, rel.replace(/^data\//, ""));
  if (!existsSync(file)) {
    problems.push(`${rel} is missing. Run ${fix}.`);
    continue;
  }
  if (/"source":\s*"fixture"/.test(readFileSync(file, "utf8"))) {
    problems.push(
      `${rel} says "source": "fixture" (sample data). Run ${fix}, then commit the result.`,
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
