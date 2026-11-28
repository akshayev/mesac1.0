import { createFileRoute, notFound } from "@tanstack/react-router";
import { ENTITIES, isEntityName } from "@/shared/entities";
import { SECTIONS, useMe } from "@/components/admin/context";
import { ContentSection } from "@/components/admin/ContentSection";
import { SettingsSection } from "@/components/admin/SettingsSection";
import { AdminsSection } from "@/components/admin/AdminsSection";
import { ActivitySection } from "@/components/admin/ActivitySection";
import { SubmissionsSection } from "@/components/admin/SubmissionsSection";
import { Notice } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/$section")({
  beforeLoad: ({ params }) => {
    if (!SECTIONS.some((s) => s.id === params.section)) throw notFound();
  },
  head: ({ params }) => ({
    meta: [
      { title: `${SECTIONS.find((s) => s.id === params.section)?.label ?? "Admin"} — MESAC Admin` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminSection,
});

function AdminSection() {
  const { section } = Route.useParams();
  const me = useMe();
  if (!me) return null;
  const title = SECTIONS.find((s) => s.id === section)?.label ?? "";
  let body;
  if (isEntityName(section))
    body = <ContentSection key={section} def={ENTITIES[section]} me={me} />;
  else if (section === "settings") body = <SettingsSection />;
  else if (section === "submissions")
    body = me.submissions ? (
      <SubmissionsSection me={me} />
    ) : (
      <Notice>The public alumni form is not switched on for this site.</Notice>
    );
  else if (section === "admins")
    body =
      me.role === "admin" ? (
        <AdminsSection me={me} />
      ) : (
        <Notice tone="error">Only admins can see this.</Notice>
      );
  else body = <ActivitySection />;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
      {body}
    </div>
  );
}
