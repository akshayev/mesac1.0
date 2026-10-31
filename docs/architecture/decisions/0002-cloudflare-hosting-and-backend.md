# ADR-0002: Cloudflare as host and backend
Status: Accepted in the proposal; not implemented
Date: 2026-10-02 (proposal)

## Context
Needs: free tiers, nothing that pauses, one account for DNS + hosting + database + files + analytics + spam protection, exportable data.

## Decision
Cloudflare Workers (hosting), D1 (SQLite database), R2 (files and images), Turnstile (spam), Web Analytics. The build is already configured for it (`vite.config.ts`, Nitro preset `cloudflare-module`).

## Alternatives
- **Supabase free (Postgres + Storage + Auth).** Built-in auth, standard Postgres, but projects pause after 7 days idle (needs a keep-alive job), 500 MB DB / 1 GB files. Kept as the fallback.

## Consequences
- We write authentication ourselves (ADR-0004).
- Daily cap of 100,000 Worker requests and 10 ms CPU per request on free: cache public pages.
- No built-in backups: build our own scheduled export.
- The registrar-login holder must move the domain nameservers to Cloudflare.
- Figures must be re-verified at build time and yearly.
