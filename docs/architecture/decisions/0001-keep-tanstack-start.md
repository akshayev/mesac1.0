# ADR-0001: Keep TanStack Start instead of migrating to Astro
Status: Accepted (provisional)
Date: 2026-11-01 (records a choice visible in the code and README)

## Context
The Oct 2 proposal recommended Astro with a React admin, mainly because TanStack Start is young and the server bundler (`nitro`) is pinned to a beta. The delivered front-end, and the README ("The existing architecture has been retained rather than migrating frameworks"), stayed on TanStack Start. Evidence: `package.json`, `vite.config.ts`.

## Decision
Keep TanStack Start (React 19, Vite, Tailwind v4) for the current phase. Do not migrate during backend work.

## Alternatives
- **Astro + React islands (proposal).** Less JavaScript on phones, very mature. Rejected for now: 15 screens and 16 public routes already exist and work; a migration would delay the archive and backend, which are the launch priority.
- **Next.js.** Heavier, and a different hosting story on Cloudflare. Not proposed.

## Consequences
- Longevity risk from a young framework and the pinned beta `nitro`. Mitigation: keep business logic outside route files behind the service contracts so the UI can be moved later.
- Revisit after launch. Trigger for revisiting: framework breaking changes, or measured poor mobile performance.
- The tech-stack doc tracks this as a known issue.
