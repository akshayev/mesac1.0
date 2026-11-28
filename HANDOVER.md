# MESAC website: handover guide

For next year's committee. You do not need to be a programmer for most of this. Day-to-day work happens in **Google Drive** (question papers) and **one Google Sheet** (team, achievements, placements, settings). The website rebuilds itself from them every night.

---

## 1. What this site is

- A public website for the Mechanical Engineering Students' Association (MESAC), CUSAT.
- The main feature is the **question paper archive** (`/archive`). The files live in a Google Drive folder; the site lists them, lets people preview and download them.
- Team, achievements, placements, contact details and the home-page numbers come from a **Google Sheet**.
- There are **no accounts, no forms and no database**. Nothing is stored about visitors (see `/privacy`).
- It is built with React + TanStack Start and runs on **Cloudflare Workers** (free plan). A **GitHub Action** rebuilds and publishes it.

Where things are:

| What                                     | Where                                 |
| ---------------------------------------- | ------------------------------------- |
| Question papers                          | Google Drive folder "Mesac-Academics" |
| Team, achievements, placements, settings | The MESAC Google Sheet (4 tabs)       |
| Code                                     | This GitHub repository                |
| Publishing                               | GitHub → Actions → "Build and deploy" |
| Hosting                                  | Cloudflare → Workers → `mesac-cusat`  |

---

## 2. Adding or fixing question papers (Google Drive)

You never edit the website for this. Put the file in the right folder with the right name, then refresh the site (section 5).

### Folder layout

```
Mesac-Academics/
  S1-8/
    S5/                              <- semester folder: S1 ... S8
      PYQ/<Subject>/<YYYY> Scheme/<file>          university question papers
      Internals/<Subject>/<YYYY-YY> Batch/<file>  internal exam papers
      Notes/<Subject>/<YYYY-YY> Batch/<file>      notes
      Syllabus/<YYYY> Scheme/<file>               syllabus
      LAB/<Lab name>/<file>                       lab manuals
    S7/Data Book/<file>                           hidden (see below)
  GATE/
    PYQ/<year>/<file>                             GATE papers
    Study Material/<file>                         hidden (see below)
```

Extra spaces, capital letters and a trailing space in folder names are fine; the site cleans them up. S8 can have scheme folders directly under `PYQ` (no subject folder).

### File names for question papers

```
<Subject> <YYYY> <Month> (<Scheme year> Ad).pdf
Thermal Engineering 2021 Nov (2019 Ad).pdf
```

- `Month` may be short or odd (`Nov`, `Sept`, `Janu`, `June`). "Ad" means _admission year_, so `(2019 Ad)` is shown as **2019 scheme**.
- Internal exam files can have any name ("1st internals qp.pdf"); the title is built from the folder path. A file in a `PYQ` folder whose name contains the word "internal" is treated as an internal paper.

### Subject names

The list of subjects is `src/data/subjects.json` (semester, name, alternative spellings). If a folder name is not recognised, the paper still appears under the cleaned folder name, and the build report lists it. To merge it into the right subject, add the spelling to that subject's `aliases`. Subjects marked `"confirm": true` (Linear Algebra, NSM, CADA) have names that still need confirming.

### Hidden on purpose

Files under `Data Book` and `GATE/Study Material` are **never shown** (copyright is unclear: they are published books). Do not change that unless you have permission. They are kept out of `archive.json`, the sitemap and `public/files`, and the build report only counts them (no names or ids, because the report is uploaded from a public repository). To show one anyway, find its id in Drive and give it `"hide": false` in the overrides file below.

### Fixing one file without renaming it: `src/data/archive-overrides.json`

```json
{
  "<Drive file id>": { "title": "Corrected title", "semester": 5, "hide": false },
  "<another file id>": { "hide": true }
}
```

The Drive file id is the long code in the file's share link. Any field from the file's entry in `src/data/generated/archive.json` can be overridden; `"hide": true` removes a file from the site. Edit it on GitHub (pencil icon), commit to `main`.

### Sharing rules (important)

- The Drive folder must be shared as **"Anyone with the link: Viewer"**. Never give "Editor" to "anyone".
- Only committee members who maintain files should be Editors, by name.
- If a file is owned by a personal account, the build report lists it. Ask the owner to move it into the shared folder so it does not disappear when they leave.

### Download quota

Google limits how often one file can be downloaded. If a visitor sees "too many downloads", the site already tells them to use **Open in Drive → Make a copy**. Small PDFs (under 20 MB) are also copied to the website at build time, so most downloads do not touch Drive at all.

---

