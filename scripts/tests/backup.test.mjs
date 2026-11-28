// Encrypted database backups: scripts/lib/backup.mjs, scripts/backup-d1.mjs, scripts/decrypt-backup.mjs and
// .github/workflows/backup.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPassphrase, countRows, decryptArgs, encryptArgs, openssl } from "../lib/backup.mjs";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const PASS = "sample backup passphrase for tests only";
const SQL = [
  "PRAGMA defer_foreign_keys=TRUE;",
  "CREATE TABLE alumni (id TEXT PRIMARY KEY, name TEXT, phone TEXT);",
  "INSERT INTO \"alumni\" VALUES('a1','SAMPLE Secret Person','+910000000042');",
  "INSERT INTO alumni VALUES('a2','SAMPLE Other','');",
  "INSERT INTO \"team_members\" VALUES('t1','SAMPLE Team');",
].join("\n");
const node = (args, env = {}) =>
  spawnSync(process.execPath, args, { encoding: "utf8", env: { PATH: process.env.PATH, ...env } });

let yaml = null;
try {
  yaml = (await import("js-yaml")).default;
} catch {
  /* skipped below */
}
const opts = { skip: yaml ? false : "js-yaml not installed" };
const text = readFileSync(join(REPO, ".github/workflows/backup.yml"), "utf8");
const doc = yaml ? yaml.load(text) : null;

test("passphrase rules and row counts (no values)", () => {
  assert.match(checkPassphrase(""), /not set/);
  assert.match(checkPassphrase("short"), /at least 20/);
  assert.equal(checkPassphrase(PASS), "");
  assert.deepEqual(countRows(SQL), { alumni: 2, team_members: 1 });
});

test("the passphrase never appears on the openssl command line", () => {
  for (const args of [encryptArgs("in", "out"), decryptArgs("in", "out")]) {
    assert.ok(args.includes("env:BACKUP_PASSPHRASE"));
    assert.ok(args.includes("-pbkdf2") && args.includes("-aes-256-cbc"));
    assert.ok(!args.some((a) => a.includes(PASS)));
  }
});

