import { createFileRoute } from "@tanstack/react-router";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Linkedin, Mail, MapPin, Phone, Search } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { PageGearBackground } from "@/components/PageGearBackground";
import { Reveal } from "@/components/Reveal";
import { EmptyState } from "@/components/EmptyState";
import { StickyFilterBar } from "@/components/StickyFilterBar";
import { PersonAvatar } from "@/components/PersonAvatar";
import { loadAlumni, useSettings } from "@/data/site";
import { pageHead } from "@/lib/seo";
import type { AlumniEntry } from "@/types";

export const Route = createFileRoute("/alumni")({
  head: () =>
    pageHead({
      title: "Alumni Connect — MESAC CUSAT",
      description:
        "Connect with MESAC alumni of CUSAT Mechanical Engineering for guidance, referrals and career advice.",
      path: "/alumni",
    }),
  loader: () => loadAlumni(),
  component: AlumniPage,
});

const ALL = "";
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const alphabetical = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });
const FIELD =
  "w-full min-w-0 rounded-full border border-border bg-card text-xs text-foreground min-h-[44px] shadow-sm focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold";
const BUTTON =
  "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-secondary/60 px-3 text-xs font-semibold text-foreground transition hover:border-gold/60 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

function AlumniPage() {
  const alumni = Route.useLoaderData();
  const { contactEmail } = useSettings();
  const [batch, setBatch] = useState(ALL);
  const [department, setDepartment] = useState(ALL);
  const [help, setHelp] = useState(ALL);
  const [search, setSearch] = useState("");

  const filters = useMemo(
    () => [
      {
        key: "batch",
        label: "Batch",
        all: "All batches",
        options: unique(alumni.map((a) => a.batch)).sort((a, b) => alphabetical(b, a)),
      },
      {
        key: "department",
        label: "Department",
        all: "All departments",
        options: unique(alumni.map((a) => a.department)).sort(alphabetical),
      },
      {
        key: "help",
        label: "Can help with",
        all: "Any help",
        options: unique(alumni.flatMap((a) => a.helpWith)).sort(alphabetical),
      },
    ],
    [alumni],
  );
  const values: Record<string, [string, (v: string) => void]> = {
    batch: [batch, setBatch],
    department: [department, setDepartment],
    help: [help, setHelp],
  };

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return alumni.filter(
      (a) =>
        (!batch || a.batch === batch) &&
        (!department || a.department === department) &&
        (!help || a.helpWith.includes(help)) &&
        (!query || [a.name, a.company].some((t) => t.toLowerCase().includes(query))),
    );
  }, [alumni, batch, department, help, search]);

  const isFiltered = Boolean(batch || department || help || search.trim());
  const reset = () => {
    setBatch(ALL);
    setDepartment(ALL);
    setHelp(ALL);
    setSearch("");
  };

  const removalLink = `mailto:${contactEmail}?subject=${encodeURIComponent(
    "Alumni Connect: removal or correction request",
  )}`;

  return (
    <Layout>
      <PageHero
        variant="team"
        eyebrow="MESAC Network"
        title={
          <>
            ALUMNI <span className="italic text-gold">CONNECT</span>
          </>
        }
        subtitle="Connect with MESAC alumni for guidance, referrals and career advice."
      />

      {alumni.length > 0 && (
        <StickyFilterBar
          aria-label="Filter alumni"
          className="border-b border-border bg-background/95 backdrop-blur-md shadow-sm py-3"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center lg:gap-3">
              <div className="relative col-span-2 lg:flex-1 lg:max-w-md">
                <Search
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                />
                <input
                  type="search"
                  aria-label="Search alumni by name or company"
                  placeholder="Search name or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`${FIELD} pl-9 pr-3 placeholder:text-muted-foreground/70`}
                />
              </div>
              {filters
                .filter((f) => f.options.length > 1)
                .map((f) => (
                  <select
                    key={f.key}
                    aria-label={f.label}
                    value={values[f.key][0]}
                    onChange={(e) => values[f.key][1](e.target.value)}
                    className={`${FIELD} cursor-pointer px-3 lg:w-48`}
                  >
                    <option value={ALL}>{f.all}</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {f.key === "batch" ? `Batch ${o}` : o}
                      </option>
                    ))}
                  </select>
                ))}
              {isFiltered && (
                <button
                  type="button"
                  onClick={reset}
                  className="min-h-[44px] rounded-full border border-border/80 px-4 text-xs font-semibold text-gold hover:bg-secondary/60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </StickyFilterBar>
      )}

      <section className="sticky-content-container py-12 sm:py-16 relative overflow-hidden bg-background">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 via-background to-secondary/15 pointer-events-none" />
        <PageGearBackground variant="team" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
          {alumni.length > 0 && (
            <p role="status" className="text-xs font-semibold text-muted-foreground">
              Showing {shown.length} of {alumni.length} alumni
            </p>
          )}

          {shown.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {shown.map((person, idx) => (
                <li key={`${person.name}-${person.batch}-${idx}`} className="flex min-w-0">
                  <Reveal delay={(idx % 6) * 40} className="flex w-full">
                    <AlumniCard person={person} />
                  </Reveal>
                </li>
              ))}
            </ul>
          ) : alumni.length === 0 ? (
            <EmptyState
              title="Alumni Connect is coming soon"
              description="We are asking alumni for permission to list their details. Please check back later."
            />
          ) : (
            <EmptyState
              title="No alumni match these filters"
              description="Try another search, or clear the filters."
              actionText="Reset All Filters"
              onAction={reset}
            />
          )}

          <div className="mx-auto max-w-2xl rounded-2xl border border-border/80 bg-card p-5 text-center text-sm text-muted-foreground shadow-sm">
            <p>
              Contact details are shared with the alumnus's permission. Please be polite and
              specific when you reach out.
            </p>
            <a
              href={removalLink}
              className="mt-2 inline-flex min-h-[24px] items-center font-semibold text-gold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              Ask to be removed or corrected
            </a>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function AlumniCard({ person }: { person: AlumniEntry }) {
  const nameId = useId();
  const job = [person.currentRole, person.company].filter(Boolean).join(" at ");
  const study = [person.batch && `Batch ${person.batch}`, person.department]
    .filter(Boolean)
    .join(" · ");
  const contacts: Array<{ label: string; href: string; icon: ReactNode; external?: boolean }> = [];
  if (person.linkedin)
    contacts.push({
      label: "LinkedIn",
      href: person.linkedin,
      icon: <Linkedin aria-hidden="true" className="h-4 w-4" />,
      external: true,
    });
  if (person.email)
    contacts.push({
      label: "Email",
      href: `mailto:${person.email}`,
      icon: <Mail aria-hidden="true" className="h-4 w-4" />,
    });
  if (person.phone)
    contacts.push({
      label: "Call",
      href: `tel:${person.phone}`,
      icon: <Phone aria-hidden="true" className="h-4 w-4" />,
    });

  return (
    <article
      aria-labelledby={nameId}
      className="group flex h-full w-full flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm card-lift hover:border-gold/40 transition-all"
    >
      <div>
        <div className="flex items-center gap-3">
          <PersonAvatar
            name={person.name}
            photo={person.photo}
            className="h-16 w-16 rounded-2xl border border-border/80 shrink-0"
          />
          <div className="min-w-0">
            <h2
              id={nameId}
              className="font-display text-base font-bold text-foreground leading-snug break-words"
            >
              {person.name}
            </h2>
            {study && (
              <div className="mt-0.5 text-[11px] font-semibold text-muted-foreground break-words">
                {study}
              </div>
            )}
          </div>
        </div>
        {job && <p className="mt-4 text-sm text-foreground break-words">{job}</p>}
        {person.location && (
          <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
            <span className="min-w-0 break-words">{person.location}</span>
          </p>
        )}
        {person.helpWith.length > 0 && (
          <ul aria-label="Help offered" className="mt-3 flex flex-wrap gap-1.5">
            {person.helpWith.map((h) => (
              <li
                key={h}
                className="max-w-full break-words rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold"
              >
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>
      {contacts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">
          {contacts.map((c) => (
            <a
              key={c.label}
              href={c.href}
              aria-label={`${c.label}: ${person.name}`}
              {...(c.external ? { target: "_blank", rel: "noreferrer" } : {})}
              className={BUTTON}
            >
              {c.icon}
              <span>{c.label}</span>
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