## 3. Editing team, achievements, placements and settings (Google Sheet)

The Sheet has **four tabs**. The first row of each tab holds the column names (keep them exactly, in lowercase with underscores).

### Common columns

- **order**: number; lower numbers appear first. Empty is allowed (those go last, alphabetically).
- **visible**: `TRUE` or `FALSE`. `FALSE` hides the row without deleting it. Empty means visible.
- A row with an empty `name` (or `title`) is skipped.

### `team`

`name, role, group, photo, linkedin, email_public, order, visible`

- **group** becomes a heading on the Team page (e.g. `Faculty`, `Core Committee`, `Division Heads`). Groups are listed by their lowest `order`.
- **email_public** is shown on the site. Leave it empty unless the person agrees.
- **Head of Division / faculty:** the old data disagreed about who this is, so no faculty are shown until confirmed. Ask the department office, then add the person here with `group = Faculty`.

### `achievements`

`title, date, category, description, image, link, order, visible`

- **date** can be `2026-03-14`, `14/03/2026` or `14 Mar 2026` (day first). Bad dates are kept but shown without a date.
- **link**: a full `https://...` address (shows a "Read more" button).

### `placements`

`name, company, role, batch, photo, linkedin, order, visible`

There is deliberately **no salary/package column**. Rows without a `company` are skipped.

### `settings`

Two columns, `key` and `value`. An empty value (or a missing key) simply hides that item on the site.

| key                                              | what it does                                                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `hero_title`, `hero_subtitle`                    | Home page headline and sentence under it                                                                             |
| `stat_members`, `stat_papers`, `stat_placements` | The three numbers on the home page. Add `stat_members_label` etc. to rename them                                     |
| `contact_email`                                  | Shown on the Contact page and used for the "report a problem" email                                                  |
| `contact_phone`                                  | The phone number. **Never hard-code a number in the code**; only this key                                            |
| `instagram_url`, `linkedin_url`                  | Social buttons (contact page and footer)                                                                             |
| `report_form_url`, `report_form_file_entry`      | Google Form for reporting wrong files, and the form field that receives the file name (looks like `entry.123456789`) |
| `placement_brochure_url`                         | Adds a "Placement brochure" button on Placements                                                                     |
| `announcement_text`, `announcement_link`         | The banner under the home hero (link can be `/archive` or a full address)                                            |
| `footer_text`                                    | Extra line in the footer                                                                                             |

### Photos

In the `photo` / `image` column use **one** of:

1. A full web address `https://...` to an image.
2. A **Google Drive** share link or file id. The file must be shared "Anyone with the link". The site converts it to a small thumbnail.
3. A file in the website's `public/people/` folder, written as `people/name.webp`.

If a photo is missing or broken, the site shows the person's **initials** instead; it never breaks the page.

**Shrinking photos (option 3):** phone photos are huge (5 MB+). Put the originals in a folder on your computer, then run

```
npm run photos -- path/to/folder
```

It writes small WebP files (max 600 px) to `public/people/` and a list to `data/people-photos.md`. Commit the new files. Only publish photos of people who agreed to it.

### Publishing each tab (once)

For each of the four tabs: **File → Share → Publish to web → choose that tab → "Comma-separated values (.csv)" → Publish**. Copy the address into the matching GitHub secret (section 6).

---

## 4. Running it on your own computer (optional)

```
npm ci
cp .env.example .env     # fill in what you have; everything is optional
npm run dev              # http://localhost:3000
npm run build            # full production build (also runs the data steps)
npm run test:data        # parser, Sheet reader, workflow checks, and the Drive/Sheet code against a mock Google
```

Without any keys the site builds with **sample data** (names like "SAMPLE Student A"). That is fine for development but must never be published; the deploy check (below) refuses it.

---

## 5. Refreshing the live site

The site is rebuilt:

- **every night at 02:00 IST** (20:30 UTC);
- **whenever code is pushed to `main`**;
- **on demand**: GitHub → **Actions** → **Build and deploy** → **Run workflow** (choose branch `main`) → **Run workflow**. This is the "Refresh now" button.

How long until an edit shows up:

| You changed     | Appears after                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Sheet cell    | Google refreshes the published CSV about every **5 minutes**; then it needs a rebuild (a manual run takes a few minutes, or wait for the night run) |
| A file in Drive | Next rebuild                                                                                                                                        |
| Code            | After merging to `main`                                                                                                                             |

### If scheduled runs stop

GitHub **pauses scheduled workflows after 60 days with no activity** in the repository (you get an email). To restart: GitHub → **Actions** → click **Build and deploy** → **Enable workflow**. Or simply run it manually once, or make any small commit; either counts as activity. If nobody touches the repo for two months, check this first.

