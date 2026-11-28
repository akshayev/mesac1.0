// Encrypted backups of the admin database (scripts/backup-d1.mjs, scripts/decrypt-backup.mjs).
// openssl reads the passphrase from the BACKUP_PASSPHRASE environment variable (`-pass env:...`), so it never
// appears on a command line, in a process list or in a log. Tested in scripts/tests/backup.test.mjs.

import { spawnSync } from "node:child_process";

export const MIN_PASSPHRASE = 20;

// AES-256 (CBC) with a key derived by PBKDF2 (SHA-256, 600,000 rounds) and a random salt.
const CIPHER = ["-aes-256-cbc", "-pbkdf2", "-iter", "600000", "-md", "sha256"];

export const encryptArgs = (input, output) => [
  "enc",
  ...CIPHER,
  "-salt",
  "-in",
  input,
  "-out",
  output,
  "-pass",
  "env:BACKUP_PASSPHRASE",
];

export const decryptArgs = (input, output) => [
  "enc",
  "-d",
  ...CIPHER,
  "-in",
  input,
  "-out",
  output,
  "-pass",
  "env:BACKUP_PASSPHRASE",
];

/** Runs openssl with only PATH and the passphrase in its environment. Returns true on success. */
export function openssl(args, passphrase) {
  const r = spawnSync("openssl", args, {
    env: { PATH: process.env.PATH, BACKUP_PASSPHRASE: passphrase },
    stdio: ["ignore", "ignore", "ignore"],
  });
  return r.status === 0;
}

/** "INSERT INTO team_members ..." lines per table, from a D1 export. Counts only, never values. */
export function countRows(sql) {
  const counts = {};
  for (const m of String(sql).matchAll(/^INSERT INTO\s+"?([A-Za-z0-9_]+)"?/gm))
    counts[m[1]] = (counts[m[1]] ?? 0) + 1;
  return counts;
}

export function checkPassphrase(raw) {
  const s = String(raw ?? "");
  if (!s) return "BACKUP_PASSPHRASE is not set.";
  if (s.length < MIN_PASSPHRASE)
    return `BACKUP_PASSPHRASE must be at least ${MIN_PASSPHRASE} characters.`;
  return "";
}
