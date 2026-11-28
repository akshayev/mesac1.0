# MESAC website: owners, start here

This is the one document the site's **owners** need: the people who hold the Google, Cloudflare and GitHub accounts.
Read it top to bottom the first time. Each part builds on the one before; Parts B to D are optional.

- Day-to-day editing (question papers in Drive, Sheet columns, photos): [HANDOVER.md](../HANDOVER.md).
- How the code works and why it is safe (technical): [ADMIN-ARCHITECTURE.md](ADMIN-ARCHITECTURE.md).

No passwords, keys or personal data belong in this repository or in this document. They go into the places named
below (GitHub secrets, Cloudflare), nowhere else.

---

## 1. What the site is, and who does what

The MESAC website is the public site of the Mechanical Engineering Students' Association, CUSAT. Its main feature is the
**question-paper archive**. It also shows the team, achievements, placements and **Alumni Connect**.

| Who                                | Does what                                                                                                           | Needs                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Students / committee** (content) | Add question papers to Google Drive; edit the Google Sheet, or the admin dashboard once it is on                    | Access to the Drive folder and the Sheet; a dashboard account |
| **Owners** (accounts)              | Hold the Google, Cloudflare and GitHub accounts; set secrets; switch features on and off; rotate keys; run restores | This document                                                 |
| **GitHub Actions** (automatic)     | Rebuilds and publishes the site every night and after every change to `main`; backs up the database weekly          | Nothing, once set up                                          |

The site has three levels. Each one is switched on only by settings, never by changing code:

1. **Part A, Sheet mode:** content comes from a Google Sheet. This is the simplest setup and the base for everything else.
2. **Part B, dashboard:** committee members edit content at `/admin` instead of the Sheet.
3. **Part C, alumni form:** alumni can add themselves at `/alumni/join`; entries wait for approval in the dashboard.

Words in **bold** or `code` are explained in the glossary (Part F).

---

## Part A: launch with the Sheet (no database)

### A1. Google Drive (question papers)

1. Use the MESAC Google account. The archive folder is "Mesac-Academics".
2. Share it as **Anyone with the link: Viewer**, otherwise the site cannot read it. Never share it as "Editor".
3. Folder layout, file names and what is hidden on purpose are in HANDOVER.md section 2.
4. Copy the folder id: the last part of the folder's address (`.../folders/<this part>`). This is `DRIVE_ROOT_ID`.

### A2. Google API key (lets the build read the Drive folder)

