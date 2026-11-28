/**
 * Requests the Worker answers before the React app: the admin API, uploaded photos and the public alumni
 * form's endpoint.
 * Returns null for everything else (the app renders it).
 */
import { handleAdminApi } from "./admin-api.ts";
import type { VerifyDeps } from "./auth.ts";
import { hasDatabase, type AdminEnv } from "./env.ts";
import { notFound } from "./http.ts";
import { serveMedia } from "./media.ts";
import { handlePublicSubmission, type SubmitDeps } from "./submissions.ts";

export async function handleServerRoute(
  request: Request,
  env: AdminEnv,
  deps: VerifyDeps & SubmitDeps = {},
): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (pathname === "/admin/api" || pathname.startsWith("/admin/api/")) {
    // Without the database the dashboard does not exist: the same 404 as any unknown address.
    if (!hasDatabase(env)) return notFound();
    return handleAdminApi(request, env, deps);
  }
  if (pathname.startsWith("/media/")) return serveMedia(request, env);
  // The public alumni form's endpoint (404 unless the feature is switched on).
  if (pathname === "/api/alumni-submission") return handlePublicSubmission(request, env, deps);
  return null;
}
