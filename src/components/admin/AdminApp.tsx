/**
 * The dashboard shell: checks who is signed in (/admin/api/me), then shows the section tabs.
 * Sections are /admin/<section>; the content lists are driven by src/shared/entities.ts.
 */
import { Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ApiError, api, type Me } from "./api";
import { MeContext, SECTIONS } from "./context";
import { FOCUS, Notice } from "./ui";

export function AdminApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    api<Me>("GET", "/me")
      .then(setMe)
      .catch((err) =>
        setProblem(
          err instanceof ApiError && (err.status === 401 || err.status === 403)
            ? err.message
            : "The dashboard could not load. Try again in a minute.",
        ),
      );
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="font-display text-base font-extrabold tracking-tight">
            MESAC <span className="text-gold">Admin</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {me && (
              <span className="break-all">
                {me.email} · <span className="text-gold">{me.role}</span>
              </span>
            )}
            <a href="/" className={`inline-flex min-h-[44px] items-center underline ${FOCUS}`}>
              View site
            </a>
            <a
              href="/cdn-cgi/access/logout"
              className={`inline-flex min-h-[44px] items-center underline ${FOCUS}`}
            >
              Sign out
            </a>
          </div>
        </div>
        {me && (
          <nav
            aria-label="Dashboard sections"
            className="mx-auto max-w-5xl overflow-x-auto px-4 pb-3"
          >
            <ul className="flex gap-1.5">
              {SECTIONS.filter((s) => !("adminOnly" in s) || me.role === "admin").map((s) => (
                <li key={s.id}>
                  <Link
                    to="/admin/$section"
                    params={{ section: s.id }}
                    className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full border border-border/80 px-3.5 text-xs font-semibold text-muted-foreground hover:text-foreground ${FOCUS}`}
                    activeProps={{
                      className: "gradient-gold !text-primary border-transparent",
                      "aria-current": "page",
                    }}
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {problem ? (
          <div className="space-y-3">
            <Notice tone="error">{problem}</Notice>
            <p className="text-sm text-muted-foreground">
              If you should have access, ask a MESAC admin to add your email to the admin list and
              to the Cloudflare Access policy.
            </p>
          </div>
        ) : me ? (
          <MeContext.Provider value={me}>
            <Outlet />
          </MeContext.Provider>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </main>
    </div>
  );
}
