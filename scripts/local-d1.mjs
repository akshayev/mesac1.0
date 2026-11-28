#!/usr/bin/env node
// Local admin database for development (stored in .wrangler/state, gitignored).
//
//   npm run db:migrate:local                         apply migrations/*.sql
//   npm run db:seed:local                            load the SAMPLE fixture rows
//   npm run db:admin:local -- you@example.com admin  add yourself (role admin or editor)
//
// Uses .wrangler/local/wrangler.json (local-only names, written by render-wrangler --local).

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addAdminSql } from "./lib/d1-sql.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = ".wrangler/local/wrangler.json";
const STATE = ".wrangler/state";
const WRANGLER = ["--yes", "wrangler@4.166.0"];

function run(cmd, args, extraEnv = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const wrangler = (...args) =>
  run("npx", [...WRANGLER, ...args, "--local", "--persist-to", STATE, "--config", CONFIG]);

function executeSql(sql, name) {
  const file = join(ROOT, ".wrangler/import", name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, sql, { mode: 0o600 });
  try {
    wrangler("d1", "execute", "DB", "--file", file);
  } finally {
    rmSync(file, { force: true });
  }
}

const [command, ...rest] = process.argv.slice(2);
run(process.execPath, ["scripts/render-wrangler.mjs", "--local"]);

if (command === "migrate") {
  wrangler("d1", "migrations", "apply", "DB");
} else if (command === "seed") {
  wrangler("d1", "migrations", "apply", "DB");
  const out = ".wrangler/import/seed.d1-import.sql";
  run(process.execPath, ["scripts/import-sheet-to-d1.mjs", "--fixtures", "--out", out]);
  try {
    wrangler("d1", "execute", "DB", "--file", join(ROOT, out));
  } finally {
    rmSync(join(ROOT, out), { force: true });
  }
} else if (command === "add-admin") {
  const [email, role = "admin"] = rest;
  let sql;
  try {
    sql = addAdminSql(email, role);
  } catch (err) {
    console.error(
      `db:admin:local: ${err.message}. Usage: npm run db:admin:local -- you@example.com admin`,
    );
    process.exit(1);
  }
  wrangler("d1", "migrations", "apply", "DB");
  executeSql(sql, "add-admin.sql");
} else {
  console.error(
    "usage: node scripts/local-d1.mjs migrate | seed | add-admin <email> [admin|editor]",
  );
  process.exit(1);
}
