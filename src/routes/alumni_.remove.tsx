import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { useSettings } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/alumni_/remove")({
  head: () =>
    pageHead({
      title: "Remove or correct your Alumni Connect entry — MESAC CUSAT",
      description: "How to have your details removed from, or corrected on, MESAC Alumni Connect.",
      path: "/alumni/remove",
    }),
  component: RemovePage,
});

function RemovePage() {
  const { contactEmail } = useSettings();
  const href = `mailto:${contactEmail}?subject=${encodeURIComponent(
    "Alumni Connect: please remove or correct my entry",
  )}&body=${encodeURIComponent(
    "Name as shown on Alumni Connect:\nBatch:\n\nPlease remove my entry / please correct the following:\n",
  )}`;
  return (
    <Layout>
      <PageHero
        variant="team"
        eyebrow="Alumni Connect"
        title={
          <>
            REMOVE OR <span className="italic text-gold">CORRECT</span>
          </>
        }
        subtitle="You can ask for your details to be removed or corrected at any time."
      />
      <section className="bg-background py-10 sm:py-14">
        <div className="mx-auto max-w-2xl space-y-4 px-4 text-sm leading-relaxed text-muted-foreground sm:px-6">
          <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <p>
              Send an email from any address to the MESAC committee with the name and batch shown on
              Alumni Connect, and say whether you want the entry removed or what should be changed.
              We hide or delete the entry within 48 hours and reply to confirm.
            </p>
            <p>There is no form here and this page collects nothing.</p>
            <a
              href={href}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl gradient-gold px-4 font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Mail aria-hidden="true" className="h-4 w-4" />
              Email {contactEmail}
            </a>
          </div>
          <p>
            <Link
              to="/alumni"
              className="inline-flex min-h-[24px] items-center text-gold underline"
            >
              Back to Alumni Connect
            </Link>{" "}
            ·{" "}
            <Link
              to="/privacy"
              className="inline-flex min-h-[24px] items-center text-gold underline"
            >
              Privacy
            </Link>
          </p>
        </div>
      </section>
    </Layout>
  );
}
