import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { GpaCalculator } from "@/components/GpaCalculator";

export const Route = createFileRoute("/academy")({
  head: () => ({
    meta: [
      { title: "GPA & CGPA Calculator — CUSAT | MESAC" },
      {
        name: "description",
        content:
          "Free semester GPA and CGPA calculator using CUSAT B.Tech grade points. Runs in your browser; nothing is saved or sent anywhere.",
      },
      { property: "og:title", content: "GPA & CGPA Calculator — MESAC CUSAT" },
      {
        property: "og:description",
        content: "Calculate your semester GPA and cumulative CGPA with CUSAT grade points.",
      },
    ],
  }),
  component: AcademyPage,
});

function AcademyPage() {
  return (
    <Layout>
      <PageHero
        variant="academic"
        eyebrow="Student Tools"
        title={
          <>
            GPA & <span className="italic text-gold">CGPA Calculator</span>
          </>
        }
        subtitle="Work out your semester GPA and cumulative CGPA from CUSAT grade points. Everything runs in your browser; nothing is stored or sent."
      />

      <section id="calculator" className="py-12 sm:py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <GpaCalculator />
        </div>
      </section>
    </Layout>
  );
}
