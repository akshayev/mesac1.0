# Admin Dashboard

Private area at `/admin`. Mobile usable. Plain form-based screens with large buttons and clear save confirmations (REQUIREMENT).

## Current state (VERIFIED)

- 15 screens plus a login screen exist as UI on mock data (`src/data/mock/admin.ts`).
- `src/context/AdminAuthContext.tsx` runs in **`prototype-preview`** mode with a fixture superadmin (`mockAdminUsers[0]`). Anyone can open `/admin`.
- `signInWithGoogle` and `signInWithEmail` return "backend pending" messages. The email path only checks that the address contains `@`.
- `setSimulatedStatus` lets developers preview each guard state (`unauthenticated`, `unauthorized`, and so on).
- Components: `AdminLayout`, `AdminHeader`, `AdminSidebar`, `AdminPageHeader`, `ConfirmDialog`, `IntegrationNotice` in `src/components/admin/`.
- `IntegrationNotice` marks screens that are not yet connected to a real service.

**Security note:** until real authentication exists, never deploy `/admin` to a public URL. Gate it or leave it out of production builds.

## Screens and what each needs from the backend

| Screen | Does | Backend work |
|---|---|---|
| Dashboard | Overview | Counts, recent activity |
| Academic Archive | Upload, edit, replace, delete, bulk tag, health check | `ArchiveServiceContract`; Drive upload; health-check job |
| Events & Workshops | CRUD, registration link, album | `EventsServiceContract` |
| Gallery & Media | Albums tied to events, image upload | R2 upload with resize |
| Home Page Content | Hero text and images, stats, featured events, banner | `home_blocks` table |
| Committee & Team | Members, tiers, "Start new academic year" | `TeamServiceContract.startNewAcademicYear` |
| Department & Faculty | Faculty, HOD, labs, programs | Tables + `show_contact` toggle |
| Achievements | CRUD | Table |
| Placements | CRUD by batch | Table; dedupe at migration |
| Academy Tracks | CRUD | Table |
| Inbox & Reports | Enrollments, contact messages, archive problem reports | `InboxServiceContract`; email notification on new item |
| Activity Log | Who changed what | Written on every admin write |
| Backups & Exports | List backups, trigger export | Scheduled job, one-click export (SQL/CSV/ZIP) |
| Approved Admins | Add/remove admin emails | `admins` table; any admin can manage |
| Site Settings | Name, logo, social, contact, HOD | `site_settings` |

## Authentication target

1. Admin enters an email or chooses Google.
2. Server checks the address against the `admins` table (active only). Unknown addresses get a generic message, no account enumeration.
3. Email path: server emails a one-time code, stores only its hash with an expiry, verifies, then issues a session cookie (HttpOnly, Secure, SameSite).
4. Every `/admin` route and every write endpoint checks the session server-side. Hiding UI is not security.
5. Sign-out clears the session.

Contract: `AuthServiceContract` in `src/types/admin.ts`.

## Open decision

Roles: the types define `superadmin`, `editor`, `moderator`; the requirement says all admins have full access. See [data-model.md](../architecture/data-model.md).

## Handover model

Admins change every academic year. Any admin can add or remove admins, so handover is self-service. Procedure lives in [../operations/handover-guide.md](../operations/handover-guide.md).
