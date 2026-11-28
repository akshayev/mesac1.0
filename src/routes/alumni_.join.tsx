import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useId, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { Turnstile } from "@/components/alumni/Turnstile";
import { BTN_PRIMARY, CARD, Field, INPUT, Notice } from "@/components/admin/ui";
import { fetchSubmissionConfig } from "@/data/content";
import { pageHead } from "@/lib/seo";
import { CONSENT_TEXT, CONSENT_TEXT_VERSION, HELP_SUGGESTIONS } from "@/shared/consent";

// Exists only when the alumni form is switched on (database + Turnstile + salt); otherwise the normal 404.
export const Route = createFileRoute("/alumni_/join")({
  loader: async () => {
    const config = await fetchSubmissionConfig();
    if (!config.enabled) throw notFound();
    return config;
  },
  head: () =>
    pageHead({
      title: "Join Alumni Connect — MESAC CUSAT",
      description:
        "MESAC alumni: add yourself to Alumni Connect so CUSAT Mechanical Engineering students can reach you for guidance.",
      path: "/alumni/join",
    }),
  component: JoinPage,
});

const FIELDS = [
  { name: "name", label: "Full name", required: true, autoComplete: "name" },
  {
    name: "batch",
    label: "Batch (year you graduated)",
    required: true,
    placeholder: "e.g. 2018",
    inputMode: "numeric",
  },
  { name: "department", label: "Department", placeholder: "e.g. Mechanical Engineering" },
  { name: "currentRole", label: "Current role", autoComplete: "organization-title" },
  { name: "company", label: "Company or institution", autoComplete: "organization" },
  { name: "location", label: "City / country" },
  {
    name: "linkedin",
    label: "LinkedIn profile",
    type: "url",
    placeholder: "https://www.linkedin.com/in/…",
    help: "Optional. linkedin.com links only.",
  },
  {
    name: "email",
    label: "Public email",
    type: "email",
    autoComplete: "email",
    help: "Optional. Shown on the site.",
  },
  {
    name: "phone",
    label: "Public phone",
    type: "tel",
    autoComplete: "tel",
    help: "Optional. Only if you are happy for anyone to call you.",
  },
] as const;

type Values = Record<(typeof FIELDS)[number]["name"], string>;
const EMPTY = Object.fromEntries(FIELDS.map((f) => [f.name, ""])) as Values;

