import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { EmptyState } from "@/components/EmptyState";
import { StickyFilterBar } from "@/components/StickyFilterBar";
import { PersonAvatar } from "@/components/PersonAvatar";
import { getTeamGroups } from "@/data/site";
import type { TeamPerson } from "@/types";
import { Users, Info, Mail, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Executive Committee & Team — MESAC CUSAT" },
      {
        name: "description",
        content:
          "Meet the MESAC committee — the student leaders and faculty advisors running the Mechanical Engineering Students Association at CUSAT.",
      },
      { property: "og:title", content: "Team — MESAC CUSAT" },
      { property: "og:description", content: "The MESAC committee at CUSAT." },
    ],
  }),
  component: TeamPage,
});

function MemberPhotoCard({
  member,
  highlight = false,
}: {
  member: TeamPerson;
  highlight?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl bg-card border border-border card-lift flex flex-col h-full transition-all duration-300 hover:border-gold/40 hover:shadow-xl hover:shadow-black/40">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-950 to-black flex flex-col justify-end p-4">
        <PersonAvatar
          name={member.name}
          photo={member.photo}
          className="absolute inset-0 h-full w-full"
        />

        {/* Ambient Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none" />

        <div className="relative z-10 text-white">
          {member.role && (
            <span
              className={`inline-block mb-1.5 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md border backdrop-blur-sm ${
                highlight
                  ? "bg-gold/20 text-gold border-gold/40 shadow-sm shadow-gold/20"
                  : "bg-black/75 text-gold border-gold/20"
              }`}
            >
              {member.role}
            </span>
          )}
          <div className="font-display text-lg sm:text-xl font-bold tracking-tight text-white drop-shadow break-words">
            {member.name}
          </div>
          {(member.linkedin || member.email) && (
            <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-300">
              {member.linkedin && (
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${member.name} on LinkedIn`}
                  className="inline-flex items-center gap-1 hover:text-gold"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>LinkedIn</span>
                </a>
              )}
              {member.email && (
                <a
                  href={`mailto:${member.email}`}
                  aria-label={`Email ${member.name}`}
                  className="inline-flex items-center gap-1 hover:text-gold"
                >
                  <Mail className="h-3 w-3" />
                  <span>Email</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TeamPage() {
  const groups = getTeamGroups();

  return (
    <Layout>
      <PageHero
        variant="team"
        eyebrow="Leadership & Administration"
        title={
          <>
            THE <span className="italic text-gold">TEAM</span>
          </>
        }
        subtitle="School of Engineering, Cochin University of Science and Technology (CUSAT)"
      />

      {/* SUB-NAVIGATION TABS */}
      <StickyFilterBar className="bg-black/95 border-b border-white/10 py-4 px-4 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-md flex items-center justify-center gap-3">
          <Link
            to="/about-mesac"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-white/70 bg-white/5 border border-white/10 hover:text-white hover:bg-white/10 transition"
          >
            <Info className="h-3.5 w-3.5" />
            <span>About Association</span>
          </Link>
          <Link
            to="/about-mesac/team"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-neutral-950 bg-amber-400 hover:bg-amber-300 shadow-lg shadow-amber-500/25 transition"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Executive Committee</span>
          </Link>
        </div>
      </StickyFilterBar>

      {/* OBJECTIVE TEXT */}
      <section className="sticky-content-container bg-black py-12 px-6 border-b border-white/10 text-white text-center">
        <div className="mx-auto max-w-4xl space-y-4">
          <p className="text-sm sm:text-base md:text-lg leading-relaxed text-neutral-300 font-normal">
            The objective of MESAC is to provide a platform for the students of Mechanical
            Engineering Department by organizing various Technical Seminars, Workshops, Events and
            Competitions. This helps the students to explore and hone their technical and creative
            skills through such co-curricular and extracurricular activities.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6 space-y-16">
          {groups.length === 0 ? (
            <EmptyState
              title="Team details coming soon"
              description="The committee list is being updated. Please check back shortly."
            />
          ) : (
            groups.map((group, gi) => (
              <div key={group.name}>
                <Reveal>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold mb-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                    <span>
                      {group.people.length === 1 ? "1 member" : `${group.people.length} members`}
                    </span>
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl md:text-4xl text-white mb-6">
                    {group.name}
                  </h2>
                </Reveal>

                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {group.people.map((m, i) => (
                    <Reveal key={`${m.name}-${i}`} delay={i * 30}>
                      <MemberPhotoCard member={m} highlight={gi === 0} />
                    </Reveal>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </Layout>
  );
}
