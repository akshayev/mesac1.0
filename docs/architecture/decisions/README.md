# Architecture Decision Records (ADRs)

One file per significant decision. Never delete an ADR; if a decision changes, add a new ADR and mark the old one **Superseded by ADR-XXXX**.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-keep-tanstack-start.md) | Keep TanStack Start instead of migrating to Astro | Accepted (provisional) |
| [0002](0002-cloudflare-hosting-and-backend.md) | Cloudflare as host and backend | Accepted in proposal; not yet implemented |
| [0003](0003-hybrid-google-drive-archive.md) | Hybrid archive: files in Google Drive, index in our database | Accepted |
| [0004](0004-approved-admin-list-auth.md) | Approved-admin list with Google or email one-time code | Accepted |
| [0005](0005-mock-data-and-service-contracts.md) | Build the UI on mock data behind service contracts | Accepted |
| [0006](0006-design-direction.md) | Professional, restrained maroon and gold design | Accepted; implementation incomplete |
| [0007](0007-docs-and-knowledge-graph.md) | Docs folder and graphify knowledge graph as project memory | Accepted |

## Template

```
# ADR-XXXX: Title
Status: Proposed | Accepted | Superseded by ADR-YYYY
Date: YYYY-MM-DD
## Context        what forced a decision
## Decision       what we chose
## Alternatives   what else we considered and why not
## Consequences   good, bad, follow-up work
```
