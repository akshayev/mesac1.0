# Deployment

**Status: not deployed.** Only the build has been verified.

## Build output (VERIFIED 2026-11-01)
`npm run build` produces `.output/` containing `server/` (worker, generated `wrangler.json`), `public/` (static assets, generated `_headers`) and `nitro.json`. Nitro reports the worker name `mesac26-mesac1-0` and says it can be previewed with `npx vite preview` and deployed with `npx nitro deploy --prebuilt`. The preset is `cloudflare-module` with Node compatibility, configured in `vite.config.ts`.

## Target
Cloudflare Workers, with D1, R2, Turnstile and Web Analytics on the same account (ADR-0002). Domain DNS moves to Cloudflare.

## Steps to go live (checklist)
1. Create the Cloudflare account under the shared MESAC email, with two-factor authentication. Store recovery codes in the handover guide (not in git).
2. Create D1 database, R2 bucket, Turnstile site. Record their names (not secrets) in the handover guide.
3. Define bindings and environment variables; list names in `.env.example`; set values in Cloudflare, not in git.
4. Apply database migrations from the repo.
5. Run the Drive import (archive) and the content migration.
6. `npm run build`, then deploy (`npx nitro deploy --prebuilt`, or Cloudflare's Git integration).
7. Review `.output/public/_headers` and add security headers and a CSP (UNKNOWN today).
8. Preview on a `*.workers.dev` URL first. Test both forms on a real phone including the admin email.
9. The registrar-login holder points the domain nameservers to Cloudflare. Then attach the custom domain.
10. Confirm `/admin` requires real authentication before the domain is attached.
11. Enable analytics. Submit the sitemap.
12. Run and then restore a backup once.

## Environments
| Environment | URL | Notes |
|---|---|---|
| Local | http://localhost:3000 | `npm run dev` |
| Preview | UNKNOWN | Create at first deploy |
| Production | UNKNOWN | Domain name is owned but not recorded in this repo |

## Rollback
Keep the previous deployment available in Cloudflare and redeploy it; database migrations must be written so the previous version still works (add columns before using them, remove only later).

## Continuous integration
None exists. Add a workflow that runs lint, type-check, build and tests on every PR (see testing-and-verification.md).
