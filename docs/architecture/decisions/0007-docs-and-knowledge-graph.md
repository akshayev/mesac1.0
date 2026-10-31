# ADR-0007: Docs folder and graphify knowledge graph as project memory
Status: Accepted
Date: 2026-11-01

## Context
The project changes hands (students graduate yearly) and is worked on with AI assistants. Memory loss and hallucination are the main risks.

## Decision
- `docs/` is the written record: requirements, status, architecture, decisions, operations, handover.
- A graphify knowledge graph of the code (`graphify-out/`) is generated locally and used to ground answers about the codebase. It is not committed (see engineering/graphify.md).
- Docs change in the same PR as the code they describe.

## Consequences
Small ongoing cost per PR. Large saving at every handover.
