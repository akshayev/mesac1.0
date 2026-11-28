/**
 * Local development only: lets `npm run dev:admin` sign in without Cloudflare Access.
 *
 * This module is reachable only through `__MESAC_DEV_ADMIN__ ? ... : null` in auth.ts. That flag is the
 * literal `false` in every normal build (scripts/lib/build-flags.mjs), so the bundler drops this file from
 * production output entirely; `npm run check:deploy` and a test both confirm the variable name below does
 * not appear in .output. Even in a development build it works only for requests to localhost, and the email
 * must still be an active row in the admins table.
 */
import { strictEmail } from "../../scripts/lib/validate.mjs";
import type { AdminEnv } from "./env.ts";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function devBypassEmail(request: Request, env: AdminEnv): string | null {
  if (!LOCAL_HOSTS.has(new URL(request.url).hostname)) return null;
  return strictEmail(env.ADMIN_DEV_EMAIL) || null;
}