1. [Google Cloud Console](https://console.cloud.google.com), signed in with the MESAC account → create a project
   ("mesac-website").
2. **APIs & Services → Library → Google Drive API → Enable**.
3. **Credentials → Create credentials → API key**. Then **Edit key → API restrictions → Restrict key → Google Drive
   API** only. Save. This is `GOOGLE_API_KEY`.

### A3. Google Sheet (team, achievements, placements, alumni, settings)

1. One Sheet with five tabs: `team`, `achievements`, `placements`, `alumni`, `settings`. The first row of each tab holds
   the column names exactly as listed in HANDOVER.md section 3 (lowercase, underscores).
2. Delete every row that starts with `SAMPLE`, then fill in real rows. Alumni rows need the person's written consent
   (keep that record outside this repository).
3. For **each** tab: **File → Share → Publish to web → choose the tab → Comma-separated values (.csv) → Publish**. Copy
   each address. They become `SHEET_TEAM_CSV`, `SHEET_ACHIEVEMENTS_CSV`, `SHEET_PLACEMENTS_CSV`, `SHEET_ALUMNI_CSV` and
   `SHEET_SETTINGS_CSV`.
4. Warning: a published tab shows **every** row and column to anyone with the link, including hidden rows. Never type
   personal details before you have consent.

### A4. "Report a problem" form (optional)

1. Create a Google Form with a short-answer question "File" and a paragraph question "What is wrong?".
2. **Send → link** gives the form address (`…/viewform`): `VITE_REPORT_FORM_URL`.
3. In the form: **⋮ → Get pre-filled link**, type `abc` in "File", get the link; the part `entry.123456789` is
   `VITE_REPORT_FORM_FILE_ENTRY`.
4. Without a form, the button opens an email to the contact address instead.

### A5. Cloudflare account and token

1. Create (or use) the MESAC Cloudflare account. The free plan is enough.
2. **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template → Continue → Create**. This is
   `CLOUDFLARE_API_TOKEN`. (Part B adds two permissions to it.)
3. **Workers & Pages** → the **Account ID** on the right: `CLOUDFLARE_ACCOUNT_ID`.

### A6. GitHub secrets

GitHub → the repository → **Settings → Secrets and variables → Actions → New repository secret**. Add the 12 Part A
secrets from the reference table at the end of this document. For the first run, set `SITE_URL` to a temporary value such as
`https://mesac-cusat.workers.dev`; step A7 tells you the real one.

### A7. First run

1. Merge the code into `main` (pull request → Merge).
2. **Actions → Build and deploy → Run workflow** (branch `main`).
3. When it is green, open the step **Deploy to Cloudflare**: it prints the address
   `https://mesac-cusat.<your-subdomain>.workers.dev`. Set `SITE_URL` to it (or to your custom domain later) and run
   the workflow again.
4. If it is red, the failing step says why. Common causes are in Part F.

### A8. Check it works

- [ ] Home, team, alumni and placements pages show your real data (no "SAMPLE").
- [ ] A question paper preview and download work on a phone.
- [ ] "Report a problem" opens your form (or an email).
- [ ] `/sitemap.xml` lists your real address.
- [ ] The run's **data-reports** artifact: both reports say `"source": "drive"` and `"source": "sheet"`.

---

## Part B: turn on the dashboard

The dashboard lets committee members edit content at `/admin` from a phone. Question papers stay in Drive. Do Part A
first. Use exactly these names:

| Thing                   | Name          |
| ----------------------- | ------------- |
| D1 database             | `mesac-admin` |
| R2 bucket               | `mesac-media` |
| Access application      | `MESAC admin` |
| Worker (made by Part A) | `mesac-cusat` |

### B1. A custom domain on Cloudflare

Cloudflare **Access** (the login) protects a path such as `/admin` only on a domain added to your Cloudflare account.

1. Add the domain to Cloudflare (Websites → Add a domain) and follow its steps.
2. Workers & Pages → `mesac-cusat` → **Settings → Domains & Routes → Add** → your domain. Update `SITE_URL`.

On the `…workers.dev` address alone, the dashboard stays **closed**: every request is refused, so nothing is exposed,
but nobody can use it. Public pages work either way.

### B2. Database (D1)

1. Cloudflare → **Storage & Databases → D1 SQL Database → Create** → name `mesac-admin`.
2. Copy the **Database ID** (looks like `3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e`): `D1_DATABASE_ID`.

You do not create tables; the deploy does.

### B3. Photo storage (R2), optional

R2 is optional, and Cloudflare may ask for a payment method to enable it even inside the free allowance. Without it the
dashboard still works, and photos are added by pasting an https:// or Google Drive image link.

1. Cloudflare → **R2 Object Storage** → **Create bucket** → `mesac-media`. Do not make it public.
2. The bucket name is `R2_BUCKET_NAME`.

### B4. Login (Cloudflare Access)

1. Cloudflare → **Zero Trust**. The first time, choose a team name (for example `mesac`) and the **Free** plan.
2. **Settings → Authentication → Login methods**: **One-time PIN** on. (People sign in with a code sent by email.)
3. **Access → Applications → Add an application → Self-hosted**: name `MESAC admin`, session 24 hours, domain = your
   custom domain with **path** `admin`.
4. Policy: name `MESAC admins`, action **Allow**, include **Emails**: the committee emails that may use the dashboard.
5. **Team domain** (`CF_ACCESS_TEAM_DOMAIN`): Zero Trust → Settings → Custom Pages (or General), e.g.
   `mesac.cloudflareaccess.com`.
6. **AUD tag** (`CF_ACCESS_AUD`): Access → Applications → `MESAC admin` → Configure → Overview → "Application Audience
   (AUD) Tag" (64 characters).

### B5. Token permissions

Cloudflare → My Profile → API Tokens → your token → **Edit**: add **Account → D1 → Edit** and **Account → Workers R2
Storage → Edit**.

### B6. Secrets for the dashboard

Add `D1_DATABASE_ID`, `R2_BUCKET_NAME` (if you did B3), `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, and
`ADMIN_BOOTSTRAP_EMAILS` (your email; two are allowed, separated by commas). The Sheet secrets may stay; in dashboard
mode the deploy no longer fails on Sheet problems.

### B7. First deploy and first admin

1. Run **Build and deploy**. New steps: **Apply database migrations** (creates the tables) and **Add the first admins
   (only while the admin list is empty)**.
2. When it is green, **delete `ADMIN_BOOTSTRAP_EMAILS`**. It never adds anyone again once an admin exists, but there is no
   reason to keep it.
3. Open `https://<your domain>/admin`, enter your email and the code. You should see your email and the role `admin`.

### B8. Copy the Sheet data in, once

Running this twice creates duplicates. It needs a computer with this repository and Node.js; ask a technical member if
needed.

1. Put the five real `SHEET_*_CSV` links in `.env` and run `npm run data:sheet`.
2. `node scripts/import-sheet-to-d1.mjs` writes `.wrangler/import/sheet-import.d1-import.sql`. Alumni without consent
   are skipped.
3. `npx wrangler login` (as the MESAC Cloudflare account), then
   `npx wrangler d1 execute mesac-admin --remote --file .wrangler/import/sheet-import.d1-import.sql`.
4. Delete the SQL file (personal data). Run `git checkout src/data/generated data` so nothing real is committed.

From now on **edit in the dashboard**: public pages read the database, and Sheet edits no longer appear.

### B9. Check it works

- [ ] `/admin` asks for the code; an email not in the policy cannot get in.
- [ ] Add a test team member with a photo, see it on `/team` within a minute, then delete it.
- [ ] An alumnus cannot be shown without the consent box.
- [ ] Settings → change the footer line, check the site, change it back. Activity lists the changes.
- [ ] `/robots.txt` contains `Disallow: /admin`.

### B10. Adding or removing an admin

An email needs **both**: the Access policy (B4 step 4) **and** the dashboard's **Admins** screen (role `editor` or
`admin`). Editors edit content; admins also manage admins, delete alumni permanently and clean unused photos. To remove
someone, deactivate them in Admins (immediate), then remove them from the policy. The last active admin cannot be removed.

