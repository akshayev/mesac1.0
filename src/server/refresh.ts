/**
 * "Refresh papers now": starts the deploy workflow on GitHub (workflow_dispatch), which re-reads Google Drive
 * and rebuilds the site.
 *
 * On only when the Worker has GITHUB_DISPATCH_TOKEN (a fine-grained token for ONE repository with "Actions:
 * read and write"), GITHUB_REPO and GITHUB_WORKFLOW_FILE. The token is sent only to api.github.com and is
 * never returned, logged or written to the activity log. At most one start every 5 minutes.
 */
import { githubRepo, workflowFile } from "../../scripts/lib/features.mjs";
import type { AdminEnv, D1Database } from "./env.ts";
import { REFRESH_SQL } from "./sql.ts";

export const REFRESH_KEY = "internal:last_papers_refresh";
export const REFRESH_GAP_MS = 5 * 60_000;

const setting = (env: AdminEnv, key: string) => String(env[key] ?? "").trim();

export interface RefreshConfig {
  enabled: boolean;
  /** The workflow's page on GitHub ("Run workflow" link) when the repository is known. */
  actionsUrl: string | null;
}

export function refreshConfig(env: AdminEnv): RefreshConfig {
  const repo = githubRepo(setting(env, "GITHUB_REPO"));
  const file = workflowFile(setting(env, "GITHUB_WORKFLOW_FILE"));
  return {
    enabled: Boolean(repo && file && setting(env, "GITHUB_DISPATCH_TOKEN")),
    actionsUrl: repo
      ? `https://github.com/${repo}/actions${file ? `/workflows/${file}` : ""}`
      : null,
  };
}

export interface RefreshDeps {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  nowMs?: () => number;
}

export type RefreshResult = { ok: true } | { ok: false; status: number; error: string };

/** Asks GitHub to run the workflow on main. Friendly messages; nothing about the token in them. */
export async function dispatchWorkflow(
  env: AdminEnv,
  deps: RefreshDeps = {},
): Promise<RefreshResult> {
  const repo = githubRepo(setting(env, "GITHUB_REPO"));
  const file = workflowFile(setting(env, "GITHUB_WORKFLOW_FILE"));
  const token = setting(env, "GITHUB_DISPATCH_TOKEN");
  let res: Response;
  try {
    res = await (deps.fetchFn ?? fetch)(
      `https://api.github.com/repos/${repo}/actions/workflows/${file}/dispatches`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "user-agent": "mesac-admin-dashboard",
          "content-type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
        signal: AbortSignal.timeout(deps.timeoutMs ?? 10_000),
      },
    );
  } catch {
    return {
      ok: false,
      status: 504,
      error: "GitHub did not answer in time. Please try again later.",
    };
  }
  if (res.status === 204 || res.status === 200) return { ok: true };
  const limited =
    res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0");
  const error = limited
    ? "GitHub is busy right now (rate limit). Please try again later."
    : res.status === 401
      ? "GitHub did not accept the saved token (it may have expired). Ask the site owner to renew PAPERS_REFRESH_TOKEN."
      : res.status === 403
        ? "The saved token may not start workflows. It needs “Actions: read and write” on this repository."
        : res.status === 404
          ? "GitHub could not find the repository or workflow, or the token cannot see it."
          : res.status === 422
            ? "GitHub refused to start the workflow. Check that it is enabled and can run on main."
            : "GitHub answered with an error. Please try again later.";
  return { ok: false, status: 502, error };
}

/** Claims the 5-minute slot, starts the workflow, and gives the slot back if GitHub refused. */
export async function refreshPapers(
  env: AdminEnv & { DB: D1Database },
  actor: string,
  deps: RefreshDeps = {},
): Promise<RefreshResult> {
  const now = deps.nowMs?.() ?? Date.now();
  const at = new Date(now).toISOString();
  const threshold = new Date(now - REFRESH_GAP_MS).toISOString();
  const previous = await env.DB.prepare(REFRESH_SQL.get)
    .bind(REFRESH_KEY)
    .first<{ value: string }>();
  const claim = await env.DB.prepare(REFRESH_SQL.claim)
    .bind(REFRESH_KEY, at, at, actor, threshold)
    .run();
  if (!claim.meta.changes)
    return {
      ok: false,
      status: 429,
      error:
        "The papers were refreshed a moment ago. Please wait a few minutes before trying again.",
    };
  const result = await dispatchWorkflow(env, deps);
  if (!result.ok) {
    // Nothing started, so do not make people wait 5 minutes for a retry.
    if (previous)
      await env.DB.prepare(REFRESH_SQL.restore).bind(previous.value, REFRESH_KEY, at).run();
    else await env.DB.prepare(REFRESH_SQL.release).bind(REFRESH_KEY, at).run();
  }
  return result;
}
