# Data Model

Two views: what exists **today** as TypeScript types (VERIFIED in `src/types/models.ts` and `src/types/admin.ts`), and the **proposed** database tables (DECISION pending, derived from those types plus the requirements). The proposed schema is a design, not a migration; nothing has been created.

## 1. Entities today

| Entity (type) | Key fields | Mock data file |
|---|---|---|
| `SiteSettings`, `SiteSocialLinks`, `SiteAnnouncement` | name, logo, social links, contact details, announcement banner | `site.ts` |
| `HomePageContent`, `HeroStat` | hero text/images, stats, featured items | `site.ts` |
| `Event` | id, title, slug, tag, date, endDate, location, coordinator, desc, fullDetails, prizePool, images[], isFeatured, status (`upcoming`/`ongoing`/`completed`), registrationUrl, registrationOpen, prerequisites[], agenda[], galleryAlbumId | `events.ts` |
| `GalleryAlbum`, `GalleryImage` | album with category; images belong to albums | `gallery.ts` |
| `TeamMember` | id, name, role, tier (`advisor`/`core`/`lead`/`coordinator`/`member`), academicYear (e.g. `2026-27`), img, dept, email, linkedin, order | `team.ts` |
| `AcademicYear`, `HistoricalOfficer` | archive of past committees | `team.ts` |
| `FacultyMember`, `DepartmentOverview`, `DepartmentProgram`, `Lab` | department directory | `department.ts` |
| `Achievement` | competition results | `achievements.ts` |
| `Placement`, `PlacementBrochure` | students by batch, company | `placements.ts` |
| `AcademyTrack` | six skill tracks | `academy.ts` |
| `CusatGradeInfo` (`S`,`A`,`B`,`C`,`D`,`E`,`F`) | GPA scale | used by `GpaCalculator.tsx` |
| `ArchiveDocument` | id, title, department, program, semester, subject, subjectCode, scheme, examYear, examMonth, type (`question_paper`/`syllabus`/`notes`/`lab_manual`), tags[], driveFileId, preview{}, download{}, createdAt, updatedAt | `archive.ts` |
| `ContactSubmission` | status `new`/`read`/`responded`/`archived` | `admin.ts` |
| `EnrollmentSubmission` | status `pending`/`approved`/`rejected` | `admin.ts` |
| `AdminUser` | id, email, name, role (`superadmin`/`editor`/`moderator`), createdAt, lastLoginAt, isActive | `admin.ts` |
| `AlumniRegistrationFormValues`, `AlumniRecord` | name, graduation year, department, email, phone, optional organization and location | `alumni.ts` |
| `ArchiveProblemReport` | documentId, issueType (7 values), description, reporter, status `pending`/`investigating`/`resolved`/`dismissed` | `admin.ts` |
| `ActivityLogEntry` | actor, action (`create`/`update`/`delete`/`archive`/`export`/`publish`/`status_change`), entityType (12 values), entityId, summary, timestamp, ipAddress, metadata | `admin.ts` |
| `BackupRecord` | type (`full_database`/`archive_metadata`/`gallery_manifest`/`content_json`), size, status, checksum, isAutomatic | `admin.ts` |
| `ArchiveHealthIssue` | severity `error`/`warning`/`ok` | `admin.ts` |

### Inconsistency to resolve

`AdminUserRole` has three roles (`superadmin`, `editor`, `moderator`), but the requirement says **all admins have full access**. Either collapse to one role at implementation time or record a new decision that changes the requirement. Until decided, treat all approved admins as full-access.

## 2. Proposed database tables

Conventions: `id` is a text/UUID primary key; timestamps are ISO-8601 UTC strings (SQLite) or `timestamptz` (Postgres); every content table has `created_at`, `updated_at`; deletes are hard deletes with an activity-log entry (restore-deleted-items is post-launch).

| Table | Purpose | Key columns / notes |
|---|---|---|
| `admins` | Approved admin list | email (unique), name, is_active, created_at, last_login_at. Sign-in is allowed only for emails present and active |
| `sessions` / `login_codes` | Auth state | hashed one-time codes with expiry; session tokens |
| `site_settings` | Single-row settings | name, logo_url, social links, contact details, head_of_division_id |
| `home_blocks` | Hero text/images, stats, featured events, banner | structured JSON per block |
| `events` | Events | slug unique; status derived from dates; `registration_url`; `gallery_album_id` |
| `gallery_albums`, `gallery_images` | Albums tied to events | image URL in R2; sort order |
| `academic_years` | `2026-27` etc., `is_current` | "Start new academic year" flips `is_current` and archives |
| `team_members` | Members per academic year | tier, order, `show_contact` (default false), email, linkedin |
| `faculty` | Directory | `show_contact` default false; HOD flag |
| `programs`, `labs` | Department | |
| `achievements` | Results | |
| `placements` | Students by batch | company, batch year |
| `academy_tracks` | Skill tracks | level, details, links |
| `archive_documents` | The index (2,000 to 10,000 rows) | all `ArchiveDocument` fields; `drive_file_id`, `cached_object_key` nullable (hot-file cache), search index on title, subject, subject_code, tags |
| `archive_reports` | Problem reports | document_id FK, issue_type, status |
| `enrollments` | Academy form submissions | status |
| `contact_messages` | Contact form | status |
| `alumni` | Alumni registrations | unique username (server generated), email unique |
| `activity_log` | Audit trail | actor, action, entity_type, entity_id, summary, ts |
| `backups` | Backup records | type, size, checksum, status |

### Rules the backend must enforce

- Only approved, active admin emails can read/write admin data.
- Contact fields (phone, personal email) of any person are never returned by public endpoints unless `show_contact = true`.
- Every admin write also writes an `activity_log` row.
- Alumni usernames are unique, generated server-side (the frontend's temporary username is not guaranteed unique).
- Public reads are cacheable; write paths are not.
- All tables export to CSV/SQL; files export to ZIP.

## 3. Search

At launch: search by title, subject name, subject code and tags only (no full-text over PDFs). A simple indexed `LIKE` or SQLite FTS table is enough for 10,000 rows.
