// Builds the final Wrangler (Cloudflare Worker) config from the one nitro generates, plus env.
// Pure functions; the CLI is scripts/render-wrangler.mjs. Tested in scripts/tests/render-wrangler.test.mjs.

import { accessAud, normalizeTeamDomain } from "./validate.mjs";
import { githubRepo, turnstileSiteKey, workflowFile } from "./features.mjs";

export const DB_NAME = "mesac-admin";
/** The only id ever written to the local (development) config. check:deploy refuses it in .output. */
export const LOCAL_DB_ID = "local-dev-only-not-for-deploy";
export const LOCAL_BUCKET = "mesac-media-local";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BUCKET = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

/** A real D1 database id (a UUID, not all zeros), lowercased, or "". */
export function d1Id(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return UUID.test(s) && /[1-9a-f]/.test(s.replace(/-/g, "")) ? s : "";
}

export function bucketName(raw) {
  const s = String(raw ?? "").trim();
  return BUCKET.test(s) && !s.includes("--") ? s : "";
}

/**
 * Adds the admin bindings to `base` (nitro's generated wrangler.json) when env.D1_DATABASE_ID is set.
 * Returns { config, changed, errors, warnings }. `errors` must stop a deploy; without D1_DATABASE_ID the
 * config is returned untouched (Sheet mode).
 */
export function renderDeployConfig(base, env, { migrationsDir }) {
  const errors = [];
  const warnings = [];
  const raw = (k) => String(env[k] ?? "").trim();
  if (!raw("D1_DATABASE_ID")) {
    for (const k of [
      "R2_BUCKET_NAME",
      "CF_ACCESS_TEAM_DOMAIN",
      "CF_ACCESS_AUD",
      "TURNSTILE_SITE_KEY",
    ])
      if (raw(k)) warnings.push(`${k} is ignored because D1_DATABASE_ID is not set (Sheet mode).`);
    return { config: base, changed: false, errors, warnings };
  }
  const id = d1Id(raw("D1_DATABASE_ID"));
  if (!id)
    errors.push(
      "D1_DATABASE_ID is not a D1 database id (it looks like 8-4-4-4-12 hex characters).",
    );
  const bucket = raw("R2_BUCKET_NAME") ? bucketName(raw("R2_BUCKET_NAME")) : "";
  if (raw("R2_BUCKET_NAME") && !bucket) errors.push("R2_BUCKET_NAME is not a valid bucket name.");
  if (!raw("R2_BUCKET_NAME")) warnings.push("R2_BUCKET_NAME is not set: photo upload stays off.");
  const team = normalizeTeamDomain(raw("CF_ACCESS_TEAM_DOMAIN"));
  const aud = accessAud(raw("CF_ACCESS_AUD"));
  const accessProblem = !team || !aud;
  if (accessProblem)
    warnings.push(
      "CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD are missing or invalid: nobody can sign in to /admin.",
    );
  const siteKey = turnstileSiteKey(raw("TURNSTILE_SITE_KEY"));
  if (raw("TURNSTILE_SITE_KEY") && !siteKey)
    errors.push("TURNSTILE_SITE_KEY is not a Turnstile site key.");
  if (errors.length) return { config: base, changed: false, errors, warnings, accessProblem };

  const config = { ...base };
  config.d1_databases = [
    { binding: "DB", database_name: DB_NAME, database_id: id, migrations_dir: migrationsDir },
  ];
  if (bucket) config.r2_buckets = [{ binding: "MEDIA", bucket_name: bucket }];
  else delete config.r2_buckets;
  const vars = { ...(base.vars ?? {}) };
  delete vars.CF_ACCESS_TEAM_DOMAIN;
  delete vars.CF_ACCESS_AUD;
  delete vars.TURNSTILE_SITE_KEY;
  if (team && aud) Object.assign(vars, { CF_ACCESS_TEAM_DOMAIN: team, CF_ACCESS_AUD: aud });
  // Public by design (the browser needs it). The two alumni-form secrets are Worker secrets, never here.
  if (siteKey) vars.TURNSTILE_SITE_KEY = siteKey;
  // Papers refresh button: which repository and workflow to start (not secret; the token is a Worker secret).
  // GitHub does not allow secrets or variables named GITHUB_*, so the workflow passes them as REFRESH_*.
  delete vars.GITHUB_REPO;
  delete vars.GITHUB_WORKFLOW_FILE;
  const repo = githubRepo(raw("REFRESH_REPO"));
  const file = workflowFile(raw("REFRESH_WORKFLOW_FILE"));
  if (repo && file) Object.assign(vars, { GITHUB_REPO: repo, GITHUB_WORKFLOW_FILE: file });
  if (Object.keys(vars).length) config.vars = vars;
  else delete config.vars;
  return { config, changed: true, errors, warnings, accessProblem };
}

/**
 * The local development config (.wrangler/local/wrangler.json): a dev build when present, local-only D1
 * and R2 names, no Access settings (dev:admin signs in with the localhost-only shortcut).
 */
export function renderLocalConfig(devBase, { main, assetsDir, migrationsDir }) {
  const config = { ...(devBase ?? {}) };
  config.name ??= "mesac-cusat";
  config.compatibility_date ??= "2026-11-01";
  config.compatibility_flags ??= ["nodejs_compat"];
  if (devBase && main) config.main = main;
  if (devBase && assetsDir) config.assets = { ...(devBase.assets ?? {}), directory: assetsDir };
  config.d1_databases = [
    {
      binding: "DB",
      database_name: DB_NAME,
      database_id: LOCAL_DB_ID,
      migrations_dir: migrationsDir,
    },
  ];
  config.r2_buckets = [{ binding: "MEDIA", bucket_name: LOCAL_BUCKET }];
  delete config.vars;
  return config;
}

/** JSON with whole-line // comments (wrangler.jsonc). */
export function parseJsonc(text) {
  return JSON.parse(
    String(text)
      .split("\n")
      .filter((l) => !/^\s*\/\//.test(l))
      .join("\n"),
  );
}

/** Just enough config for `wrangler d1 export DB` in the backup workflow (no Worker code, no other bindings). */
export function renderBackupConfig(base, id) {
  if (!d1Id(id)) throw new Error("not a D1 database id");
  return {
    name: base.name,
    compatibility_date: base.compatibility_date,
    d1_databases: [{ binding: "DB", database_name: DB_NAME, database_id: d1Id(id) }],
  };
}
