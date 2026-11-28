/**
 * Server functions the pages call from their loaders. They run on the server (during page rendering, or as
 * a small request when navigating in the browser) and return public data only.
 */
import { createServerFn } from "@tanstack/react-start";
import { isPublicKind, type PublicKind } from "@/shared/public-kinds";

/** Public content: from D1 when the database is bound, otherwise the committed Sheet snapshot. */
export const fetchPublicContent = createServerFn({ method: "GET" })
  .validator((kind: unknown): PublicKind => {
    if (!isPublicKind(kind)) throw new Error("Unknown content");
    return kind;
  })
  .handler(async ({ data }) => {
    const [{ getPublicContent }, { getEnv }] = await Promise.all([
      import("@/server/public-data"),
      import("@/server/env"),
    ]);
    return getPublicContent(data, getEnv());
  });

/** Whether the admin dashboard exists on this deployment (only when the D1 database is bound). */
export const fetchAdminEnabled = createServerFn({ method: "GET" }).handler(async () => {
  const { getEnv, hasDatabase } = await import("@/server/env");
  return { enabled: hasDatabase(getEnv()) };
});

/** Whether the public alumni form is on, and the public Turnstile site key it needs. */
export const fetchSubmissionConfig = createServerFn({ method: "GET" }).handler(async () => {
  const [{ getEnv }, { submissionConfig }] = await Promise.all([
    import("@/server/env"),
    import("@/server/submissions"),
  ]);
  return submissionConfig(getEnv());
});
