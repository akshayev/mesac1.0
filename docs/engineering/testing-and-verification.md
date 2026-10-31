# Testing and Verification

## Current state (VERIFIED)
- No automated tests exist; `package.json` has no test script.
- ESLint passes. The production build succeeds.

## Definition of "verified"
A change is verified only when you have **run** it and looked at the result:

1. `npm run lint` clean.
2. `npm run build` succeeds.
3. Dev server running; every route touched loads with HTTP 200 and renders correctly.
4. Checked at phone width (about 390 px) and desktop width.
5. For forms and dialogs: tried valid input, invalid input, empty input, keyboard only, and Esc.
6. No new errors in the browser console.
7. For data changes: the page reads the new data, not stale mock values.

Say plainly in the PR what you ran and what you did not.

## Manual smoke checklist (until automated tests exist)
| Area | Check |
|---|---|
| Navigation | Every navbar link works on desktop and the mobile drawer |
| Redirects | `/downloads` goes to `/archive`; `/galery` goes to `/gallery` |
| Events | Search, tag filter, detail modal, upcoming vs past split |
| Gallery | Lightbox next/prev with arrow keys, Esc closes |
| Archive | Filters, search, empty state, document page, preview, download, report a problem |
| Academy | Track search/level filter, enrollment form validation, GPA calculator results |
| Alumni | Validation, success state, copy username, reset |
| Contact | Validation messages |
| Admin | Each of the 15 sidebar pages opens; mobile sidebar opens and closes |
| 404 | Unknown URL shows the 404 page |

## Recommended test tooling to add (proposal, not decided)
- Vitest for `src/lib/*` (for example the date logic in `events.ts`) and the GPA calculation.
- Playwright for a few end-to-end smoke tests of the routes above.
- A CI workflow that runs lint, type-check, build and tests on every pull request.

## Before launch
Accessibility audit, mobile performance check on a mid-range phone, both forms tested on a real phone including the admin email, and a backup restored once. See [../product/status-and-roadmap.md](../product/status-and-roadmap.md).
