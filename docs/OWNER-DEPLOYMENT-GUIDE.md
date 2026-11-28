# Switching on the admin dashboard: owner guide

This guide is for the MESAC committee member who looks after the Cloudflare and GitHub accounts. You do not need to
write code. One step (the one-time copy of the Sheet data, step 9) needs a terminal; ask someone comfortable with one
if needed.

Until you finish this guide, nothing changes: the site keeps reading the Google Sheet and `/admin` is "page not found".

Use exactly these names, so the instructions and error messages match:

| Thing                   | Name          |
| ----------------------- | ------------- |
| D1 database             | `mesac-admin` |
| R2 bucket               | `mesac-media` |
| Access application      | `MESAC admin` |
| Worker (already exists) | `mesac-cusat` |

---

## Before you start: a custom domain

Cloudflare Access protects **paths** such as `/admin` only on a domain that is added to your Cloudflare account (for
example `mesac.example.org`).

- **On a custom domain:** `/admin` asks for an email code and only listed emails get in.
- **On the free `…workers.dev` address only:** the dashboard stays **closed**. Without the Access sign-in, every request to
  the dashboard is refused, so nothing is exposed, but nobody can use it either. **Public pages work either way.**

So: first connect the custom domain (HANDOVER.md section 7, "Custom domain"), then continue.

---

## 1. Create the database (D1)

1. Cloudflare dashboard (the MESAC account) → **Storage & Databases → D1 SQL Database → Create**.
2. Name: `mesac-admin`. Location: automatic. Create.
3. On the database page, copy the **Database ID** (looks like `3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e`).
   This becomes the `D1_DATABASE_ID` secret.

You do not create tables: the deploy does that (it applies the files in `migrations/`).

## 2. Create the photo bucket (R2), optional

1. Cloudflare dashboard → **R2 Object Storage**. Cloudflare may ask you to add a payment method before R2 can be
   switched on, even though MESAC stays inside the free allowance. If the committee cannot do that, **skip this step**:
   photo upload stays off, and photos can still be links.
2. **Create bucket** → name `mesac-media` → location automatic → Create. Do **not** make it public; the site serves the
   photos itself.

## 3. Create the login (Cloudflare Access)

1. Cloudflare dashboard → **Zero Trust**. The first time, pick a **team name** (for example `mesac`) and the **Free**
   plan. (Cloudflare may ask for a payment method here too.)
2. **Settings → Authentication → Login methods**: make sure **One-time PIN** is on.
3. **Access → Applications → Add an application → Self-hosted**.
   - Application name: `MESAC admin`.
   - Session duration: 24 hours.
   - Application domain: your custom domain, **path** `admin`. This covers `/admin` and everything under it,
     including `/admin/api`.
4. Add a **policy**: name `MESAC admins`, action **Allow**, include **Emails** → add each committee email that should
   use the dashboard.
5. Save.

### Where to find the two Access values

- **Team domain** (`CF_ACCESS_TEAM_DOMAIN`): Zero Trust → **Settings → Custom Pages** (or **Settings → General**) shows
  the team domain, e.g. `mesac.cloudflareaccess.com`. Entering just `mesac` also works.
- **Audience (AUD) tag** (`CF_ACCESS_AUD`): Zero Trust → **Access → Applications → MESAC admin → Configure →
  Overview**: "Application Audience (AUD) Tag", a 64-character code.

If the menus have moved, use the dashboard's search box ("team domain", "AUD").

## 4. Let GitHub change the database

The existing `CLOUDFLARE_API_TOKEN` was made from the "Edit Cloudflare Workers" template. It also needs the database
permission:

1. Cloudflare → **My Profile → API Tokens** → the token → **Edit** (or create a new one from the same template).
2. Make sure the permissions include **Account → D1 → Edit** and **Account → Workers R2 Storage → Edit**. Add whichever
   is missing.
3. If you created a new token, update the `CLOUDFLARE_API_TOKEN` secret.

## 5. Add the secrets in GitHub

GitHub → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret                   | Value                                                                        |
| ------------------------ | ---------------------------------------------------------------------------- |
| `D1_DATABASE_ID`         | The Database ID from step 1. **Setting this switches the dashboard on.**     |
| `R2_BUCKET_NAME`         | `mesac-media` (leave unset if you skipped step 2)                            |
| `CF_ACCESS_TEAM_DOMAIN`  | From step 3, e.g. `mesac.cloudflareaccess.com`                               |
| `CF_ACCESS_AUD`          | From step 3, the 64-character AUD tag                                        |
| `ADMIN_BOOTSTRAP_EMAILS` | Your own email (or two, separated by commas). These become the first admins. |

The Sheet secrets can stay. In dashboard mode they are optional: problems with the Sheet no longer stop a deploy.

## 6. First deploy

GitHub → **Actions → Build and deploy → Run workflow** (branch `main`). In the run you will see two extra steps:

- **Apply database migrations**: creates the tables.
- **Add the first admins**: adds the emails from `ADMIN_BOOTSTRAP_EMAILS`, **only if the admin list is empty**.

## 7. Delete the bootstrap secret

After the first green run, **delete `ADMIN_BOOTSTRAP_EMAILS`** in GitHub. It is no longer needed. (It would never re-add
anyone anyway, because it only works while the admin list is empty, but there is no reason to keep personal data in a
secret.)

## 8. Sign in

Open `https://<your domain>/admin`, enter your email, type the code Cloudflare emails you. You should see the
dashboard with your email and the role `admin`.

## 9. One-time copy of the Sheet data (run once only)

Running this twice creates duplicates. It needs a computer with this repository and Node.js.

