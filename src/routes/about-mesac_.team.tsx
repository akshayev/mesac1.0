import { createFileRoute } from "@tanstack/react-router";
import { TeamPage } from "./team";
import { pageHead } from "@/lib/seo";
import { loadTeam } from "@/data/site";

export const Route = createFileRoute("/about-mesac_/team")({
  head: () =>
    pageHead({
      title: "Executive Committee & Team — About MESAC CUSAT",
      description:
        "Meet the MESAC committee — the student leaders and faculty advisors running the Mechanical Engineering Students Association at CUSAT.",
      path: "/about-mesac/team",
    }),
  loader: () => loadTeam(),
  component: function AboutTeamRoute() {
    return <TeamPage team={Route.useLoaderData()} />;
  },
});
