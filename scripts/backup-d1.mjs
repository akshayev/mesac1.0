#!/usr/bin/env node
// Weekly backup of the admin database (.github/workflows/backup.yml):
//   1. `wrangler d1 export` the whole database to SQL (needs D1_DATABASE_ID and the Cloudflare token/account)
//   2. gzip it
//   3. encrypt it with BACKUP_PASSPHRASE (openssl AES-256, PBKDF2; passphrase read from the environment)
//   4. delete the plaintext files
// Prints only the encrypted file's size and the number of rows per table (no values).
//
//   --input <file.sql>   use an existing SQL file instead of exporting (tests, or re-encrypting a file)
//   --out-dir <folder>   default: backup/

import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { checkPassphrase, countRows, encryptArgs, openssl } from "./lib/backup.mjs";
import { d1Id, parseJsonc, renderBackupConfig } from "./lib/wrangler-config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const fail = (message) => {
  console.error(`backup-d1: ${message}`);
  process.exit(1);
};

const passphrase = process.env.BACKUP_PASSPHRASE ?? "";
const problem = checkPassphrase(passphrase);
if (problem) fail(problem);

const outDir = resolve(option("--out-dir") ?? join(ROOT, "backup"));
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const sqlFile = join(outDir, `mesac-admin-${stamp}.sql`);
const gzFile = `${sqlFile}.gz`;
const encFile = `${gzFile}.enc`;

try {
  if (option("--input")) {
    writeFileSync(sqlFile, readFileSync(resolve(option("--input"))), { mode: 0o600 });
  } else {
    const id = d1Id(process.env.D1_DATABASE_ID);
    if (!id) fail("D1_DATABASE_ID is missing or not a D1 database id.");
    const configDir = join(ROOT, ".wrangler/backup");
    mkdirSync(configDir, { recursive: true });
    const base = parseJsonc(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"));
    writeFileSync(
      join(configDir, "wrangler.json"),
      JSON.stringify(renderBackupConfig(base, id), null, 2),
    );
    const r = spawnSync(
      "npx",
      [
        "--yes",
        "wrangler@4.166.0",
        "d1",
        "export",
        "DB",
        "--remote",
        "--config",
        join(configDir, "wrangler.json"),
        "--output",
        sqlFile,
      ],
      { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"], env: process.env },
    );
    if (r.status !== 0) fail("wrangler d1 export failed.");
  }

  const sql = readFileSync(sqlFile, "utf8");
  const counts = countRows(sql);
  writeFileSync(gzFile, gzipSync(sql), { mode: 0o600 });
  if (!openssl(encryptArgs(gzFile, encFile), passphrase))
    fail("encryption failed (is openssl installed?).");

  const size = statSync(encFile).size;
  const lines = [
    `Encrypted backup: ${encFile.slice(outDir.length + 1)} (${size} bytes)`,
    ...Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([table, n]) => `  ${table}: ${n} rows`),
  ];
  console.log(`backup-d1: ${lines.join("\n")}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Database backup\n\n${lines.map((l) => `- ${l.trim()}`).join("\n")}\n\nPhotos (R2) are not included.\n`,
    );
  }
} finally {
  // The unencrypted copies never outlive this script.
  rmSync(sqlFile, { force: true });
  rmSync(gzFile, { force: true });
}
