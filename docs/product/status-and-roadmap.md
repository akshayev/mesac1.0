# Status and Roadmap

Last verified: 2026-11-01 against commit `ebc15e1`.

## 1. Where the project is

**Front-end prototype, feature-rich UI, no backend.** (VERIFIED: `src/data/mock/*` feeds the UI; `src/context/AdminAuthContext.tsx` returns "pending backend" messages; no API routes, no database client, no env vars in `.env.example`.)

## 2. Feature status

Legend: **UI** = interface exists on mock data. **Pending** = not started. Nothing below counts as "done" until it works against real data.

| Area | UI | Real backend | Notes |
|---|---|---|---|
| Home | Yes | Pending | Hero, stats, featured events |
| Events (search, tag filter, detail modal) | Yes | Pending | `src/lib/events.ts` classifies upcoming/past by date |
| Gallery (albums, lightbox) | Yes | Pending | |
| Team and academic-year archive | Yes | Pending | "Start new academic year" is a contract only |
| Achievements | Yes | Pending | |
| Placements | Yes | Pending | Duplicate cleanup still required |
| Mechanical Department | Yes | Pending | HOD must become data |
| Academy tracks + enrollment form | Yes | Pending | Form submits nothing |
| GPA/CGPA calculator | Yes | n/a (client side) | Official CUSAT grading rules still unconfirmed |
| Academic Archive (browse, filters, detail, preview) | Yes | Pending | Needs Drive integration and index |
| Report a problem (archive) | Yes | Pending | Not stored |
| About MESAC | Yes | Pending | |
| Contact form | Yes | Pending | No storage, no spam protection, no email |
| Privacy notice | Yes | Review needed | Must be updated when backend ships |
| Alumni registration | Yes | Pending | Username is temporary, not unique |
| Admin sign-in | Prototype only | Pending | Runs in "prototype-preview" mode with a fixture superadmin |
| Admin dashboard screens (15 sidebar pages + login) | Yes | Pending | See [admin-dashboard.md](../reference/admin-dashboard.md) |
| Activity log, backups, export | Screens only | Pending | |
| Analytics | Pending | Pending | |
| SEO (sitemap, social image) | Partial | n/a | Per-route titles exist; sitemap not verified |
| Automated tests | None | n/a | No test script in `package.json` |
| Deployment | Build works | Not deployed | Nitro `cloudflare-module` preset configured |

## 3. Build health (VERIFIED 2026-11-01)

- `npm install` succeeds.
- `npm run lint` passes with no output.
- `npm run build` succeeds and generates `.output/` with Cloudflare worker config.
- Dev server: `npm run dev` on port 3000.
- Not run: type-check (`tsc --noEmit`), tests (none exist), accessibility or performance audits.

## 4. What is left, in order

Priority follows the proposal: archive first, then admin, then public wiring, then hardening.

### Phase A: Foundation
1. Decide and record the backend (Cloudflare D1+R2 recommended, Supabase fallback). See ADR-0002.
2. Create accounts under the shared MESAC email; store recovery info in the handover guide.
3. Create the database schema from [data-model.md](../architecture/data-model.md).
4. Add environment-variable handling and a `.env.example` that lists real variables.
5. Remove Lovable leftovers: `AGENTS.md` still carries a Lovable notice (the only remaining reference found by search).

### Phase B: Archive (launch priority)
6. Check how the shared Drive is organised (UNKNOWN today).
7. Implement `ArchiveServiceContract` against the database.
8. One-time Drive import script that builds the first index.
9. Archive admin: upload, edit, replace, bulk tag, health check.
10. Public archive: real preview, download, hot-file cache, graceful fallback.
11. Report-a-problem stored and shown in the inbox.

### Phase C: Admin dashboard
12. Real authentication with an approved-admin list (Google + email one-time code).
13. CRUD for events, gallery, team, achievements, placements, faculty, labs, programs, academy tracks, site settings, home page.
14. "Start new academic year" flow.
15. Inbox for enrollments, contact messages, problem reports, with email notification to admins.
16. Activity log written on every change.

### Phase D: Public site on real data
17. Replace mock imports with data loaders (TanStack Router loaders / server functions).
18. Persist enrollment, contact and alumni forms; add Turnstile spam protection.
19. Migrate existing content (including cleaning placement duplicates, fixing MESA vs MESAC).
20. Per-person "show contact" toggle honoured on the public site.

### Phase E: Hardening and launch
21. Backups (scheduled, separate storage), one-click export, and a tested restore.
22. Accessibility, mobile performance, SEO basics (sitemap, social image).
23. Analytics (Cloudflare Web Analytics or Umami), no cookie banner.
24. Self-host fonts, reduce asset weight (see section 6).
25. Connect the domain (registrar holder moves nameservers to Cloudflare).
26. Handover guide completed, privacy notice reviewed, final team review.

### Deferred past launch
News/blog archive, editable GPA grade scale, restore-deleted-items, non-essential animation polish.

## 5. Original four-week plan (for reference)

| Week | Focus |
|---|---|
| 1 | Foundation, database tables, admin sign-in, design system, start copying images from old links |
| 2 | Archive first (Drive connection, index import, archive manager), then dashboard CRUD, activity log |
| 3 | Archive public pages with preview and caching, public pages on real data, forms with spam protection and email, privacy notice, migrate content |
| 4 | Backups, export, accessibility and performance, analytics, SEO, handover guide, domain, final review |

The proposal was written Oct 2, 2026. The repository history shows five commits between 2026-10-09 and 2026-10-14, all front-end. The timeline should be re-planned (see open questions).

## 6. Known gaps between the code and the requirements (VERIFIED)

| Gap | Evidence | Requirement it violates |
|---|---|---|
| Still on TanStack Start; proposal suggested Astro | `package.json`, `vite.config.ts` | Recorded as a deliberate choice, ADR-0001 |
| Pinned beta server bundler | `nitro` `3.0.260603-beta` in `package.json` | Longevity principle |
| Fonts loaded from a third-party CDN | `src/styles.css` (`fonts.cdnfonts.com`) | "Fonts will be self-hosted" |
| Heavy animation stack still present | `three`, `gsap`, `lenis` in dependencies; `Single3DRealisticGear.tsx`, `PageGearBackground.tsx`, `SmoothScroll.tsx` | "No scroll-driven animation libraries", "remove heavy animated gear backgrounds" |
| `public/` is about 37 MB; several duplicate logo files | `du -sh public`; `mesac-logo*.png/jpg/svg`, `mesac-real-logo.png` | Fast on mid-range phones |
| Package name is `tanstack_start_ts` | `package.json` | Cosmetic; rename when convenient |
| Unusual route files kept for compatibility | `galery.tsx`, `downloads.tsx` redirect to `/gallery`, `/archive` | Intentional redirects; keep |
| Syntax error flagged by the graph extractor in `src/routes/index.tsx` near line 328 | graphify AST warning | Needs a human check. ESLint and the build pass, so it may be a parser limitation |
| No automated tests | no test script | Quality |
| `.env.example` has no real variables | file content | Backend not started |

## 7. Next recommended task

Phase A step 1 and 2: confirm the backend choice and create the accounts, because every later step depends on it.