### B11. Going back to Sheet mode

Delete `D1_DATABASE_ID` and run the workflow. The site reads the Sheet again and `/admin` becomes "page not found". The
database is kept. The Sheet secrets must work again, and **dashboard edits are not in the Sheet**: copy them over
first. To switch back, add the secret again.

---

## Part C: turn on the alumni form

Alumni add themselves at `/alumni/join`. Nothing is public until an editor or admin approves it. Needs Part B.

1. Cloudflare → **Turnstile → Add widget**: name `MESAC alumni form`, hostname your domain, mode **Managed**,
   pre-clearance **No**. Copy the **Site Key** and **Secret Key**. Turnstile is free.
2. Make a salt: `openssl rand -hex 32` (or a 40-character random password). Keep it private.
3. GitHub → Settings → Secrets and variables → Actions:
   - **Variables** tab → `TURNSTILE_SITE_KEY` = the Site Key (public: it appears in the page);
   - **Secrets** tab → `TURNSTILE_SECRET_KEY` = the Secret Key, and `SUBMISSION_SALT` = the salt.
4. Run the workflow. **Check which optional features are configured** stops the run with a plain message if one of
   the three is missing or wrong. **Give the Worker its optional secrets** stores the secrets on the Worker.
5. `/alumni` now shows "Join Alumni Connect".

**Reviewing:** Dashboard → **Submissions**. You can fix typos or add a photo (**Edit first**), choose whether to show the
person at once, then **Approve**. Or **Reject**, which erases the details immediately. Entries waiting more than 30 days
are deleted. Approval keeps a small consent record: when they agreed, to which wording, and who approved it.

**Limits:** a few entries per visitor per day and at most 50 waiting. People then see "try again tomorrow".

**Removal requests** arrive by email (`/alumni/remove` explains how). Hide or delete the person within 48 hours.

**Switching off:** delete the `TURNSTILE_SITE_KEY` variable and run the workflow; `/alumni/join` becomes "page not
found". To remove the Worker's copies of the secrets: Workers & Pages → `mesac-cusat` → Settings → Variables and Secrets.

---

## Part D: backups, restores and the papers button

### D1. Weekly backups (automatic once Part B is on)

The workflow **Back up the admin database** runs every Sunday at 21:00 UTC (and on demand: Actions → that workflow →
Run workflow). It exports the database, compresses and **encrypts** it, and keeps it as an artifact for **30 days**.

1. Choose a long passphrase (at least 20 characters; a sentence is fine). Store it in the committee's password manager.
   **Without it, backups cannot be opened.**
2. Add it as the secret `BACKUP_PASSPHRASE`.
3. Run the workflow once by hand and check it is green. Its summary shows the file size and rows per table.

The file is encrypted because artifacts of a public repository can be downloaded by any signed-in GitHub user.
**Photos in R2 are not part of this backup.** Keep originals of important photos elsewhere.