test("encrypt / decrypt round trip; wrong passphrase fails; ciphertext hides the content", () => {
  const dir = mkdtempSync(join(tmpdir(), "mesac-backup-"));
  try {
    writeFileSync(join(dir, "plain.txt"), SQL);
    assert.equal(openssl(encryptArgs(join(dir, "plain.txt"), join(dir, "x.enc")), PASS), true);
    const cipher = readFileSync(join(dir, "x.enc"));
    assert.ok(cipher.subarray(0, 8).toString() === "Salted__");
    assert.ok(!cipher.includes("SAMPLE Secret Person"));
    assert.equal(openssl(decryptArgs(join(dir, "x.enc"), join(dir, "back.txt")), PASS), true);
    assert.equal(readFileSync(join(dir, "back.txt"), "utf8"), SQL);
    assert.equal(
      openssl(
        decryptArgs(join(dir, "x.enc"), join(dir, "bad.txt")),
        "a different passphrase entirely",
      ),
      false,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("backup-d1 + decrypt-backup scripts: only the encrypted file remains, output has counts only", () => {
  const dir = mkdtempSync(join(tmpdir(), "mesac-backup-cli-"));
  try {
    const input = join(dir, "export.sql");
    writeFileSync(input, SQL);
    const out = join(dir, "backup");
    const summary = join(dir, "summary.md");
    const r = node([join(REPO, "scripts/backup-d1.mjs"), "--input", input, "--out-dir", out], {
      BACKUP_PASSPHRASE: PASS,
      GITHUB_STEP_SUMMARY: summary,
    });
    assert.equal(r.status, 0, r.stderr);
    const files = readdirSync(out);
    assert.equal(files.length, 1);
    assert.match(files[0], /^mesac-admin-[\d-]+\.sql\.gz\.enc$/);
    for (const t of [r.stdout, r.stderr, readFileSync(summary, "utf8")]) {
      assert.doesNotMatch(t, /SAMPLE|0000000042|sample backup passphrase/);
    }
    assert.match(r.stdout, /alumni: 2 rows/);
    assert.match(readFileSync(summary, "utf8"), /Photos \(R2\) are not included/);

    const enc = join(out, files[0]);
    assert.equal(
      node([join(REPO, "scripts/decrypt-backup.mjs"), enc], {
        BACKUP_PASSPHRASE: "wrong passphrase, long enough",
      }).status,
      1,
    );
    const d = node([join(REPO, "scripts/decrypt-backup.mjs"), enc], { BACKUP_PASSPHRASE: PASS });
    assert.equal(d.status, 0, d.stderr);
    assert.equal(readFileSync(enc.replace(/\.gz\.enc$/, ""), "utf8"), SQL);
    assert.equal(
      node([join(REPO, "scripts/backup-d1.mjs"), "--input", input, "--out-dir", out], {
        BACKUP_PASSPHRASE: "short",
      }).status,
      1,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("backup workflow: weekly + manual, read-only, main only, no PR triggers", opts, () => {
  assert.deepEqual(doc.on.schedule, [{ cron: "0 21 * * 0" }]);
  assert.ok("workflow_dispatch" in doc.on);
  assert.ok(
    !("pull_request" in doc.on) && !("pull_request_target" in doc.on) && !("push" in doc.on),
  );
  assert.deepEqual(doc.permissions, { contents: "read" });
  assert.equal(doc.concurrency["cancel-in-progress"], false);
  assert.match(doc.jobs.backup.if, /refs\/heads\/main/);
});

test(
  "backup workflow: gated on the database, encrypt before upload, only .enc uploaded, cleaned up",
  opts,
  () => {
    const steps = doc.jobs.backup.steps;
    const find = (pred) => steps.findIndex(pred);
    const flag = find((s) => s.id === "features");
    const backup = find((s) => String(s.run ?? "").includes("scripts/backup-d1.mjs"));
    const upload = find((s) => String(s.uses ?? "").startsWith("actions/upload-artifact"));
    const cleanup = find((s) => String(s.run ?? "").includes("rm -rf backup"));
    assert.ok(flag >= 0 && flag < backup && backup < upload && upload < cleanup);
    assert.equal(steps[flag].run.trim(), "node scripts/check-features.mjs --d1-only");
    for (const i of [backup, upload])
      assert.equal(steps[i].if, "steps.features.outputs.d1 == 'true'");
    assert.equal(steps[cleanup].if, "always()");
    assert.equal(steps[upload].with.path, "backup/*.sql.gz.enc");
    assert.equal(steps[upload].with["retention-days"], 30);
    assert.equal(steps[upload].with["if-no-files-found"], "error");
    assert.match(steps[backup].env.BACKUP_PASSPHRASE, /secrets\.BACKUP_PASSPHRASE/);
    for (const s of steps) {
      if (s.uses) assert.match(s.uses, /@v\d+$/, s.uses);
      const script = String(s.run ?? "");
      assert.doesNotMatch(script, /\$\{\{\s*(secrets|github\.event)\./, s.name);
      assert.doesNotMatch(script, /\b(echo|printf)\b/, s.name);
    }
  },
);

test("check-features --d1-only: off without the secret, ignores other features", () => {
  const dir = mkdtempSync(join(tmpdir(), "mesac-d1only-"));
  try {
    const out = join(dir, "out");
    writeFileSync(out, "");
    const off = node([join(REPO, "scripts/check-features.mjs"), "--d1-only"], {
      GITHUB_OUTPUT: out,
      TURNSTILE_SITE_KEY: "x",
    });
    assert.equal(off.status, 0, off.stderr);
    assert.equal(readFileSync(out, "utf8"), "d1=false\n");
    writeFileSync(out, "");
    const on = node([join(REPO, "scripts/check-features.mjs"), "--d1-only"], {
      GITHUB_OUTPUT: out,
      D1_DATABASE_ID: "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e",
    });
    assert.equal(readFileSync(out, "utf8"), "d1=true\n");
    assert.doesNotMatch(on.stdout, /3f2b8c1e/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
