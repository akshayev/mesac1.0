#!/usr/bin/env node
// Deploy workflow, alumni form only: gives the Worker its two secrets (TURNSTILE_SECRET_KEY, SUBMISSION_SALT)
// with `wrangler secret bulk`. The values go to wrangler on stdin (no shell, no file, never printed) and are
// stored by Cloudflare as encrypted Worker secrets, not in wrangler.json.

import { spawnSync } from "node:child_process";

const CONFIG = process.env.WRANGLER_CONFIG || ".output/server/wrangler.json";
const secrets = {
  TURNSTILE_SECRET_KEY: String(process.env.TURNSTILE_SECRET_KEY ?? "").trim(),
  SUBMISSION_SALT: String(process.env.SUBMISSION_SALT ?? "").trim(),
};
const missing = Object.keys(secrets).filter((k) => !secrets[k]);
if (missing.length) {
  console.error(`upload-worker-secrets: ${missing.join(", ")} not set; nothing uploaded.`);
  process.exit(1);
}
const r = spawnSync("npx", ["--yes", "wrangler@4.166.0", "secret", "bulk", "--config", CONFIG], {
  input: JSON.stringify(secrets),
  stdio: ["pipe", "ignore", "inherit"],
  env: process.env,
});
if (r.status !== 0) {
  console.error("upload-worker-secrets: wrangler secret bulk failed.");
  process.exit(r.status ?? 1);
}
console.log(`upload-worker-secrets: ${Object.keys(secrets).length} secrets set on the Worker.`);
