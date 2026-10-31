# Conventions

## Code
- TypeScript strict (`tsconfig.json`). Path alias `@/*` maps to `src/*`.
- Format with Prettier (`.prettierrc`); lint with ESLint (`eslint.config.js`). Run `npm run lint` before every PR.
- Components: PascalCase files in `src/components`. Group by domain in subfolders (`admin/`, `archive/`, `department/`).
- `src/components/ui/` holds shadcn/ui primitives. Add new ones with the shadcn CLI (`components.json`), do not hand-roll variants.
- Class names via `cn()` from `src/lib/utils.ts` (most used function in the codebase, per the knowledge graph).
- Types live in `src/types`. Add entity types to `models.ts`, admin/service types to `admin.ts`.
- Mock content lives only in `src/data/mock/`. Do not put content arrays in route files.
- Routes: see [../reference/route-map.md](../reference/route-map.md). Never edit `src/routeTree.gen.ts`.

## UI
- Mobile first: write the phone layout, then widen.
- Keyboard: dialogs and lightboxes close on Esc and trap focus (Radix handles this; keep using it).
- Respect `prefers-reduced-motion` for any new animation.
- Every route has a `head()` with a title and description.
- Form fields have labels and inline error messages.
- Prefer existing tokens in `src/styles.css` over new hardcoded colours.

## Data and security
- No secrets in git, ever. Run a secret scan before committing.
- Never expose phone or personal email of a person unless their `show_contact` flag is true.
- Validate on the server for anything that writes.

## Commits
Conventional style, imperative mood, one logical change per commit:
`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `chore: ...`.

## Documentation
If a PR changes behaviour, routes, data shape, a decision, or status, update the matching file in `docs/` and add a line to [../reference/changelog.md](../reference/changelog.md).
