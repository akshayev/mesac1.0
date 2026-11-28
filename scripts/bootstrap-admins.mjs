#!/usr/bin/env node
// First admins for the dashboard, run by the deploy workflow after the database migrations.
//
// Reads ADMIN_BOOTSTRAP_EMAILS (comma-separated). Every entry must be a plain email address or nothing is
// done. The emails are inserted only while the admins table is EMPTY, in one statement, so this is safe
// to leave in place: once the first admin exists it never adds anyone again. (The owner guide still says
// to delete the secret after the first deploy.)
//
// Runs `wrangler d1 execute DB --remote --file <tmp>` without a shell. Prints counts only, never emails.
//   --dry-run   validate and print the number of emails, run nothing

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapSql, parseEmailList } from "./lib/d1-sql.mjs";

const CONFIG = process.env.WRANGLER_CONFIG || ".output/server/wrangler.json";

let emails;
try {
  emails = parseEmailList(process.env.ADMIN_BOOTSTRAP_EMAILS);
} catch (err) {
  console.error(`bootstrap-admins: ADMIN_BOOTSTRAP_EMAILS: ${err.message}. Nothing was changed.`);
  process.exit(1);
}
if (!emails.length) {
  console.log("bootstrap-admins: ADMIN_BOOTSTRAP_EMAILS is empty, nothing to do.");
  process.exit(0);
}
if (process.argv.includes("--dry-run")) {
  console.log(`bootstrap-admins: ${emails.length} valid email(s); dry run, nothing executed.`);
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "mesac-bootstrap-"));
const file = join(dir, "bootstrap.sql");
try {
  writeFileSync(file, bootstrapSql(emails), { mode: 0o600 });
  const r = spawnSync(
    "npx",
    [
      "--yes",
      "wrangler@4.166.0",
      "d1",
      "execute",
      "DB",
      "--remote",
      "--file",
      file,
      "--config",
      CONFIG,
    ],
    { stdio: ["ignore", "ignore", "inherit"], env: process.env },
  );
  if (r.status !== 0) {
    console.error("bootstrap-admins: wrangler d1 execute failed.");
    process.exit(r.status ?? 1);
  }
  console.log(
    `bootstrap-admins: done (${emails.length} email(s) offered; added only if the admins table was empty).`,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
