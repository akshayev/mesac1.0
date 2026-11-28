#!/usr/bin/env node
// Deploy workflow: gives the Worker its optional secrets with `wrangler secret bulk`. The values go to
// wrangler on stdin (no shell, no file, never printed) and Cloudflare stores them encrypted; they are never in
// wrangler.json.
//   UPLOAD_SUBMISSIONS=true  -> TURNSTILE_SECRET_KEY, SUBMISSION_SALT (public alumni form)
//   UPLOAD_REFRESH=true      -> GITHUB_DISPATCH_TOKEN, from the PAPERS_REFRESH_TOKEN secret (GitHub does not
//                               allow secret names starting with GITHUB_, the Worker name is kept as designed)

import { spawnSync } from "node:child_process";

const CONFIG = process.env.WRANGLER_CONFIG || ".output/server/wrangler.json";
const on = (k) => String(process.env[k] ?? "").trim() === "true";
const value = (k) => String(process.env[k] ?? "").trim();

const secrets = {};
const missing = [];
const want = (workerName, envName) => {
  if (value(envName)) secrets[workerName] = value(envName);
  else missing.push(envName);
};
if (on("UPLOAD_SUBMISSIONS")) {
  want("TURNSTILE_SECRET_KEY", "TURNSTILE_SECRET_KEY");
  want("SUBMISSION_SALT", "SUBMISSION_SALT");
}
if (on("UPLOAD_REFRESH")) want("GITHUB_DISPATCH_TOKEN", "PAPERS_REFRESH_TOKEN");

if (missing.length) {
  console.error(`upload-worker-secrets: ${missing.join(", ")} not set; nothing uploaded.`);
  process.exit(1);
}
if (Object.keys(secrets).length === 0) {
  console.log("upload-worker-secrets: no optional feature needs a Worker secret; nothing to do.");
  process.exit(0);
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
console.log(`upload-worker-secrets: set ${Object.keys(secrets).join(", ")} on the Worker.`);
