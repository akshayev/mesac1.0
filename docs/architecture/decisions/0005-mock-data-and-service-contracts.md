# ADR-0005: Build the UI on mock data behind service contracts
Status: Accepted
Date: 2026-10-14 (visible in README and `src/types/admin.ts`)

## Context
Pages needed to be developed before the backend exists.

## Decision
All content is typed (`src/types/models.ts`) and served from `src/data/mock/*`. Service interfaces in `src/types/admin.ts` define what the backend must provide. The README rule: do not describe a feature as finished backend functionality just because the screen exists.

## Consequences
- Screens look complete while doing nothing real; the docs must say so (see status-and-roadmap.md).
- Backend work is a swap of data sources, route by route.
- Mock data contains placeholder records and unverified facts that must be reviewed before launch.