### Where to look when a build fails

1. **Actions → the failed run → the red step.** The message says what is wrong.
2. Download the **data-reports** artifact at the bottom of the run page (kept 14 days):
   - `drive-report.md`: what was found in Drive: counts, unparsed file names, unknown subjects, how many files are hidden (counts only), files owned by other accounts (emails masked).
   - `sheet-report.md`: which Sheet rows were skipped and why (empty name, bad link, bad date...).
   - `unsorted.csv`: files that could not be placed.
3. Common causes:
   - **"source: fixture"**: a secret is missing or wrong, so sample data was used. The deploy is refused on purpose.
   - **`SITE_URL` not set**: add the secret.
   - **HTTP 403 from Google**: the API key is wrong/expired, the Drive API is not enabled, or the folder is not shared publicly.
   - **"got a web page, not CSV"** or **"empty response"**: that Sheet tab is not published to the web (or the link is wrong).
   - **"is not set"**: one of the `SHEET_*_CSV` or `GOOGLE_API_KEY` secrets is missing.
   - **"the crawl found 0 files"**: `DRIVE_ROOT_ID` is wrong or the folder is no longer shared.
   - **"less than half of the previous …"**: Drive or a Sheet tab suddenly has less than half the entries of the last
     successful run. This is a safety stop against publishing a half-empty site by accident (a moved folder, a deleted
     tab, a filter left on). Fix the data and run again. If you really deleted that much on purpose: Actions → Build and
     deploy → Run workflow → tick **"Allow a large drop in files or Sheet rows"** → Run. (Locally the same switches are
     `ARCHIVE_ALLOW_SHRINK=1` and `SHEET_ALLOW_SHRINK=1`.)
   - **A folder failing with HTTP 500 after several retries**: a temporary Google problem; run the workflow again later.

The safety checks only become strict on the deploy (`DEPLOY=1`, set by the workflow). On your own computer they print
warnings instead, and a failed download never overwrites the previous data.

---

## 6. Secrets: the full list

Create each in GitHub → **Settings → Secrets and variables → Actions → New repository secret**. Never put these in the code or in chat.

| Secret                        | What it is                                                                                              | Where to get it                                                                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_API_KEY`              | Lets the build read the public Drive folder                                                             | Google Cloud Console (log in with the MESAC Google account) → create a project → **APIs & Services → Library → Google Drive API → Enable** → **Credentials → Create credentials → API key**. Then **Restrict key → API restrictions → Google Drive API only** |
| `DRIVE_ROOT_ID`               | Which folder to index                                                                                   | Open the "Mesac-Academics" folder in Drive; the id is the last part of the address (`.../folders/<this part>`)                                                                                                                                                |
| `SHEET_TEAM_CSV`              | Published CSV address of the `team` tab                                                                 | Sheet → Publish to web (section 3)                                                                                                                                                                                                                            |
| `SHEET_ACHIEVEMENTS_CSV`      | same, `achievements` tab                                                                                | same                                                                                                                                                                                                                                                          |
| `SHEET_PLACEMENTS_CSV`        | same, `placements` tab                                                                                  | same                                                                                                                                                                                                                                                          |
| `SHEET_SETTINGS_CSV`          | same, `settings` tab                                                                                    | same                                                                                                                                                                                                                                                          |
| `VITE_REPORT_FORM_URL`        | Google Form for "report a problem" (the `report_form_url` key in the Sheet's settings tab overrides it) | Google Forms → Send → link (`.../viewform`). Leave empty to use an email instead                                                                                                                                                                              |
| `VITE_REPORT_FORM_FILE_ENTRY` | The form field that gets the file name                                                                  | In the form: ⋮ → **Get pre-filled link** → fill that field with `abc` → open the link; the part like `entry.123456789=abc` gives `entry.123456789`                                                                                                            |
| `SITE_URL`                    | The website's public address, no trailing slash                                                         | See "Address of the site" below                                                                                                                                                                                                                               |
| `CLOUDFLARE_API_TOKEN`        | Lets GitHub publish to Cloudflare                                                                       | Cloudflare dashboard → **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template**                                                                                                                                                        |
| `CLOUDFLARE_ACCOUNT_ID`       | Your Cloudflare account                                                                                 | Cloudflare dashboard → **Workers & Pages** → Account ID on the right                                                                                                                                                                                          |

### Address of the site (`SITE_URL`)

Until you have a custom domain, `SITE_URL` is the Worker's **workers.dev address**: `https://mesac-cusat.<your-subdomain>.workers.dev` (shown in the log of the first successful deploy, and in Cloudflare → Workers & Pages → `mesac-cusat`). **When the domain changes, update the `SITE_URL` secret and run the workflow again**, otherwise canonical links, the sitemap and share previews keep pointing at the old address.

