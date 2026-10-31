# Product Requirements Document (PRD)

Source: *MESAC Website: Requirements and Tech Stack Proposal* (Oct 2, 2026) and the repository README. Items are **REQUIREMENT** unless marked otherwise. Build status is in [status-and-roadmap.md](status-and-roadmap.md).

## 1. Purpose and goals

Rebuild the MESAC website as a professional, dashboard-managed site that is meant to live about 15 years and launch within one month of the proposal.

Goals:

1. A fast, mobile-first public site (about 70% of visitors are on phones, 30% on laptops).
2. Every piece of content, including yearly changes, edited by admins from a dashboard. No hardcoded content in production.
3. A public **Academic Archive** of previous-year question papers and syllabi for all CUSAT departments. This is the **launch priority**.
4. Free tiers wherever possible. The domain is already owned. English only.
5. No Lovable dependency. Built and maintained with Claude Code and a normal editor.
6. Longevity: boring, replaceable tools; all data exportable (SQL, CSV, ZIP) so no vendor can trap the site.

## 2. Users

| User | Needs |
|---|---|
| Current and prospective mechanical engineering students | Events, team, placements, academy tracks, GPA calculator, past papers |
| Students from any CUSAT department | Find question papers and syllabi quickly on a phone |
| Alumni | Register their details |
| Faculty and sponsors | Department info, achievements, placements |
| MESAC admins (a few, full access) | Edit all content, read form submissions, manage the archive, hand over each year |

## 3. Public site requirements

Every page must read from the database; nothing hardcoded.

| Page | Requirement |
|---|---|
| Home | Hero, highlighted stats, featured events, about blurb, team preview, announcement banner. All text, images, stats and featured items editable. |
| Events | Upcoming and past events, tag filter, optional registration link. Past events move automatically by date. |
| Gallery | One album per event, lightbox, download. The public "Add Image" is removed. |
| Team | Current committee plus archive by academic year, driven by a "Start new academic year" flow. |
| Achievements | Competition results, editable list. |
| Placements | Students by batch with companies. Names stay public. Duplicates cleaned during migration. |
| Mechanical Dept | About, Head of Division, faculty directory, programs, labs. Head of Division is data, not text. Contact details only if toggled on. |
| Academy | Six skill tracks, enrollment form, GPA calculator. Form saves and emails admins. Tracks editable. Fixed grade scale at launch; CGPA is credit-weighted. |
| Archive | See section 4. Replaces the old Downloads page. |
| About MESAC | History and objectives, editable. |
| Contact | Contact details, map, message form with spam protection. |
| Privacy notice | Plain-language page about collected data. |
| Alumni | Registration form (added in the current frontend, see README 4.13). |
| News / blog | Post-launch. |

Cross-cutting:

- Mobile-first layouts, fast on mid-range phones.
- Real favicon, social sharing image, sitemap, per-page titles and descriptions.
- Honour "reduce motion". Keyboard-usable menus and dialogs, Esc closes.
- Privacy-friendly analytics, no cookie banner.
- Images resized and compressed automatically on upload.

## 4. Academic Archive (launch priority)

- Browse by department, then program (B.Tech, M.Tech, MBA, MCA, M.Sc and others), semester, subject. Filter by scheme or syllabus year. Search by title, subject name, code and tags only (no full-text search at launch).
- Each file page shows title, department, semester, subject, scheme, exam year and month, type (question paper or syllabus).
- In-page preview on demand, a download button always shown. Lists never preload PDFs.
- Fully public and indexable by search engines.
- Heavy-traffic protection: Google Drive can block popular files in exam season, so the most requested files get a cached copy on our own storage, and the page shows a clear message instead of a broken link.
- Every file has a "Report a problem" button (wrong subject, bad scan, broken link). Reports land in the dashboard inbox, protected by the same spam check.
- Storage is hybrid: files stay in the shared Google Drive (about 100 GB, 2,000 to 10,000 files); the site keeps a searchable index.
- Official CUSAT permission exists. The written proof must be stored in the handover guide.

## 5. Admin dashboard requirements

Private area of the same site, fully usable on a phone.

- **Access:** Google sign-in or email one-time code (recommended over passwords). Only emails on an approved admin list can enter. Any admin can add or remove admins. Everyone who gets in has full access.
- **Content areas:** site settings, home page, events, team (with "Start new academic year"), achievements, placements by batch, faculty, labs and programs, Academy tracks, archive manager.
- **Inbox:** enrollment submissions and contact messages, with an email notification to admins on each new one.
- **Privacy:** every person record has a "show contact" toggle, default off.
- **Safety:** activity log (who changed what, when), one-click export of all data and files, automatic scheduled backup to separate storage, handover guide in the repo.
- **Archive manager:** upload with metadata (sent to Drive, index record created in one step), edit/replace/remove, bulk tagging, one-time Drive import script, health-check page listing missing or unshared files, scheduled index export, optional independent copy of the 100 GB.

## 6. Design direction

- Professional and calm. Deep maroon primary, gold only for small accents, neutral off-white and charcoal base.
- One clean, widely supported font pairing, **self-hosted** so it never disappears.
- Gear logo kept as a simple, mostly static mark. Remove heavy animated gear backgrounds.
- Light fade/slide motion only, off for reduced-motion users. No scroll-driven animation libraries.
- Mobile-first single-column flow, larger tap targets, consistent cards.

## 7. Out of scope

- News/blog and announcements archive (post-launch).
- Editable GPA grade scale (post-launch).
- Restore-deleted-items (post-launch).
- Multiple languages (English only).
- Role-based permissions (all admins have full access).

## 8. Constraints

- Free tiers; no paid services without explicit approval.
- One-month launch target from Oct 2, 2026 (status: see roadmap).
- Shared MESAC email account owns the cloud accounts and is handed over yearly.
- Another MESAC member holds the domain registrar login.

## 9. Success criteria

- Admins can change any public content from a phone without a developer.
- A student can find a specific question paper on a phone in under a minute.
- Both forms tested on a real phone including the admin email.
- A backup has been restored successfully at least once.
- A new maintainer can rebuild everything from this repository plus an export.
