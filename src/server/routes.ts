/**
 * Requests the Worker answers before the React app: the admin API and uploaded photos.
 * Returns null for everything else (the app renders it).
 */
import { handleAdminApi } from "./admin-api.ts";
import type { VerifyDeps } from "./auth.ts";
import { hasDatabase, type AdminEnv } from "./env.ts";
import { notFound } from "./http.ts";
import { serveMedia } from "./media.ts";

export async function handleServerRoute(
  request: Request,
  env: AdminEnv,
  deps: VerifyDeps = {},
): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (pathname === "/admin/api" || pathname.startsWith("/admin/api/")) {
    // Without the database the dashboard does not exist: the same 404 as any unknown address.
    if (!hasDatabase(env)) return notFound();
    return handleAdminApi(request, env, deps);
  }
  if (pathname.startsWith("/media/")) return serveMedia(request, env);
  return null;
}