### D2. Restoring (first choice: Time Travel)

Cloudflare keeps a minute-by-minute history of the database for **7 days**. This is the fastest fix for a recent
mistake:

1. Note a time just **before** the mistake, in UTC, e.g. `2026-12-01T10:00:00Z`.
2. `npx wrangler login`, then `npx wrangler d1 time-travel restore mesac-admin --timestamp=2026-12-01T10:00:00Z`.
3. The whole database goes back to that moment (later changes are lost). The site shows it within a minute.

### D3. Restoring from a backup file (older than 7 days, or a lost database)

Always restore into a **new** database first, so the current one stays untouched until you are sure.

1. Actions → **Back up the admin database** → a green run → **Artifacts** → download and unzip. You get
   `mesac-admin-<date>.sql.gz.enc`.
2. On a computer with this repository: `read -s BACKUP_PASSPHRASE && export BACKUP_PASSPHRASE` (type it; nothing
   shows), then `node scripts/decrypt-backup.mjs mesac-admin-<date>.sql.gz.enc`. You get `mesac-admin-<date>.sql`.
   (Without Node: `openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -in <file>.sql.gz.enc -out <file>.sql.gz -pass env:BACKUP_PASSPHRASE`, then `gunzip <file>.sql.gz`.)
3. `npx wrangler d1 create mesac-admin-restore` and note its Database ID.
4. `npx wrangler d1 execute mesac-admin-restore --remote --file mesac-admin-<date>.sql`
5. Check the counts match the backup run's summary, for example
   `npx wrangler d1 execute mesac-admin-restore --remote --command "SELECT COUNT(*) FROM alumni"`.
6. Set `D1_DATABASE_ID` to the new id and run **Build and deploy**. Check the site and the dashboard.
7. Delete the `.sql` file (personal data). Keep the old database a few days, then delete it in Cloudflare.

### D4. "Refresh papers now" button (optional)

After adding papers to Drive, editors can rebuild the site from the dashboard (Settings) instead of waiting for the
night run. Without the token below, the dashboard shows a "Run workflow" link to GitHub instead.

1. GitHub → your profile picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token**:
   - name `MESAC papers refresh`, expiration **90 days**;
   - resource owner: the account or organisation that owns the repository;
   - repository access: **Only select repositories** → this one;
   - permissions: **Repository permissions → Actions → Read and write** (nothing else).
2. Add it as the secret `PAPERS_REFRESH_TOKEN`. GitHub does not allow secret names starting with `GITHUB_`; the workflow
   hands it to the Worker as `GITHUB_DISPATCH_TOKEN` and fills `GITHUB_REPO` and `GITHUB_WORKFLOW_FILE` by itself.
3. Run the workflow. Settings now shows **Refresh papers now** (at most once every 5 minutes).
4. Every 90 days: make a new token, replace the secret, run the workflow. An expired token shows "GitHub did not accept
   the saved token".

### D5. Unused photos

Admins: Settings → **Unused photos → Check for unused photos**. It counts uploaded photos that no entry uses (for example
from a cancelled form), keeps anything from the last 24 hours, and deletes after you confirm.

---

## Part E: yearly handover and regular checks

### E1. When the committee changes

- [ ] Add the new members in the dashboard (Admins) **and** in the Access policy (B10). Remove those who left.
- [ ] Hand over the owner accounts (Google, Cloudflare, GitHub). Add the new owners as members; remove the old ones.
- [ ] Hand over the password-manager entry with `BACKUP_PASSPHRASE`.
- [ ] Keep the list of owners and their contact details in the committee's **private** Drive folder, not in this public
      repository.

### E2. Rotating keys (yearly, or at once if one was shared)

