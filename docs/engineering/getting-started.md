# Getting Started

## Prerequisites
- Node.js 22.12 or newer (INFERRED from the framework's requirement; no `.nvmrc` exists yet).
- npm (a `package-lock.json` is committed; do not use another package manager).
- Git, and the GitHub CLI (`gh`) for the PR workflow.

## Setup
```bash
git clone https://github.com/akshayev/mesac1.0.git     # your fork
cd mesac1.0
git remote add upstream https://github.com/mesac26/mesac1.0.git
npm install
```

## Commands (VERIFIED in `package.json`)
| Command | What it does |
|---|---|
| `npm run dev` | Dev server at http://localhost:3000 (host 0.0.0.0, port fixed, fails if 3000 is busy) |
| `npm run build` | Production build into `.output/` (Cloudflare worker preset) |
| `npm run build:dev` | Build in development mode |
| `npm run preview` | Preview a production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier, writes files |

There is **no test script** and no type-check script. To type-check manually: `npx tsc --noEmit` (not part of CI; run it yourself).

## Environment variables
`.env.example` currently lists none (comment only). Add real variable names there when the backend arrives. Real values never go in git. `.gitignore` currently ignores `*.local`, `.wrangler/` and `.dev.vars`, but **not** a plain `.env` file (VERIFIED). Use `.dev.vars` or `.env.local` for local secrets, and add `.env` to `.gitignore` before ever creating one.

## First check that everything works
1. `npm run dev`, open `/`, `/archive`, `/events`, `/admin`.
2. `npm run lint` finishes with no errors.
3. `npm run build` ends with "You can preview this build".

## Common problems
| Symptom | Cause / fix |
|---|---|
| Dev server will not start, port 3000 in use | `strictPort` is on. Stop the other process |
| `src/routeTree.gen.ts` changed after running dev | Expected: it is generated from `src/routes/`. Commit it with the route change |
| `package-lock.json` shows as modified after install | npm version differences. Do not commit lockfile churn unless you changed dependencies |
| Build warns about `use client` directives | Intentionally suppressed in `vite.config.ts` |
