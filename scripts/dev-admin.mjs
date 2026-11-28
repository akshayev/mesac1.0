#!/usr/bin/env node
// Runs the site with a local admin database and photo store, so the dashboard can be tried without any
// Cloudflare account:
//
//   npm run db:admin:local -- you@example.com admin     (once)
//   ADMIN_DEV_EMAIL=you@example.com npm run dev:admin   then open http://localhost:8787/admin
//
// It makes a development build in .output-dev (with the localhost-only sign-in shortcut; the normal
// .output build never contains it), writes .wrangler/local/wrangler.json and starts `wrangler dev`
// with data kept in .wrangler/state. Stop it with Ctrl+C.

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { strictEmail } from "./lib/validate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const email = strictEmail(process.env.ADMIN_DEV_EMAIL);
if (!email) {
  console.error(
    "dev:admin: set ADMIN_DEV_EMAIL to the email you added with `npm run db:admin:local -- you@example.com admin`.",
  );
  process.exit(1);
}
const PORT = process.env.PORT || "8787";
const run = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run("npx", ["vite", "build"], { MESAC_DEV_ADMIN_BUILD: "1" });
run(process.execPath, ["scripts/local-d1.mjs", "migrate"]);
console.log(`\ndev:admin: open http://localhost:${PORT}/admin (signed in as ${email})\n`);
run("npx", [
  "--yes",
  "wrangler@4.166.0",
  "dev",
  "--config",
  ".wrangler/local/wrangler.json",
  "--persist-to",
  ".wrangler/state",
  "--port",
  PORT,
  "--var",
  `ADMIN_DEV_EMAIL:${email}`,
  // Optional, when set in the environment: the public alumni form (Cloudflare's Turnstile TEST keys), the
  // papers refresh button, and a shorter safety margin for the unused-photo cleanup (dev builds only).
  ...[
    "TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
    "SUBMISSION_SALT",
    "GITHUB_REPO",
    "GITHUB_WORKFLOW_FILE",
    "GITHUB_DISPATCH_TOKEN",
    "MEDIA_CLEANUP_MIN_AGE_HOURS",
  ]
    .filter((k) => process.env[k])
    .flatMap((k) => ["--var", `${k}:${process.env[k]}`]),
]);
