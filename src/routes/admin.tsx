import { createFileRoute, notFound } from "@tanstack/react-router";
import { fetchAdminEnabled } from "@/data/content";
import { AdminApp } from "@/components/admin/AdminApp";

// The dashboard exists only when the D1 database is bound. Otherwise /admin is the normal 404 page.
// Sign-in itself is enforced by Cloudflare Access in front of /admin* and checked again by /admin/api.
export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { enabled } = await fetchAdminEnabled();
    if (!enabled) throw notFound();
  },
  head: () => ({
    meta: [{ title: "Admin — MESAC CUSAT" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminApp,
});
