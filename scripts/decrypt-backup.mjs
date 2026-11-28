#!/usr/bin/env node
// Turns a downloaded backup (mesac-admin-....sql.gz.enc) back into SQL, for a restore
// (docs/OWNERS-START-HERE.md, Part D). The passphrase is read from BACKUP_PASSPHRASE, never typed on the
// command line:
//
//   read -s BACKUP_PASSPHRASE && export BACKUP_PASSPHRASE
//   node scripts/decrypt-backup.mjs mesac-admin-2026-12-06-21-00.sql.gz.enc
//
// Writes mesac-admin-....sql next to it. That file contains personal data: delete it after the restore.

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { decryptArgs, openssl } from "./lib/backup.mjs";

const input = process.argv[2];
if (!input || !input.endsWith(".sql.gz.enc")) {
  console.error(
    "usage: node scripts/decrypt-backup.mjs <backup.sql.gz.enc>  (BACKUP_PASSPHRASE in the environment)",
  );
  process.exit(1);
}
if (!process.env.BACKUP_PASSPHRASE) {
  console.error("decrypt-backup: set BACKUP_PASSPHRASE first.");
  process.exit(1);
}
const gz = input.replace(/\.enc$/, "");
const sql = gz.replace(/\.gz$/, "");
try {
  if (!openssl(decryptArgs(input, gz), process.env.BACKUP_PASSPHRASE)) {
    console.error("decrypt-backup: could not decrypt (wrong passphrase or damaged file).");
    process.exit(1);
  }
  writeFileSync(sql, gunzipSync(readFileSync(gz)), { mode: 0o600 });
  console.log(`decrypt-backup: wrote ${sql} (contains personal data: delete it after use)`);
} finally {
  rmSync(gz, { force: true });
}
