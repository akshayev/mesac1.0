import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { departmentOverview, departmentPrograms, departmentLabs } from "@/data/department";
import {
  Building2,
  GraduationCap,
  FlaskConical,
  Flame,
  Compass,
  Cpu,
  Microscope,
  Wrench,
  ShieldCheck,
  Target,
  Sparkles,
  BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/mechanical-dept")({
  head: () => ({
    meta: [
      { title: "Division of Mechanical Engineering — School of Engineering, CUSAT" },
      {
        name: "description",
        content:
          "The Division of Mechanical Engineering, School of Engineering, CUSAT: academic programs and research laboratories.",
      },
      { property: "og:title", content: "Mechanical Engineering Division — CUSAT" },
      {
        property: "og:description",
        content: "Programs and laboratories of CUSAT Mechanical Engineering.",
      },
    ],
  }),
  component: DeptPage,
});

const labIcons = [Flame, Compass, Cpu, Microscope, Wrench, ShieldCheck];

function DeptPage() {
  return (
    <Layout>
      {/* 1. HERO BANNER */}
      <PageHero
        variant="academic"
        eyebrow="School of Engineering · CUSAT"
        title={
          <>
            DIVISION OF <span className="italic text-gold">MECHANICAL ENGINEERING</span>
          </>
        }
        subtitle="Established in 1995, the mechanical engineering division at Cochin University of Science and Technology, offering undergraduate, postgraduate, and doctoral research programs."
      />

      {/* 2. DEPARTMENT OVERVIEW & MISSION/VISION */}
      <section className="py-14 sm:py-20 bg-background border-b border-border/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Overview Summary */}
            <div className="lg:col-span-7 space-y-6">
              <Reveal>
                <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-secondary/60 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <Building2 className="h-3.5 w-3.5 text-gold" />
                  <span>Division Overview</span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  About the Division
                </h2>
                <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {departmentOverview.summary}
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <div className="rounded-xl border border-border/80 bg-card px-4 py-2.5 text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">Established:</span>{" "}
                    {departmentOverview.establishedYear}
                  </div>
                  <div className="rounded-xl border border-border/80 bg-card px-4 py-2.5 text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">Institution:</span>{" "}
                    {departmentOverview.school}, CUSAT
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Mission & Vision Cards */}
            <div className="lg:col-span-5 space-y-5">
              <Reveal delay={60}>
                <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-gold shrink-0" />
                    <h3 className="font-display text-base font-extrabold text-foreground uppercase tracking-wide">
                      Our Vision
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {departmentOverview.vision}
                  </p>
                </div>
              </Reveal>

              <Reveal delay={120}>
                <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-gold shrink-0" />
                    <h3 className="font-display text-base font-extrabold text-foreground uppercase tracking-wide">
                      Division Mission
                    </h3>
                  </div>
                  <ul className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
                    {departmentOverview.mission.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-gold shrink-0 mt-1.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* 4. ACADEMIC PROGRAMS */}
      <section className="py-14 sm:py-20 bg-background border-b border-border/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-secondary/60 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <GraduationCap className="h-3.5 w-3.5 text-gold" />
                  <span>Curriculum</span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Academic Degree Programs
                </h2>
              </div>
              <Link
                to="/archive"
                className="text-xs font-bold text-gold hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>Browse Academic Archive</span>
                <span>→</span>
              </Link>
            </div>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-2">
            {departmentPrograms.map((p, i) => (
              <Reveal key={p.id} delay={i * 50}>
                <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 card-lift h-full flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                      <span className="text-muted-foreground">{p.duration}</span>
                      {p.intake && (
                        <span className="rounded-full bg-secondary text-gold px-3 py-1 font-bold">
                          {p.intake}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-4 font-display text-xl sm:text-2xl font-bold text-foreground">
                      {p.name}
                    </h3>
                    <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {p.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-gold" />
                      <span>{p.degree} Curriculum</span>
                    </span>
                    <Link to="/archive" className="text-gold font-medium hover:underline">
                      View Syllabus Papers →
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 5. RESEARCH & INSTRUCTIONAL LABORATORIES */}
      <section className="py-14 sm:py-20 bg-secondary/15 border-b border-border/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <div className="mb-10 text-center max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-secondary/60 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                <FlaskConical className="h-3.5 w-3.5 text-gold" />
                <span>Facilities</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                Laboratories & Testing Centers
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
                Specialized instructional and research laboratories in the Division of Mechanical
                Engineering.
              </p>
            </div>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {departmentLabs.map((lab, idx) => {
              const IconComp = labIcons[idx % labIcons.length] || Wrench;
              return (
                <Reveal key={lab.id} delay={(idx % 6) * 40}>
                  <div className="group rounded-2xl border border-border/80 bg-card p-6 card-lift h-full flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="h-10 w-10 rounded-xl bg-secondary border border-border/80 flex items-center justify-center text-gold mb-4 group-hover:scale-105 transition-transform">
                        <IconComp className="h-5 w-5" />
                      </div>

                      <h3 className="font-display text-lg sm:text-xl font-bold text-foreground group-hover:text-gold transition-colors">
                        {lab.name}
                      </h3>
                      {lab.description && (
                        <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">
                          {lab.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 pt-3 border-t border-border/60">
                      <span className="text-[11px] text-muted-foreground">
                        Division of Mechanical Engineering, CUSAT
                      </span>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
    </Layout>
  );
}
