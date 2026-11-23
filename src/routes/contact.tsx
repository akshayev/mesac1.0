import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHero } from "@/components/PageHero";
import { Layout } from "@/components/Layout";
import { Reveal } from "@/components/Reveal";
import { InstagramIcon } from "@/components/InstagramIcon";
import { getSettings } from "@/data/site";
import {
  Mail,
  Phone,
  Copy,
  Check,
  ExternalLink,
  MapPin,
  Building2,
  Navigation,
  Linkedin,
  MessageSquare,
} from "lucide-react";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  head: () =>
    pageHead({
      title: "Contact Us & Location — MESAC CUSAT",
      description:
        "Contact MESAC — Division of Mechanical Engineering, School of Engineering, Cochin University of Science and Technology (CUSAT), Kochi, Kerala.",
      path: "/contact",
    }),
  component: ContactPage,
});

const linkCard =
  "inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-xs font-bold text-foreground hover:border-gold hover:text-gold shadow-sm transition min-h-[44px]";

function ContactPage() {
  const settings = getSettings();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const email = settings.contactEmail;
  const phoneHref = settings.contactPhone?.replace(/[^\d+]/g, "");

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      toast.success("Email address copied to clipboard");
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch {
      toast.error("Couldn't copy the address");
    }
  };

  return (
    <Layout>
      <PageHero
        variant="contact"
        eyebrow="Reach Out To Us"
        title={
          <>
            Contact <span className="italic text-gold">MESAC CUSAT.</span>
          </>
        }
        subtitle="Connect with the Mechanical Engineering Students Association at School of Engineering, CUSAT."
      />

      <section className="py-16 bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-16">
          <div
            className={`grid gap-6 ${
              settings.contactPhone || settings.reportFormUrl ? "md:grid-cols-2" : ""
            }`}
          >
            {/* EMAIL */}
            <Reveal delay={40}>
              <div className="h-full rounded-3xl border border-border bg-card p-6 sm:p-8 card-lift flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-gold/10 text-gold grid place-items-center font-bold">
                      <Mail className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground font-bold">
                        Email
                      </div>
                      <a
                        href={`mailto:${email}`}
                        className="font-display text-base font-extrabold text-foreground hover:text-gold transition break-all"
                      >
                        {email}
                      </a>
                    </div>
                  </div>
                  <p className="pt-3 border-t border-border/60 text-xs text-muted-foreground leading-relaxed">
                    Questions, collaborations, or a mistake in the question paper archive? Email us
                    and we will get back to you.
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-2">
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl gradient-gold py-2.5 px-4 text-xs font-bold text-primary shadow-sm hover:brightness-105 active:scale-95 transition min-h-[44px]"
                  >
                    <span>Send Mail</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="inline-flex items-center justify-center rounded-xl border border-border bg-secondary/60 hover:bg-secondary p-2.5 text-xs font-semibold text-foreground transition cursor-pointer min-h-[44px] min-w-[44px]"
                    title="Copy email address"
                    aria-label="Copy email address"
                  >
                    {copiedEmail ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </Reveal>

            {/* PHONE: only when the settings tab has contact_phone */}
            {settings.contactPhone && (
              <Reveal delay={80}>
                <div className="h-full rounded-3xl border border-border bg-card p-6 sm:p-8 card-lift flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-12 w-12 rounded-2xl bg-gold/10 text-gold grid place-items-center font-bold">
                        <Phone className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground font-bold">
                          Phone
                        </div>
                        <div className="font-display text-base font-extrabold text-foreground break-words">
                          {settings.contactPhone}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <a
                      href={`tel:${phoneHref}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary/80 hover:bg-secondary py-2.5 px-4 text-xs font-bold text-foreground transition min-h-[44px]"
                    >
                      <Phone className="h-3.5 w-3.5 text-gold" />
                      <span>Call</span>
                    </a>
                  </div>
                </div>
              </Reveal>
            )}

            {/* FORM LINK: only when the settings tab has report_form_url */}
            {settings.reportFormUrl && (
              <Reveal delay={120}>
                <div className="h-full rounded-3xl border border-border bg-card p-6 sm:p-8 card-lift flex flex-col justify-between">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-gold/10 text-gold grid place-items-center font-bold">
                      <MessageSquare className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground font-bold">
                        Feedback form
                      </div>
                      <div className="font-display text-base font-extrabold text-foreground">
                        Report or suggest
                      </div>
                    </div>
                  </div>
                  <a
                    href={settings.reportFormUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary/80 hover:bg-secondary py-2.5 px-4 text-xs font-bold text-foreground transition min-h-[44px]"
                  >
                    <span>Open the form</span>
                    <ExternalLink className="h-3.5 w-3.5 text-gold" />
                  </a>
                </div>
              </Reveal>
            )}
          </div>

          {/* LINKS */}
          <Reveal delay={140}>
            <div className="rounded-3xl border border-border bg-secondary/30 p-8 text-center space-y-4">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground font-bold">
                Find us online
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {settings.instagramUrl && (
                  <a
                    href={settings.instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={linkCard}
                  >
                    <InstagramIcon className="h-4 w-4 text-pink-500" />
                    <span>Instagram</span>
                    <ExternalLink className="h-3.5 w-3.5 text-gold" />
                  </a>
                )}
                {settings.linkedinUrl && (
                  <a
                    href={settings.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={linkCard}
                  >
                    <Linkedin className="h-4 w-4 text-blue-500" />
                    <span>LinkedIn</span>
                    <ExternalLink className="h-3.5 w-3.5 text-gold" />
                  </a>
                )}
                <a
                  href="https://soe.cusat.ac.in"
                  target="_blank"
                  rel="noreferrer"
                  className={linkCard}
                >
                  <span>School of Engineering, CUSAT</span>
                  <ExternalLink className="h-3.5 w-3.5 text-gold" />
                </a>
                <a
                  href="https://admissions.cusat.ac.in/"
                  target="_blank"
                  rel="noreferrer"
                  className={linkCard}
                >
                  <span>CUSAT Admissions</span>
                  <ExternalLink className="h-3.5 w-3.5 text-gold" />
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* LOCATION & CAMPUS MAP SECTION */}
      <section className="py-16 bg-secondary/20 border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-12 items-center">
            <div className="lg:col-span-5 space-y-6">
              <Reveal>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1 text-xs font-extrabold text-gold uppercase tracking-wider mb-3">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Campus Location</span>
                  </div>
                  <h2 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
                    Visit Us At CUSAT Campus
                  </h2>
                  <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Cochin University of Science and Technology, Kalamassery, Kochi.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 mt-6">
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-foreground">Postal Address</div>
                      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Division of Mechanical Engineering,
                        <br />
                        School of Engineering, CUSAT,
                        <br />
                        Kalamassery, Cochin — 682022, Kerala, India
                      </div>
                    </div>
                  </div>
                </div>

                <a
                  href="https://maps.google.com/?q=School+of+Engineering+CUSAT+Kalamassery"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2.5 rounded-full gradient-gold px-6 py-3 text-xs font-bold text-primary shadow-lg hover:brightness-105 transition min-h-[44px]"
                >
                  <Navigation className="h-4 w-4" />
                  <span>Get Directions On Google Maps</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Reveal>
            </div>

            <div className="lg:col-span-7">
              <Reveal delay={80}>
                <div className="overflow-hidden rounded-3xl border-2 border-border bg-card shadow-2xl h-[380px] sm:h-[420px] relative">
                  <iframe
                    title="CUSAT School of Engineering Map Location"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3928.9888200259837!2d76.3262693758364!3d10.038379272718131!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3b080c36395b2909%3A0xe107d6124504c553!2sSchool%20of%20Engineering%2C%20CUSAT!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                    className="w-full h-full border-0 grayscale opacity-90 contrast-125 hover:grayscale-0 hover:opacity-100 transition-all duration-500"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