| What                   | How                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_API_KEY`       | Google Cloud → Credentials → create a new key restricted to the Drive API → update the secret → run the workflow → delete the old key |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → API Tokens → **Roll** (or create a new one with the same permissions) → update the secret → run the workflow             |
| `PAPERS_REFRESH_TOKEN` | Every 90 days anyway (D4)                                                                                                             |
| `TURNSTILE_SECRET_KEY` | Turnstile → the widget → Rotate secret key → update the secret → run the workflow                                                     |
| `SUBMISSION_SALT`      | Any time; it only resets the "per visitor per day" counts                                                                             |
| `BACKUP_PASSPHRASE`    | Change the secret; keep the **old** passphrase for 30 days, until the last old backup expires                                         |

### E3. Every semester

- [ ] Actions: **Build and deploy** ran green last night; **Back up the admin database** ran green on Sunday.
- [ ] Download one backup and decrypt it once (D3 steps 1–2) to prove the passphrase works. Then delete the files.
- [ ] Scheduled runs are still on: GitHub pauses them after 60 days without activity (Actions → the workflow → Enable).
- [ ] Admins list and Access policy match the current committee.
- [ ] The `PAPERS_REFRESH_TOKEN` is not about to expire.
- [ ] Dashboard: Submissions queue reviewed; Settings → Unused photos cleaned.
- [ ] A removal request test: `/alumni/remove` shows the right contact email.

---

## Part F: troubleshooting and glossary

### F1. Troubleshooting

| What you see                                                     | Likely cause                                                     | Fix                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Workflow fails: "… is not set"                                   | A required secret is missing                                     | Add it (reference table)                                                                            |
| Workflow fails: "source": "fixture" / sample data                | A Drive or Sheet secret is missing or wrong                      | Check `GOOGLE_API_KEY`, `DRIVE_ROOT_ID`, the `SHEET_*_CSV` links                                    |
| Workflow fails: "less than half"                                 | Many files or rows disappeared                                   | If on purpose: Run workflow with **allow_shrink** ticked; otherwise check the Drive sharing / Sheet |
| Workflow fails at "Check which optional features are configured" | A feature is only partly set up, or a test key is used           | Read the message; set all values of that feature, or none                                           |
| "render-wrangler: D1_DATABASE_ID is not a D1 database id"        | Typo in the secret                                               | Paste the Database ID again                                                                         |
| "refusing to deploy the dashboard without Access settings"       | `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` missing                | B4                                                                                                  |
| "Apply database migrations" fails with a permission error        | Token lacks D1 permission                                        | B5                                                                                                  |
| `/admin` is "page not found"                                     | `D1_DATABASE_ID` not set, or not deployed since                  | Set it, run the workflow                                                                            |
| "Not signed in" / "Sign-in could not be verified"                | Not behind Access (workers.dev), or AUD from another application | Use the custom domain; copy the AUD of `MESAC admin`                                                |
| "This email is not on the admin list"                            | Access let them in, the dashboard does not know them             | Add them in Admins                                                                                  |
| "Photo storage (R2) is not set up"                               | `R2_BUCKET_NAME` not set                                         | B3, or use photo links                                                                              |
| People see "The spam check did not pass"                         | Turnstile hostname or secret wrong                               | Check the widget's hostnames and `TURNSTILE_SECRET_KEY`                                             |
| "GitHub did not accept the saved token"                          | `PAPERS_REFRESH_TOKEN` expired or revoked                        | D4 step 4                                                                                           |
| Backup run fails: "BACKUP_PASSPHRASE is not set"                 | Secret missing or shorter than 20 characters                     | D1                                                                                                  |
| A change does not show on the site                               | Pages are cached for up to a minute; Sheet edits need a rebuild  | Wait, or run the workflow                                                                           |

### F2. Glossary

| Word            | Meaning                                                                                |
| --------------- | -------------------------------------------------------------------------------------- |
| **Worker**      | The program that runs the website on Cloudflare (`mesac-cusat`)                        |
| **D1**          | Cloudflare's database; holds the dashboard's content (`mesac-admin`)                   |
| **R2**          | Cloudflare's file storage; holds uploaded photos (`mesac-media`)                       |
| **Access**      | Cloudflare's login screen in front of `/admin` (one-time code by email)                |
| **AUD tag**     | The code that identifies the `MESAC admin` Access application                          |
| **Team domain** | Your Access address, `<team>.cloudflareaccess.com`                                     |
| **Turnstile**   | Cloudflare's free spam check on the alumni form                                        |
| **Secret**      | A private value stored in GitHub (or Cloudflare); never visible after saving           |
| **Variable**    | A non-secret setting stored in GitHub                                                  |
| **Workflow**    | An automatic job on GitHub (Actions): "Build and deploy", "Back up the admin database" |
| **Artifact**    | A file a workflow run keeps for a while (reports, encrypted backups)                   |
| **Migration**   | A file in `migrations/` that changes the database; applied automatically on deploy     |
| **Sample data** | The `SAMPLE …` rows shipped with the code; the deploy refuses to publish them          |
| **Time Travel** | Cloudflare's 7-day undo for D1                                                         |

---

## Reference: every secret and variable

Names must be typed exactly. "Worker (automatic)" means the workflow sets it on the Worker; you do not create it.

| Name                          | Kind               | Where it comes from                | Needed for                                    |
| ----------------------------- | ------------------ | ---------------------------------- | --------------------------------------------- |
| `GOOGLE_API_KEY`              | GitHub secret      | A2                                 | Part A (required)                             |
| `DRIVE_ROOT_ID`               | GitHub secret      | A1                                 | Part A (required)                             |
| `SHEET_TEAM_CSV`              | GitHub secret      | A3                                 | Part A (required; optional in dashboard mode) |
| `SHEET_ACHIEVEMENTS_CSV`      | GitHub secret      | A3                                 | Part A (as above)                             |
| `SHEET_PLACEMENTS_CSV`        | GitHub secret      | A3                                 | Part A (as above)                             |
| `SHEET_ALUMNI_CSV`            | GitHub secret      | A3                                 | Part A (as above)                             |
| `SHEET_SETTINGS_CSV`          | GitHub secret      | A3                                 | Part A (as above)                             |
| `VITE_REPORT_FORM_URL`        | GitHub secret      | A4                                 | Part A (required name; may be empty)          |
| `VITE_REPORT_FORM_FILE_ENTRY` | GitHub secret      | A4                                 | Part A (required name; may be empty)          |
| `SITE_URL`                    | GitHub secret      | A7                                 | Part A (required)                             |
| `CLOUDFLARE_API_TOKEN`        | GitHub secret      | A5, B5                             | Part A (required)                             |
| `CLOUDFLARE_ACCOUNT_ID`       | GitHub secret      | A5                                 | Part A (required)                             |
| `D1_DATABASE_ID`              | GitHub secret      | B2                                 | Part B (switches the dashboard on)            |
| `R2_BUCKET_NAME`              | GitHub secret      | B3                                 | Part B (optional)                             |
| `CF_ACCESS_TEAM_DOMAIN`       | GitHub secret      | B4                                 | Part B                                        |
| `CF_ACCESS_AUD`               | GitHub secret      | B4                                 | Part B                                        |
| `ADMIN_BOOTSTRAP_EMAILS`      | GitHub secret      | B6                                 | Part B (first deploy only; then delete)       |
| `TURNSTILE_SITE_KEY`          | GitHub variable    | C1                                 | Part C                                        |
| `TURNSTILE_SECRET_KEY`        | GitHub secret      | C1                                 | Part C                                        |
| `SUBMISSION_SALT`             | GitHub secret      | C2                                 | Part C                                        |
| `BACKUP_PASSPHRASE`           | GitHub secret      | D1                                 | Part D backups                                |
| `PAPERS_REFRESH_TOKEN`        | GitHub secret      | D4                                 | Part D refresh button (optional)              |
| `GITHUB_DISPATCH_TOKEN`       | Worker (automatic) | copied from `PAPERS_REFRESH_TOKEN` | Part D refresh button                         |
| `GITHUB_REPO`                 | Worker (automatic) | this repository's name             | Part D refresh button / link                  |
| `GITHUB_WORKFLOW_FILE`        | Worker (automatic) | `deploy.yml`                       | Part D refresh button / link                  |

---

## Release checklist (one page)

Before announcing the site:

**Accounts and settings**

- [ ] The 12 Part A secrets exist; the last **Build and deploy** run on `main` is green (no "fixture").
- [ ] `SITE_URL` is the real address; `/sitemap.xml` and share previews use it.
- [ ] Owners are recorded in the committee's private Drive; the backup passphrase is in the password manager.

**Content**

- [ ] No `SAMPLE` rows anywhere (Sheet or dashboard).
- [ ] Confirmed with the department office: Head of Division, the "Patron" on the About page, the Mechanical Dept. text.
- [ ] GPA calculator grade scale checked against current university rules (`src/data/grades.ts`).
- [ ] Subject names marked "to confirm" checked (`src/data/subjects.json`).
- [ ] Photo consent for everyone shown; written consent on file for every alumnus; no contact details without consent.

**If the dashboard is on (Part B–D)**

- [ ] Only the current committee in Admins and in the Access policy; `ADMIN_BOOTSTRAP_EMAILS` deleted.
- [ ] One manual **Back up the admin database** run is green, and its file decrypts.
- [ ] Alumni form (if on): a test submission rejected successfully; `/alumni/remove` shows the right email.

**On a phone**

- [ ] Home, archive preview and download, "report a problem", contact page, alumni page, privacy page.
