# Using the Knowledge Graph (graphify)

## What it is
graphify parses the source and produces a graph of files, functions, components and their relationships. It lets an assistant (or you) answer "what depends on X?" from the real code instead of guessing.

## What was built (2026-11-01)
- Scope: the 148 code files in the repo. 951 nodes, 2,652 edges, 66 communities. 99% of edges are directly extracted from code, 1% inferred.
- Not included: the 4 documentation files and 67 images were not analysed.
- Known gaps: `src/routes/index.tsx` had a parser warning near line 328 (only 2 symbols extracted); five files yielded no symbols (`eslint.config.js`, `ui/aspect-ratio.tsx`, `ui/collapsible.tsx`, `data/mock/index.ts`, `types/index.ts`). The community names are still generic ("Community 0").

## Where it lives
`graphify-out/` at the repo root (local only, excluded from git through `.git/info/exclude`):
- `graph.html`: open in a browser to explore
- `GRAPH_REPORT.md`: summary, most-connected nodes, communities
- `graph.json`: raw graph

## Regenerate after code changes
Inside Claude Code in the repo: `/graphify . --update`. Or run the CLI: `graphify update .` (installed with `uv tool install graphifyy`).

## Ask questions
`/graphify query "what renders the archive document page?"`, `/graphify path "A" "B"`, `/graphify explain "AdminLayout"`.

## Most connected nodes (orientation)
`cn()` (class merge helper), `react`, `lucide-react`, `@tanstack/react-router`, `Button`, `AdminLayout()`, `FileRoutesByPath`, `Layout()`, `AdminPageHeader()`, `Input`. Changing any of these has wide impact.

## Honesty rules
Treat INFERRED edges as hints, not facts. If the graph and the code disagree, the code wins; regenerate the graph.
