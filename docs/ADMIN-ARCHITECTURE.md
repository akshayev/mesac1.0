# Admin dashboard: how it works

The MESAC site can run in two modes. The switch is one GitHub secret, `D1_DATABASE_ID`.

|                                                  | **Sheet mode** (default)                         | **Dashboard mode**                         |
| ------------------------------------------------ | ------------------------------------------------ | ------------------------------------------ |
| Team, achievements, placements, alumni, settings | Google Sheet, copied into the build every night  | Cloudflare D1 database, edited at `/admin` |
| Question papers                                  | Google Drive                                     | Google Drive (unchanged)                   |
| Photos                                           | Links (https, Drive, `people/…`)                 | Links, or uploads stored in Cloudflare R2  |
| `/admin`                                         | "Page not found"                                 | The dashboard, behind Cloudflare Access    |
| A change appears on the site                     | After the next build (nightly or "Run workflow") | Within about a minute                      |

## The picture

```
 Visitor ──► Cloudflare ──► Worker (this site)
                              │
                              ├─ /archive ............ Drive index built into the site
                              ├─ /, /team, /alumni ... ─┬─ Sheet mode:     snapshot built into the Worker
                              │                         └─ Dashboard mode: D1 (visible rows only), cached 60 s
                              └─ /media/<random>.webp  R2 photo, cached 7 days

 Committee ──► Cloudflare Access (email one-time PIN; only listed emails)
                 │ adds a signed token (Cf-Access-Jwt-Assertion)
                 ▼
               Worker /admin, /admin/api
                 1. token signature, issuer, audience and expiry are checked against Access's public keys
                 2. the email must be an active row in the `admins` table (role editor or admin)
                 3. every change: same-site check + custom header, size limit, validation, activity log
                 ▼
               D1 (content, settings, admins, activity log)     R2 (uploaded photos)

 GitHub Actions (nightly, on push to main, or "Run workflow")
   tests ► build (+ wrangler config) ► check:deploy ► [D1 migrations ► first admins] ► deploy
```

## What lives where

| What                                       | Where                                                                                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database tables                            | `migrations/0001_init.sql` (how to add a change: `migrations/README.md`)                                                                                                |
| Server code (no extra libraries)           | `src/server/`: `auth.ts` (sign-in), `db.ts` + `sql.ts` (database), `admin-api.ts` (dashboard API), `media.ts` (photos), `public-data.ts` (what pages read), `routes.ts` |
| Field rules shared with the Sheet pipeline | `scripts/lib/validate.mjs` (links, linkedin.com only for alumni, email, phone, lists, photos, settings keys)                                                            |
| What each section edits                    | `src/shared/entities.ts`                                                                                                                                                |
| Dashboard screens                          | `src/routes/admin*.tsx`, `src/components/admin/`                                                                                                                        |
| Final Cloudflare config                    | `scripts/render-wrangler.mjs` (adds D1/R2/Access only when `D1_DATABASE_ID` is set)                                                                                     |
| Deploy guard                               | `scripts/check-deploy.mjs`                                                                                                                                              |
| First admins                               | `scripts/bootstrap-admins.mjs` (only while the admin list is empty)                                                                                                     |
| One-time Sheet → D1 copy                   | `scripts/import-sheet-to-d1.mjs` (writes a SQL file; no network)                                                                                                        |
| Tests                                      | `scripts/tests/admin-*.test.mjs`, `d1-tools.test.mjs` (Node's built-in SQLite stands in for D1)                                                                         |

## Security model

- **Two locks on the door.** Cloudflare Access lets only the emails in its policy reach `/admin` at all. The Worker
  then checks the Access token itself (RS256 signature with Access's published keys, issuer, audience tag, expiry), and
  requires the email to be an active admin in the database. If anything is missing or wrong (no token, Access not
  configured, unknown email, deactivated account), the answer is "no".
- **Roles.** `editor`: edit, hide, reorder and delete content (alumni only hidden, not deleted). `admin`: also manage
  the admin list and delete alumni permanently. The last active admin cannot be removed or demoted.
- **Changes** must be JSON, come from the site itself (`Origin` check), carry the `X-MESAC-Admin` header, and stay under
  32 KB (64 KB for achievements). Every field is validated with the same rules as the Sheet. All SQL is prepared
  statements; no request text is ever pasted into SQL.
- **Alumni consent** is enforced three times: the form will not show someone without the consent box, the server
  refuses it, and the database itself has a rule (`CHECK (visible = 0 OR consent = 1)`). Withdrawing consent hides the
  person. Public pages read only rows that are visible and consented.
- **Activity log.** Who changed what and when, with field _names_ only. Team, achievements, placements and settings
  also get a short label (their content is public anyway); alumni and admin entries never do, so no alumni name,
  email or phone is ever written to the log.
- **Photos.** The browser shrinks them (max 600 px WebP). The server accepts only JPEG, PNG or WebP, checked from the
  file's first bytes, at most 300 KB, under a random 128-bit name. They are served with `nosniff` and a sandboxing
  content policy. A photo is deleted when the last row using it is deleted or changed.
- **Headers.** Everything under `/admin` is `no-store`, `noindex` and cannot be framed. `robots.txt` disallows `/admin`.
- **Local development** has a sign-in shortcut (`ADMIN_DEV_EMAIL`) that works only in a special build (`dev:admin`,
  output in `.output-dev`) and only on `localhost`. Normal builds remove it completely. A test proves this, and the
  deploy check refuses any build that contains it.
- **Secrets** live only in GitHub secrets. The workflow passes them as environment variables, never inside shell
  commands, and the bootstrap script validates every email and prints counts only.

## When the database has a problem

Pages keep showing the last data they read (cached per Worker for 60 seconds). If there is none, the visitor sees the
error page. The site never falls back to the sample data. The archive is unaffected.

## Free-tier limits (at the time of writing; check Cloudflare's pricing pages)

| Service             | Free allowance                                                                   | MESAC's likely use                             |
| ------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------- |
| Workers             | 100,000 requests/day, 10 ms CPU per request                                      | Far below                                      |
| D1                  | 5 GB storage, 5 million rows read/day, 100,000 rows written/day                  | A few thousand rows; reads are cached for 60 s |
| R2                  | 10 GB storage, 1 million writes and 10 million reads per month, no download fees | Photos are ~20–60 KB each                      |
| Access (Zero Trust) | Up to 50 users                                                                   | A handful of committee members                 |
| D1 Time Travel      | Restore to any minute in the last 7 days (free plan)                             | Backups (see the owner guide)                  |

Cloudflare may ask for a payment method before switching on R2 or Zero Trust, even on the free allowance.
