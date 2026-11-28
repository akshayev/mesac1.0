import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { useSettings } from "@/data/site";
import { pageHead } from "@/lib/seo";
import { CONSENT_TEXT } from "@/shared/consent";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      title: "Privacy — MESAC CUSAT",
      description:
        "What the MESAC website collects and publishes: nothing from ordinary visitors, and alumni details only with consent.",
      path: "/privacy",
    }),
  component: PrivacyPage,
});

export function PrivacyPage() {
  const { contactEmail } = useSettings();
  const items: Array<{ title: string; body: string }> = [
    {
      title: "What we collect",
      body: "Nothing from ordinary visitors: no accounts, no analytics or advertising scripts. The only form is the optional Alumni Connect form.",
    },
    {
      title: "Alumni details",
      body: `Alumni appear only with their written consent, given to the committee or on the Alumni Connect form (when open), where they tick: “${CONSENT_TEXT}” We record which wording and when. A form entry stays private until a committee member approves it; rejected entries are erased at once, unreviewed ones after 30 days. Against spam the form uses Cloudflare Turnstile and keeps a salted hash of your IP address until review.`,
    },
    {
      title: "Removal",
      body: `To be removed or corrected, see /alumni/remove or email ${contactEmail}. We act within 48 hours.`,
    },
    {
      title: "Committee sign-in",
      body: "Committee members sign in through Cloudflare Access with an emailed code. We log which account changed what, never the values.",
    },
    {
      title: "Hosting and Google",
      body: "Cloudflare serves the site and keeps standard logs (IP address, page, time). Papers open in Google Drive's viewer, and the contact page embeds a Google Map; Google's privacy policy applies to those.",
    },
    {
      title: "On your device",
      body: "Your browser may keep a theme preference. The GPA calculator runs only in your browser.",
    },
    {
      title: "Contact",
      body: 'The archive\'s "Report a problem" link opens a Google Form or an email; we use what you send only to fix the problem or reply.',
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
