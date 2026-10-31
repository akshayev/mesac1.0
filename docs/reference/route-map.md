# Route Map

VERIFIED from `src/routeTree.gen.ts` and `src/routes/` on 2026-11-01. 33 routes. All content is mock data until the backend exists.

## Public routes

| URL | File | Purpose | Notes |
|---|---|---|---|
| `/` | `index.tsx` | Home: hero, stats, featured events, team preview | In navbar |
| `/events` | `events.tsx` | Events, search, tag filter, detail modal | In navbar |
| `/academy` | `academy.tsx` | Skill tracks, enrollment form, GPA/CGPA calculator | In navbar. Form submits nothing |
| `/archive` | `archive.tsx` | Academic archive browse, filters, search | In navbar. Prefix match keeps nav highlighted on detail pages |
| `/archive/$documentId` | `archive_.$documentId.tsx` | Single document page: metadata, preview, download, report a problem | Dynamic route |
| `/mechanical-dept` | `mechanical-dept.tsx` | Department, HOD, faculty, programs, labs | In navbar |
| `/placements` | `placements.tsx` | Placements by batch | In navbar |
| `/achievements` | `achievements.tsx` | Competition results with detail modal | In navbar |
| `/gallery` | `gallery.tsx` | Albums, lightbox | In navbar |
| `/alumni` | `alumni.tsx` | Alumni registration prototype | In navbar |
| `/about-mesac` | `about-mesac.tsx` | History and objectives | In navbar. Has a submenu |
| `/about-mesac/team` | `about-mesac_.team.tsx` | Team page under About | The `_` in the filename makes it a non-nested sibling route. See `src/routes/README.md` |
| `/team` | `team.tsx` | Current committee and academic-year archive | Linked from page CTAs. Overlap with `/about-mesac/team` is UNVERIFIED; check before consolidating |
| `/about` | `about.tsx` | Mission/objectives style page | Overlap with `/about-mesac` is UNVERIFIED |
| `/contact` | `contact.tsx` | Contact details, map link, message form | Form stores nothing yet |
| `/privacy` | `privacy.tsx` | Privacy notice | Must be updated when the backend ships |

## Redirect routes (keep)

| URL | Redirects to | Why |
|---|---|---|
| `/downloads` | `/archive` | Old Downloads section was replaced by the Archive |
| `/galery` | `/gallery` | Old misspelling still linked |

## Admin routes (`/admin/*`)

All use `AdminLayout`. No real authentication yet. See [admin-dashboard.md](admin-dashboard.md).

| URL | Sidebar label |
|---|---|
| `/admin/login` | (sign-in screen) |
| `/admin/` | Dashboard |
| `/admin/archive` | Academic Archive |
| `/admin/events` | Events & Workshops |
| `/admin/gallery` | Gallery & Media |
| `/admin/home` | Home Page Content |
| `/admin/team` | Committee & Team |
| `/admin/department` | Department & Faculty |
| `/admin/achievements` | Achievements |
| `/admin/placements` | Placements |
| `/admin/academy` | Academy Tracks |
| `/admin/inbox` | Inbox & Reports |
| `/admin/activity` | Activity Log |
| `/admin/backups` | Backups & Exports |
| `/admin/admins` | Approved Admins |
| `/admin/settings` | Site Settings |

## Error handling

- Unknown URL: 404 component in `src/routes/__root.tsx`.
- Render error: root error boundary.
- Server error: `src/start.ts` middleware returns a static HTML 500 page.

## Conventions for adding a route

1. Create the file in `src/routes/` (see `src/routes/README.md`).
2. Start dev server; `src/routeTree.gen.ts` regenerates. Do not hand-edit it.
3. Wrap the page in `Layout` (public) or `AdminLayout` (admin).
4. Give it a `head()` with a title and description.
5. Add it to this table and to the navbar if public.
