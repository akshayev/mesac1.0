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

Files under `Data Book` and `GATE/Study Material` are **never shown** (copyright is unclear: they are published books). Do not change that unless you have permission. To show or hide a single file, use the overrides file below.

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
npm run test:data        # checks the file-name parser and the Sheet reader
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
   - `drive-report.md`: what was found in Drive: counts, unparsed file names, unknown subjects, hidden files, files owned by other accounts.
   - `sheet-report.md`: which Sheet rows were skipped and why (empty name, bad link, bad date...).
   - `unsorted.csv`: files that could not be placed.
3. Common causes:
   - **"source: fixture"**: a secret is missing or wrong, so sample data was used. The deploy is refused on purpose.
   - **`SITE_URL` not set**: add the secret.
   - **HTTP 403 from Google**: the API key is wrong/expired, the Drive API is not enabled, or the folder is not shared publicly.
   - **"got a web page, not CSV"**: that Sheet tab is not published to the web.

---

## 6. Secrets: the full list

Create each in GitHub → **Settings → Secrets and variables → Actions → New repository secret**. Never put these in the code or in chat.

| Secret                        | What it is                                      | Where to get it                                                                                                                                                                                                                                               |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_API_KEY`              | Lets the build read the public Drive folder     | Google Cloud Console (log in with the MESAC Google account) → create a project → **APIs & Services → Library → Google Drive API → Enable** → **Credentials → Create credentials → API key**. Then **Restrict key → API restrictions → Google Drive API only** |
| `DRIVE_ROOT_ID`               | Which folder to index                           | Open the "Mesac-Academics" folder in Drive; the id is the last part of the address (`.../folders/<this part>`)                                                                                                                                                |
| `SHEET_TEAM_CSV`              | Published CSV address of the `team` tab         | Sheet → Publish to web (section 3)                                                                                                                                                                                                                            |
| `SHEET_ACHIEVEMENTS_CSV`      | same, `achievements` tab                        | same                                                                                                                                                                                                                                                          |
| `SHEET_PLACEMENTS_CSV`        | same, `placements` tab                          | same                                                                                                                                                                                                                                                          |
| `SHEET_SETTINGS_CSV`          | same, `settings` tab                            | same                                                                                                                                                                                                                                                          |
| `VITE_REPORT_FORM_URL`        | Google Form for "report a problem"              | Google Forms → Send → link (`.../viewform`). Leave empty to use an email instead                                                                                                                                                                              |
| `VITE_REPORT_FORM_FILE_ENTRY` | The form field that gets the file name          | In the form: ⋮ → **Get pre-filled link** → fill that field with `abc` → open the link; the part like `entry.123456789=abc` gives `entry.123456789`                                                                                                            |
| `SITE_URL`                    | The website's public address, no trailing slash | See "Address of the site" below                                                                                                                                                                                                                               |
| `CLOUDFLARE_API_TOKEN`        | Lets GitHub publish to Cloudflare               | Cloudflare dashboard → **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template**                                                                                                                                                        |
| `CLOUDFLARE_ACCOUNT_ID`       | Your Cloudflare account                         | Cloudflare dashboard → **Workers & Pages** → Account ID on the right                                                                                                                                                                                          |

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
