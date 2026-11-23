import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { getSettings } from "@/data/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — MESAC CUSAT" },
      {
        name: "description",
        content:
          "What the MESAC website does and does not collect: no accounts, no forms, no stored personal data.",
      },
      { property: "og:title", content: "Privacy — MESAC CUSAT" },
      {
        property: "og:description",
        content: "No accounts, no forms and no stored personal data on the MESAC website.",
      },
    ],
  }),
  component: PrivacyPage,
});

export function PrivacyPage() {
  const { contactEmail } = getSettings();
  const items: Array<{ title: string; body: string }> = [
    {
      title: "What we collect",
      body: "Nothing. The site has no accounts, no sign-up and no forms, and we store no personal data. There are no analytics or advertising scripts.",
    },
    {
      title: "Question papers",
      body: "Papers are viewed through an embedded Google Drive viewer and downloaded from Google Drive. Google handles those requests under its own privacy policy.",
    },
    {
      title: "Hosting",
      body: "The site is served by Cloudflare, which keeps standard server logs such as IP address, requested page and time.",
    },
    {
      title: "Fonts and map",
      body: "Fonts load from Google Fonts and the contact page embeds a Google Map, so Google sees your IP address and browser details.",
    },
    {
      title: "On your device",
      body: "Your browser may keep a display preference (theme). The GPA calculator runs entirely in your browser; nothing you enter is sent or saved.",
    },
    {
      title: "Contact",
      body: "Contact is by email only. We use your address solely to reply.",
    },
  ];

  return (
    <Layout>
      <PageHero
        variant="academic"
        eyebrow="Website Information"
        title={
          <>
            <span className="italic text-gold">Privacy</span>
          </>
        }
        subtitle="What this website does, and does not, collect."
      />

      <section className="py-16 sm:py-24 bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-6">
          {items.map((item, i) => (
            <Reveal key={item.title} delay={i * 40}>
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="font-display text-lg font-bold text-foreground">{item.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            </Reveal>
          ))}
          <p className="text-center text-sm text-muted-foreground">
            Questions? Email{" "}
            <a href={`mailto:${contactEmail}`} className="text-gold underline">
              {contactEmail}
            </a>
            .
          </p>
        </div>
      </section>
    </Layout>
  );
}
