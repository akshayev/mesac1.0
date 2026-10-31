# Architecture Overview

Status tags follow [../README.md](../README.md). This describes the system **as it is** (VERIFIED) and **as it is meant to become** (DECISION / REQUIREMENT), and keeps the two clearly apart.

## 1. System context

```
 Visitors (70% phones)            Admins (few, full access)
        |                                   |
        v                                   v
  +---------------------------------------------------+
  |   MESAC web app  (TanStack Start, React, SSR)     |
  |   public routes            /admin/* routes        |
  +---------------------------------------------------+
        |  today: imports mock data from src/data/mock
        |  target: loaders / server functions
        v
  +--------------------+   +----------------+   +------------------+
  | Database (D1 or    |   | File storage   |   | Google Drive     |
  | Supabase Postgres) |   | (R2 / Storage) |   | (archive files)  |
  +--------------------+   +----------------+   +------------------+
        ^                          ^                     ^
        |                          |                     |
   Email service (admin alerts)  Turnstile (spam)   Drive API (server only)
```

Everything below the web app box is **not built yet**. Today the app is self-contained.

## 2. Layers

| Layer | Today (VERIFIED) | Target |
|---|---|---|
| Presentation | React 19 components in `src/components`, routes in `src/routes`, Tailwind v4 | Same |
| Application | Route components hold the logic; small helpers in `src/lib` (`events.ts`, `archive.ts`) | Data loaders and server functions behind the service contracts in `src/types/admin.ts` |
| Data | Static TypeScript arrays in `src/data/mock/*.ts` | Database + storage + Drive, see [data-model.md](data-model.md) |

The seam between layers is already designed: `src/types/models.ts` holds the entity types and `src/types/admin.ts` holds the service contracts (`AuthServiceContract`, `ArchiveServiceContract`, `EventsServiceContract`, `TeamServiceContract`, `InboxServiceContract`). A backend developer implements those interfaces and swaps the mock imports. See [backend-contracts.md](backend-contracts.md).

## 3. Request flow

1. Browser requests a URL.
2. TanStack Start renders the matching file-route on the server (SSR) through `src/server.ts` and returns HTML; the client then hydrates.
3. `src/start.ts` registers a request middleware. Unhandled server errors return a static 500 page (`src/lib/error-page.ts`) instead of leaking details. Errors that carry a `statusCode` are re-thrown.
4. `src/router.tsx` builds the router with a TanStack Query client in context. The query client is a provider only; no queries use it yet.
5. `src/routes/__root.tsx` provides the HTML shell, meta tags, the 404 page and the error boundary.
6. Public pages wrap themselves in `components/Layout.tsx` (navbar, footer, loader, smooth scroll). Admin pages wrap in `components/admin/AdminLayout.tsx`.

## 4. Routing

File-based routing. Every file in `src/routes/` is a route. `src/routeTree.gen.ts` is **generated**; never edit it by hand. Full URL list: [../reference/route-map.md](../reference/route-map.md). Routing rules from the framework are in `src/routes/README.md`.

## 5. State and data access

- No global store. Local component state plus two React contexts: `AdminAuthContext` (prototype-preview session) and `AppLoaderContext` (intro loader).
- Theme choice is handled by `src/hooks/useTheme.ts` and `components/ThemeToggle.tsx`. Browser storage is used in `useTheme.ts`, `__root.tsx` and `archive/ReportProblemModal.tsx`.
- Data comes from imports of `src/data/mock/*`. Barrel file: `src/data/mock/index.ts`.

## 6. Build and runtime target

- `vite build` produces `.output/` using the Nitro `cloudflare-module` preset with Node compatibility and generated Wrangler config (VERIFIED in `vite.config.ts` and the build log).
- Dev server: `vite dev --host 0.0.0.0 --port 3000` with `strictPort`.
- Target runtime is **Cloudflare Workers** (DECISION, ADR-0002). A deploy has not been performed.

## 7. Folder map

```
src/
  routes/          file-based routes (public + admin/)
  components/      shared UI; admin/, archive/, department/ subfolders; ui/ = shadcn primitives
  context/         AdminAuthContext, AppLoaderContext
  data/mock/       all mock content, one file per domain
  hooks/           use-mobile, useTheme
  lib/             utils (cn), events and archive helpers, error handling
  types/           models.ts (entities), admin.ts (admin entities + service contracts), index.ts
  assets/          bundled images (logos, gear renders)
  router.tsx       router factory
  start.ts         server request middleware
  server.ts        SSR fetch entry
  styles.css       Tailwind v4 theme tokens, fonts, utilities
public/            static files served as-is (logos, favicon, images/, robots.txt)
docs/              this documentation
```

## 8. Cross-cutting concerns

| Concern | State |
|---|---|
| Authentication / authorisation | Not implemented. Prototype session only. Contract exists. |
| Validation | Client-side form validation. Server-side validation pending. `zod` and `react-hook-form` are installed. |
| Error handling | Root error boundary, 404 page, server 500 middleware. |
| Logging | `console.error` only. Activity log is a UI + type only. |
| Spam protection | Pending (Cloudflare Turnstile planned). |
| Observability / analytics | Pending. |
| Accessibility | Keyboard handling for dialogs and lightbox, reduced-motion support in places (README). Not audited. |
| i18n | English only by decision. |
| Security headers / CSP | UNKNOWN. Nitro generates `.output/public/_headers`; contents not reviewed. |

## 9. Principles to keep

1. Boring, replaceable tools. Prefer standard formats (SQL, CSV, ZIP).
2. No content in code in production. If you add content to a `.tsx` file, you are adding debt.
3. Program against the contracts in `src/types/admin.ts`, not against a vendor SDK, from the UI.
4. Mobile first. Check every change at phone width.
5. Nothing described as "done" until it works with real data and has been verified. See [../engineering/testing-and-verification.md](../engineering/testing-and-verification.md).