### Rotating the API key

(Do this yearly, or at once if the key was ever shared.)

1. Google Cloud Console → Credentials → **Create credentials → API key** (restrict it to the Drive API).
2. Update the `GOOGLE_API_KEY` secret in GitHub.
3. Run the workflow and confirm it is green.
4. Only then **delete the old key** in Google Cloud.

---

## 7. Hosting on Cloudflare (what was chosen)

- **Workers + static assets** on the free plan. Pages are rendered by the Worker; images, fonts, PDFs and scripts are served as static files.
- Build command: `npm run build`. Output folder: `.output` (`.output/server` is the Worker, `.output/public` the static files). Deploy command: `npx wrangler deploy` (the workflow does this).
- Worker name `mesac-cusat`, compatibility date `2026-11-01`, Node compatibility on. All of this is in `wrangler.jsonc`.
- Security headers are in `public/_headers` (static files) and `src/server.ts` (pages). Scripts, styles and fonts are cached for up to a year or a month; photos and PDFs for a week.
- **First deploy:** add the Cloudflare secrets, then run the workflow on `main`. The Worker is created automatically.
- **Custom domain:** Cloudflare dashboard → Workers & Pages → `mesac-cusat` → Settings → **Domains & Routes → Add**. Then update `SITE_URL`.
- The free plan is enough for this site. Limits to keep an eye on (at the time of writing; check Cloudflare's current pricing page): about 100,000 page requests per day, 20,000 static files, 25 MB per file.

---

## 8. Before the first public launch

- [ ] All 11 secrets exist and a run on `main` is green (no "fixture" message).
- [ ] The team Sheet has real rows; **delete every `SAMPLE` row**.
- [ ] Confirm with the department office: **Head of Division**, the "Patron" named on the About page, and the programs/labs text on the Mechanical Dept. page (those texts were carried over from the first prototype and were never verified).
- [ ] Confirm the **grade scale** used by the GPA calculator (`src/data/grades.ts`) against the current university rules.
- [ ] Subject names still marked to confirm (`confirm: true` in `src/data/subjects.json`).
- [ ] Photo consent for everyone shown; no private phone numbers or emails in the Sheet.
- [ ] Open the live site on a phone; try one preview, one download and the "report a problem" link.

---

## 9. Good to know

- The site never shows files from `Data Book` or `GATE/Study Material`.
- The font (Plus Jakarta Sans, SIL Open Font License) is stored in `public/fonts`; nothing is loaded from Google Fonts.
- Deleted content (old events, gallery, alumni, admin pages and the unverified faculty list) is still in the Git history if anyone needs it back.
- The 3D gear on page transitions loads only when someone clicks to another page; that keeps the first load fast.

---

## 10. First deployment checklist

Do these in order. Each step is explained above; nothing here needs code changes.

1. **Drive key** (section 6): in Google Cloud, under the MESAC account, enable the Drive API and create an API key
   restricted to it. Check the "Mesac-Academics" folder is shared "Anyone with the link: Viewer".
2. **Publish the Sheet tabs** (section 3): publish each of `team`, `achievements`, `placements`, `settings` as CSV and copy
   the four links. Delete every `SAMPLE` row and fill in real rows first.
3. **Report form** (optional): create the Google Form, copy its link and the pre-filled field id (`entry.…`).
4. **Cloudflare**: create the API token ("Edit Cloudflare Workers" template) and note the Account ID.
5. **Set the secrets** in GitHub (section 6). For the first run set `SITE_URL` to a temporary value such as
   `https://mesac-cusat.workers.dev`; you will correct it in step 8.
6. **Merge** the work into `main` (GitHub pull request → Merge).
7. **Run the workflow**: Actions → Build and deploy → Run workflow. When it is green, open the "Deploy to Cloudflare"
   step: it prints the site's `https://mesac-cusat.<your-subdomain>.workers.dev` address.
8. **Set the real `SITE_URL`** to that address (or your custom domain) and run the workflow again, so share links,
   canonical URLs and the sitemap are correct.
9. **Verify** on a phone: home, team, a question paper preview and download, the "report a problem" link, the contact
   page. Open `/sitemap.xml` and check the addresses. Download the `data-reports` artifact and read both reports.
10. Tick off the checklist in section 8 (names to confirm, photo consent).
