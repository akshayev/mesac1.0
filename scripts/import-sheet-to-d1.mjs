#!/usr/bin/env node
// One-time move of the Google Sheet content into the admin database (D1). Writes a SQL file; it never
// touches the network or a database itself. The owner then runs that file once (see
// docs/OWNER-DEPLOYMENT-GUIDE.md):
//
//   node scripts/import-sheet-to-d1.mjs                      from src/data/generated/*.json (the snapshots
//                                                            `npm run data:sheet` wrote with the real links)
//   node scripts/import-sheet-to-d1.mjs --csv <folder>       from team.csv, achievements.csv, ... downloaded
//                                                            from the Sheet (File > Download > CSV, per tab)
//   node scripts/import-sheet-to-d1.mjs --fixtures           the SAMPLE rows (used by db:seed:local)
//   --out <file>   where to write (default .wrangler/import/sheet-import.d1-import.sql; gitignored)
//   --allow-sample allow snapshots that are still sample data
//
// Alumni rows without consent are skipped (the same rule as the website). Prints counts only.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importSql } from "./lib/d1-sql.mjs";
import { TABS } from "./lib/sheet.mjs";

const ROOT = process.env.MESAC_PROJECT_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function fail(message) {
  console.error(`import-sheet-to-d1: ${message}`);
  process.exit(1);
}

function fromCsv(dir) {
  const data = {};
  let skipped = 0;
  for (const [tab, { normalize }] of Object.entries(TABS)) {
    const file = join(dir, `${tab}.csv`);
    if (!existsSync(file)) {
      console.warn(`  ${tab}: no ${tab}.csv, skipped`);
      continue;
    }
    const result = normalize(readFileSync(file, "utf8"));
    data[tab] = result.items;
    skipped += result.skippedNoConsent ?? 0;
  }
  return { data, skipped };
}

function fromSnapshots() {
  const data = {};
  const sample = [];
  for (const tab of Object.keys(TABS)) {
    const snap = JSON.parse(readFileSync(join(ROOT, `src/data/generated/${tab}.json`), "utf8"));
    if (snap.source !== "sheet") sample.push(tab);
    data[tab] = snap.items;
  }
  if (sample.length && !flag("--allow-sample"))
    fail(
      `these snapshots are sample data: ${sample.join(", ")}. Run npm run data:sheet with the real SHEET_*_CSV links first, or use --csv.`,
    );
  return { data, skipped: 0 };
}

const csvDir = flag("--fixtures") ? join(ROOT, "scripts/fixtures/sheet-sample") : option("--csv");
const { data, skipped } = csvDir ? fromCsv(resolve(csvDir)) : fromSnapshots();
const out = resolve(ROOT, option("--out") ?? ".wrangler/import/sheet-import.d1-import.sql");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, importSql(data), { mode: 0o600 });
const count = (v) => (Array.isArray(v) ? v.length : Object.keys(v ?? {}).length);
console.log(
  `import-sheet-to-d1: ${Object.entries(data)
    .map(([k, v]) => `${k} ${count(v)}`)
    .join(", ")}${skipped ? `; ${skipped} alumni rows skipped (no consent)` : ""}`,
);
console.log(
  `  wrote ${out.startsWith(ROOT) ? out.slice(ROOT.length + 1) : out} (personal data: delete it after use)`,
);
