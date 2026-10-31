# Tech Stack

Versions are the **declared ranges** in `package.json` (VERIFIED 2026-11-01). Installed versions are in `package-lock.json`.

## Runtime and tooling

| Area | Technology | Declared version | Why / role |
|---|---|---|---|
| Language | TypeScript | ^5.8.3 | Strict typing across UI and future backend |
| UI library | React, React DOM | ^19.2.0 | |
| Framework | TanStack Start (`@tanstack/react-start`) | ^1.168.26 | SSR, file-based routing, server functions |
| Router | `@tanstack/react-router`, `@tanstack/router-plugin` | ^1.170.16 / ^1.168.18 | Typed file routes |
| Data fetching | `@tanstack/react-query` | ^5.101.1 | Provider installed; no queries yet |
| Build | Vite | ^8.0.16 | Dev server and bundling |
| Server bundler | `nitro` | `3.0.260603-beta` (pinned beta) | Produces the Cloudflare worker output. **Risk**: beta, see below |
| Styling | Tailwind CSS v4 + `@tailwindcss/vite`, `tw-animate-css` | ^4.2.1 / ^1.3.4 | Theme tokens in `src/styles.css` |
| Components | shadcn/ui pattern (`components.json`), Radix UI primitives, `class-variance-authority`, `clsx`, `tailwind-merge` | various | Files live in `src/components/ui/` |
| Icons | `lucide-react` | ^0.575.0 | |
| Forms | `react-hook-form`, `@hookform/resolvers`, `zod` | ^7.71 / ^5.2 / ^3.24 | Installed; current forms use hand-written validation (UNVERIFIED which routes use these) |
| Notifications | `sonner` | ^2.0.7 | Toasts |
| Animation | `gsap`, `lenis`, `three`, `@types/three` | ^3.15 / ^1.3 / ^0.186 | Hero animation, smooth scroll, 3D gear. **Conflicts with design direction**, see below |
| PDF | `jspdf` | ^4.2.1 | Used for generated documents in the prototype; proposal says fake generated PDFs are removed |
| Other UI libs | `cmdk`, `vaul`, `embla-carousel-react`, `recharts`, `react-day-picker`, `input-otp`, `react-resizable-panels`, `date-fns` | various | Available via shadcn components |
| Lint / format | ESLint 9 (flat config) + typescript-eslint, Prettier 3 | ^9.32 / ^3.7 | `npm run lint`, `npm run format` |
| Images | `sharp` | ^0.35.5 | Dev dependency for image processing |
| Package manager | npm | lockfile present | `package-lock.json` |
| Node | UNKNOWN pinned version | | The framework likely needs Node 22.12+ (INFERRED from earlier audit of the lockfile); no `.nvmrc` exists |

## Planned services (DECISION unless noted)

| Need | Choice | Status |
|---|---|---|
| Hosting + CDN + DNS | Cloudflare Workers | Decided in the proposal; ADR-0002 |
| Database | Cloudflare D1 (SQLite). Fallback: Supabase Postgres | Not created |
| File / image storage | Cloudflare R2 | Not created |
| Archive file storage | Google Drive (shared MESAC account) via Drive API | Not connected |
| Admin sign-in | Google sign-in + email one-time code, approved-admin table | Contract only |
| Email | Transactional service with a free tier (Resend or Brevo class) | Not chosen. Needs DNS access |
| Spam protection | Cloudflare Turnstile | Not integrated |
| Analytics | Cloudflare Web Analytics or Umami | Not integrated |
| Backups | Scheduled export of DB + file list to separate storage; one-click export | Not built |
| CI | Automatic checks on every change (private repo preferred) | Not set up (UNVERIFIED: no `.github/` folder in the repo) |

## Backend comparison (from the proposal; re-verify figures at build time)

| Factor | Cloudflare D1 + R2 | Supabase free |
|---|---|---|
| Inactivity pausing | None | Pauses after 7 days idle |
| Backups on free plan | Build our own | Not included; build our own |
| Storage | 5 GB DB, 10 GB files | 500 MB DB, 1 GB files |
| Limits | 100,000 Worker requests/day, 10 ms CPU/request | 5 GB egress cap |
| Built-in auth | No, write it | Yes |
| Lock-in | Moderate, SQLite exports easily | Low, standard Postgres |

## Known stack issues

1. **Pinned beta bundler** (`nitro` 3.0.260603-beta). Longevity risk; plan an upgrade path when a stable release exists.
2. **Heavy animation stack** (`three`, `gsap`, `lenis`) contradicts the "calm, no scroll-driven animation libraries" design direction and adds bundle weight (the build output shows a ~1.3 MB `three` server chunk).
3. **Third-party font CDN** in `src/styles.css`. Self-host the final fonts.
4. **Many installed packages are only used by unused shadcn components.** Audit and prune (UNVERIFIED which are unused in this version; graph shows `cn()` and `Button` as the most used).
5. **Framework differs from the proposal** (Astro suggested). See ADR-0001.
6. **Package name** `tanstack_start_ts` is a template leftover.
