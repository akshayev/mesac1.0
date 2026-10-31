# Backend Contracts

The UI was built against TypeScript interfaces so the backend can be added without redesigning screens. This document says what the backend developer must deliver. Source of truth: `src/types/admin.ts` (VERIFIED). If this file and the code disagree, the code wins; fix this file.

## 1. Approach

1. Implement each `*ServiceContract` against the database.
2. Expose them to the UI through TanStack Start server functions or route loaders.
3. Replace `src/data/mock/*` imports in routes with these calls, one domain at a time.
4. Keep mock data as test fixtures only.

## 2. Contracts

### AuthServiceContract
```
checkSession(): Promise<AdminSession | null>
signInWithGoogle(): Promise<{ redirectUrl: string } | void>
initiateEmailSignIn(email): Promise<{ success: boolean; message: string }>
verifyEmailSignIn?(email, code): Promise<AdminSession>
signOut(): Promise<void>
```
Rules: approved + active emails only; hashed one-time codes with short expiry and attempt limits; generic error messages.

### ArchiveServiceContract
```
list(filters?: { search, department, program, semester, scheme, type }): Promise<ArchiveDocument[]>
getById(id): Promise<ArchiveDocument | null>
create(document, file?): Promise<ArchiveDocument>
update(id, updates): Promise<ArchiveDocument>
replaceFile(id, file): Promise<ArchiveDocument>
delete(id): Promise<void>
bulkTag(documentIds, tags): Promise<void>
runHealthCheck(): Promise<ArchiveHealthIssue[]>
```
Rules: `create` uploads the file to the shared Drive and writes the index row in one step (all or nothing). `list` must paginate; 10,000 rows must not be sent to a phone. Health check flags rows whose Drive file is missing or no longer shared.

### EventsServiceContract
```
list(); create(event); update(id, updates); delete(id)
```
Status (`upcoming`/`ongoing`/`completed`) must be derived from dates, not typed by hand.

### TeamServiceContract
```
list(academicYear?); create(member); update(id, updates); delete(id)
startNewAcademicYear(newYear, archiveCurrent): Promise<{ success: boolean }>
```
`startNewAcademicYear` must be transactional.

### InboxServiceContract
```
listEnrollments(); updateEnrollmentStatus(id, status)
listContacts();    updateContactStatus(id, status)
listArchiveReports(); updateArchiveReportStatus(id, status)
```
A new item must trigger an email to admins.

## 3. Contracts that do not exist yet (write them)

| Domain | Needed |
|---|---|
| Public form intake | `submitEnrollment`, `submitContact`, `submitAlumni`, `submitArchiveReport`, each with Turnstile verification, server-side validation (zod), rate limiting |
| Site settings and home blocks | get/update |
| Gallery | albums and images with upload and resize |
| Faculty, achievements, placements, academy tracks, programs, labs | CRUD |
| Admin management | list/add/remove approved admins |
| Activity log | write on every admin mutation; paginated read |
| Backups and export | trigger, list, download; scheduled job |
| Archive file access | signed or proxied download and preview; hot-file cache in R2 |
| Drive import | one-time script that walks the Drive folders and builds the first index |

## 4. Non-functional requirements for the backend

- Public reads cacheable; stay far below the free-tier request cap (100,000 Workers requests/day if on Cloudflare).
- Never return `show_contact = false` fields on public endpoints.
- Validate on the server; client validation is convenience only.
- Secrets only in environment bindings, never in git. `.env.example` must list every variable name (without values).
- Idempotent migrations, stored in the repo.
- Every mutation writes the activity log.
- Full export in SQL/CSV/ZIP at any time.
