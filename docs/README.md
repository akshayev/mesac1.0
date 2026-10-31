# MESAC Website: Project Documentation

Single source of truth for the MESAC (Mechanical Engineering Students' Association, CUSAT) website. If you are new to this project, read this page first, then follow the reading order below.

**Last verified against the code:** 2026-11-01 (commit `ebc15e1`, `npm run lint` clean, `npm run build` succeeds).

## Honesty convention used in every document

Every statement in `docs/` is tagged by where it came from:

| Tag | Meaning |
|---|---|
| **VERIFIED** | Checked in the code, config, or by running a command. File paths are given. |
| **REQUIREMENT** | Stated in the requirements proposal (Oct 2, 2026) or README. Not necessarily built. |
| **DECISION** | A choice the team made. See `architecture/decisions/`. |
| **UNKNOWN** | Nobody has confirmed it. Listed in `operations/open-questions-and-risks.md`. |

If you change the project, change the matching document in the same pull request. A doc that disagrees with the code is a bug.

## One-paragraph summary

A mobile-first public website for MESAC plus an admin dashboard and a public academic archive (question papers and syllabi). **Today it is a working front-end prototype**: every page renders from hardcoded mock data in `src/data/mock/`, and the admin area and all forms are UI only. There is no database, no real login, no email, and no file storage yet. Closing that gap is the remaining work. See `product/status-and-roadmap.md`.

## Reading order

| # | If you want to know... | Read |
|---|---|---|
| 1 | What are we building and why | [product/prd.md](product/prd.md) |
| 2 | What is done and what is left | [product/status-and-roadmap.md](product/status-and-roadmap.md) |
| 3 | How the system fits together | [architecture/overview.md](architecture/overview.md) |
| 4 | What technology we use and why | [architecture/tech-stack.md](architecture/tech-stack.md) |
| 5 | What data exists and the target database | [architecture/data-model.md](architecture/data-model.md) |
| 6 | What the backend must implement | [architecture/backend-contracts.md](architecture/backend-contracts.md) |
| 7 | Why each big choice was made | [architecture/decisions/](architecture/decisions/README.md) |
| 8 | Every page and URL | [reference/route-map.md](reference/route-map.md) |
| 9 | The admin dashboard | [reference/admin-dashboard.md](reference/admin-dashboard.md) |
| 10 | How to run, test, and contribute | [engineering/](engineering/getting-started.md) |
| 11 | Deployment, handover, backups | [operations/](operations/deployment.md) |
| 12 | Risks and open questions | [operations/open-questions-and-risks.md](operations/open-questions-and-risks.md) |
| 13 | Terms and abbreviations | [reference/glossary.md](reference/glossary.md) |
| 14 | The code knowledge graph | [engineering/graphify.md](engineering/graphify.md) |

## Folder layout

```
docs/
  README.md                     this file
  product/
    prd.md                      product requirements (what and why)
    status-and-roadmap.md       done / pending, 4-week plan, launch checklist
  architecture/
    overview.md                 system context, layers, request flow, folder map
    tech-stack.md               every technology, version, purpose, known issues
    data-model.md               entities today (TypeScript) and target database tables
    backend-contracts.md        service interfaces the backend must implement
    decisions/                  Architecture Decision Records (ADR-0001 ...)
  engineering/
    getting-started.md          install, run, build, lint
    conventions.md              code style, structure, naming
    testing-and-verification.md what "verified" means here, checklists
    git-and-pr-workflow.md      branches, commits, PRs, merging
    graphify.md                 using the knowledge graph
  operations/
    deployment.md               build output and Cloudflare deploy
    handover-guide.md           accounts, recovery, yearly handover (template)
    open-questions-and-risks.md risks, unknowns, blockers
  reference/
    route-map.md                every URL and what it does
    admin-dashboard.md          admin screens and their backend needs
    glossary.md                 terms
    changelog.md                what changed, newest first
```
