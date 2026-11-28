import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { useSettings } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      title: "Privacy — MESAC CUSAT",
      description:
        "What the MESAC website collects and publishes: no accounts or sign-up, and alumni details only with consent.",
      path: "/privacy",
    }),
  component: PrivacyPage,
});

export function PrivacyPage() {
  const { contactEmail } = useSettings();
  const items: Array<{ title: string; body: string }> = [
    {
      title: "What we collect",
      body: "We collect nothing from visitors. The site has no accounts, no sign-up and no forms of its own, and no analytics or advertising scripts. Some pages show details about members and alumni.",
    },
    {
      title: "Alumni details",
      body: `Alumni details are published only with the person's written consent, recorded by the MESAC committee. To ask for removal or a correction, email ${contactEmail}. We hide or delete the entry within 48 hours.`,
    },
    {
      title: "Committee sign-in",
      body: "Only committee members sign in, to edit the site, through Cloudflare Access with an emailed one-time code. We record which account made each change, never the contact details changed.",
    },
    {
      title: "Question papers",
      body: "Papers are viewed through an embedded Google Drive viewer. Downloads come from this site or from Google Drive. Google handles its requests under its own privacy policy.",
    },
    {
      title: "Hosting",
      body: "The site is served by Cloudflare, which keeps standard server logs such as IP address, requested page and time.",
    },
    {
      title: "Map",
      body: "Fonts are served from this site. The contact page embeds a Google Map, so Google sees your IP address and browser details.",
    },
    {
      title: "On your device",
      body: "Your browser may keep a display preference (theme). The GPA calculator runs entirely in your browser; nothing you enter is sent or saved.",
    },
    {
      title: "Contact",
      body: 'Contact is by email. The archive\'s "Report a problem" link opens a Google Form (or an email) that you fill in yourself; Google handles form answers under its own privacy policy. We use what you send solely to fix the problem or reply.',
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