function JoinPage() {
  const { siteKey } = Route.useLoaderData();
  const uid = useId();
  const [values, setValues] = useState<Values>(EMPTY);
  const [help, setHelp] = useState<string[]>([]);
  const [helpOther, setHelpOther] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [token, setToken] = useState("");
  const [resetSignal, setResetSignal] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const id = (n: string) => `${uid}-${n}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage("");
    if (!consent) {
      setErrors({ consent: "Please tick the consent box to continue." });
      return;
    }
    if (!token) {
      setMessage("Please wait for the spam check below to finish, then submit again.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/alumni-submission", {
        method: "POST",
        headers: { "content-type": "application/json", "x-mesac-form": "1" },
        body: JSON.stringify({
          ...values,
          helpWith: [...help, helpOther].filter(Boolean).join("; "),
          consent,
          consentVersion: CONSENT_TEXT_VERSION,
          website,
          token,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        errors?: Record<string, string>;
      };
      if (res.ok && data.ok) {
        setDone(true);
        window.scrollTo({ top: 0 });
        return;
      }
      setErrors(data.errors ?? {});
      setMessage(
        data.error ??
          (data.errors
            ? "Please check the highlighted fields."
            : "Something went wrong. Please try again."),
      );
    } catch {
      setMessage("Could not send. Check your connection and try again.");
    } finally {
      setBusy(false);
      // A spam-check token works only once: get a fresh one for the next attempt.
      setResetSignal((n) => n + 1);
    }
  }

  return (
    <Layout>
      <PageHero
        variant="team"
        eyebrow="Alumni Connect"
        title={
          <>
            JOIN <span className="italic text-gold">ALUMNI CONNECT</span>
          </>
        }
        subtitle="Let current students reach you for guidance, referrals and career advice."
      />
      <section className="bg-background py-10 sm:py-14">
        <div className="mx-auto max-w-2xl space-y-5 px-4 sm:px-6">
          {done ? (
            <div className={`${CARD} space-y-3 text-center`} role="status">
              <CheckCircle2 aria-hidden="true" className="mx-auto h-10 w-10 text-gold" />
              <h2 className="font-display text-xl font-bold text-foreground">Thank you!</h2>
              <p className="text-sm text-muted-foreground">
                Your details were sent to the MESAC committee. They will appear on Alumni Connect
                after a committee member has reviewed them. Nothing is shown before that.
              </p>
              <Link
                to="/alumni"
                className="inline-flex min-h-[44px] items-center font-semibold text-gold underline"
              >
                Back to Alumni Connect
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className={`${CARD} space-y-4`} noValidate>
              <p className="text-sm text-muted-foreground">
                Fields marked <span className="text-gold">*</span> are required. Everything you
                enter here will be <strong className="text-foreground">public</strong> once
                approved, so add contact details only if you want students to use them.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <Field
                    key={f.name}
                    id={id(f.name)}
                    label={f.label}
                    required={"required" in f && f.required}
                    help={"help" in f ? f.help : undefined}
                    error={errors[f.name]}
                  >
                    <input
                      id={id(f.name)}
                      name={f.name}
                      className={INPUT}
                      type={"type" in f ? f.type : "text"}
                      inputMode={"inputMode" in f ? f.inputMode : undefined}
                      autoComplete={"autoComplete" in f ? f.autoComplete : "off"}
                      placeholder={"placeholder" in f ? f.placeholder : undefined}
                      required={"required" in f && f.required}
                      maxLength={f.name === "batch" ? 20 : 200}
                      aria-invalid={Boolean(errors[f.name]) || undefined}
                      aria-describedby={
                        errors[f.name]
                          ? `${id(f.name)}-error`
                          : "help" in f
                            ? `${id(f.name)}-help`
                            : undefined
                      }
                      value={values[f.name]}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    />
                  </Field>
                ))}
              </div>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-foreground">I can help with</legend>
                <div className="flex flex-wrap gap-2">
                  {HELP_SUGGESTIONS.map((h) => (
                    <label
                      key={h}
                      className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-border/80 px-3 text-xs text-foreground has-[:checked]:border-gold has-[:checked]:bg-gold/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--gold)]"
                        checked={help.includes(h)}
                        onChange={(e) =>
                          setHelp((list) =>
                            e.target.checked ? [...list, h] : list.filter((x) => x !== h),
                          )
                        }
                      />
                      {h}
                    </label>
                  ))}
                </div>
                <Field
                  id={id("helpOther")}
                  label="Other topics"
                  help="Separate topics with semicolons."
                  error={errors.helpWith}
                >
                  <input
                    id={id("helpOther")}
                    className={INPUT}
                    maxLength={200}
                    value={helpOther}
                    onChange={(e) => setHelpOther(e.target.value)}
                  />
                </Field>
              </fieldset>

              {/* Honeypot: invisible to people (and skipped by screen readers); bots tend to fill it in. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label htmlFor={id("website")}>Leave this field empty</label>
                <input
                  id={id("website")}
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/5 p-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--gold)]"
                  checked={consent}
                  aria-describedby={errors.consent ? id("consent-error") : undefined}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  {CONSENT_TEXT} <span className="text-gold">*</span>
                </span>
              </label>
              {errors.consent && (
                <p id={id("consent-error")} className="text-[11px] font-semibold text-red-300">
                  {errors.consent}
                </p>
              )}

              <Turnstile siteKey={siteKey} onToken={setToken} resetSignal={resetSignal} />
              {message && <Notice tone="error">{message}</Notice>}
              <button type="submit" className={`${BTN_PRIMARY} w-full sm:w-auto`} disabled={busy}>
                {busy ? "Sending…" : "Send for review"}
              </button>
              <p className="text-[11px] text-muted-foreground">
                Changed your mind later? See{" "}
                <Link to="/alumni/remove" className="text-gold underline">
                  how to be removed
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </section>
    </Layout>
  );
}