1. Put the five real `SHEET_*_CSV` links in `.env` (see `.env.example`) and run `npm run data:sheet`. (Or download each
   tab as CSV, File → Download → CSV, into one folder named `team.csv`, `achievements.csv`, `placements.csv`,
   `alumni.csv`, `settings.csv`, and add `--csv <folder>` below.)
2. `node scripts/import-sheet-to-d1.mjs`. This writes `.wrangler/import/sheet-import.d1-import.sql`. Alumni without
   consent are skipped. It prints counts only.
3. `npx wrangler login` (opens the browser; log in to the MESAC Cloudflare account).
4. `npx wrangler d1 execute mesac-admin --remote --file .wrangler/import/sheet-import.d1-import.sql`
5. **Delete that SQL file** (it contains personal data), and run `git checkout src/data/generated data` so the real
   snapshots are not committed.
6. Open the dashboard and the public pages and check the content.

## 10. Verification checklist

- [ ] `/admin` asks for the Access code; an email not in the policy cannot get in.
- [ ] After signing in you see your email and role.
- [ ] Add a test team member with a photo, see it on `/team` within a minute, then delete it.
- [ ] An alumnus cannot be shown without the consent box.
- [ ] Settings → change the footer line, check the site, change it back.
- [ ] Activity shows those changes.
- [ ] `/robots.txt` contains `Disallow: /admin`.
- [ ] Question papers still work (`/archive`).

---

## Adding or removing an admin

An email needs **both**:

1. **Access policy** (Zero Trust → Access → Applications → MESAC admin → Policies → MESAC admins → Emails), and
2. **The dashboard's Admins section** (admins only): add the email with role `editor` or `admin`.

To remove someone, remove them in both places (deactivating in the dashboard is enough to block them at once). The last
active admin cannot be removed; add another admin first.

## Backups and restoring (D1 Time Travel)

D1 keeps a minute-by-minute history (7 days on the free plan). If something was deleted by mistake:

1. Note the time **before** the mistake (UTC), for example `2026-12-01T10:00:00Z`.
2. On a computer with this repository: `npx wrangler login`, then
   `npx wrangler d1 time-travel restore mesac-admin --timestamp=2026-12-01T10:00:00Z`
3. This replaces the **whole** database with that moment (later changes are lost). The site shows it within a minute.

For a copy you keep yourself: `npx wrangler d1 export mesac-admin --remote --output mesac-backup.sql`. It contains
personal data: store it privately, never in this repository.

## Photos nobody uses (orphan files in R2)

If someone uploads a photo and then cancels the form, or replaces a photo before saving, the uploaded file stays in R2
unused. They are small and harmless, but you can clear them:

1. Cloudflare → **D1 → mesac-admin → Console**, run:
   `SELECT photo FROM team_members UNION SELECT image FROM achievements UNION SELECT photo FROM placements UNION SELECT photo FROM alumni;`
   These are the photos in use (paths like `/media/3f2b….webp`).
2. Cloudflare → **R2 → mesac-media → Objects**. Delete any object whose name is **not** in that list. Only delete files
   that are more than a day old (someone may be in the middle of editing).

## Going back to the Sheet

Delete the `D1_DATABASE_ID` secret and run the workflow. The site then reads the Google Sheet again, and `/admin` becomes
"page not found". The database is kept, untouched.

- The Sheet secrets must be set and working again (the deploy fails without them in Sheet mode).
- **Everything edited in the dashboard is not in the Sheet.** Copy any changes into the Sheet first.

To switch the dashboard back on later, add the secret again.

## Common errors

| What you see                                                                               | Why                                                                                               | Fix                                                                                          |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/admin` is "page not found"                                                               | `D1_DATABASE_ID` is not set, or the last deploy was before it was set                             | Set the secret, run the workflow                                                             |
| "Admin sign-in is not configured on this site."                                            | `CF_ACCESS_TEAM_DOMAIN` or `CF_ACCESS_AUD` missing or wrong                                       | Check step 3 values, run the workflow                                                        |
| "Not signed in." or "Sign-in could not be verified."                                       | Not behind Access (e.g. the `workers.dev` address), or the AUD tag belongs to another application | Use the custom domain; copy the AUD from `MESAC admin`                                       |
| "This email is not on the admin list."                                                     | Access let you in, but the dashboard's admin list does not have you                               | Ask an admin to add you; or, if the list is empty, check `ADMIN_BOOTSTRAP_EMAILS` and re-run |
| Workflow: "render-wrangler: D1_DATABASE_ID is not a D1 database id"                        | A typo or placeholder in the secret                                                               | Paste the Database ID again                                                                  |
| Workflow: "refusing to deploy the dashboard without Access settings"                       | D1 is set but the Access secrets are not                                                          | Add `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD`                                              |
| Workflow step "Apply database migrations" fails with an authentication or permission error | The API token lacks D1 permission                                                                 | Step 4                                                                                       |
| Workflow: "ADMIN_BOOTSTRAP_EMAILS: entry 2 is not a valid email address"                   | A typo in the list (the value is never printed)                                                   | Fix the secret: plain emails separated by commas                                             |
| "Photo storage (R2) is not set up on this site yet."                                       | `R2_BUCKET_NAME` not set                                                                          | Step 2 and the secret, or use photo links                                                    |
| "check:deploy: … contains ADMIN_DEV_EMAIL"                                                 | Someone tried to deploy a local development build                                                 | Run a normal `npm run build` (the workflow always does)                                      |
| A change does not show on the site                                                         | Pages are cached for up to a minute                                                               | Wait a minute and reload                                                                     |
