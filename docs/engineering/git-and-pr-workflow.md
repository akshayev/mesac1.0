# Git and Pull Request Workflow

## Repositories (VERIFIED 2026-11-01)
| Remote | URL | Access |
|---|---|---|
| `origin` | https://github.com/mesac26/mesac1.0 (public, org) | Read only for `akshayev` today |
| `fork` | https://github.com/akshayev/mesac1.0 | Write |
| (backup) | https://github.com/akshayev/mesac-site (private) | Older divergent copy of the project, kept as a backup. Not used for development |

Upstream default branch: `main`.

## Working method
One prompt, one change:

1. Branch from an up-to-date `main`: `git checkout -b feature/<short-name>` (or `fix/`, `docs/`).
2. Make the change. Query the knowledge graph first for questions about the code ([graphify.md](graphify.md)).
3. Verify it yourself ([testing-and-verification.md](testing-and-verification.md)).
4. Update docs and the changelog in the same branch.
5. Scan for secrets before committing.
6. Commit, push to `fork`, open a PR.
7. The PR description states: what changed, how it was verified, what was not verified.
8. Merge after review.

## Merging today
`akshayev` cannot merge into `mesac26/mesac1.0`. Until the org owner grants write access:
- PRs from the fork into `mesac26/mesac1.0` are merged by an org owner, or
- work is merged into `main` of the fork and synced.
Ask the org owner to add `akshayev` as a collaborator; then branch directly in the org repo.

## Keeping the fork current
```bash
git fetch upstream
git checkout main
git merge --ff-only upstream/main
git push fork main
```

## Rules
- `main` must always build (`npm run build`) and lint clean.
- Never force-push to `main`. Never rewrite pushed history. (`AGENTS.md` says the same, for Lovable's sync.)
- Never commit secrets, `.env` files, or personal data from the old site.
- Do not commit generated folders: `.output/`, `.wrangler/`, `node_modules/`, `graphify-out/`.
- Do not commit lockfile churn unless dependencies changed.

## Pull request template (copy into the PR body)
```
## What
## Why
## How verified   (commands run, pages checked, widths checked)
## Not verified
## Docs updated   (files)
## Follow-ups
```
