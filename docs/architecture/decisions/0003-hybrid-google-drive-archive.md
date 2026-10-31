# ADR-0003: Hybrid archive, files in Google Drive and an index in our database
Status: Accepted
Date: 2026-10-02 (proposal scope update)

## Context
About 100 GB (2,000 to 10,000 files) of question papers and syllabi already sit in a shared MESAC Google Drive. Free hosting cannot hold 100 GB.

## Decision
Files stay in Drive, reached through the Drive API from the server. The site stores a searchable index row per file (`driveFileId`, department, program, semester, subject, code, scheme, exam year/month, type, tags). Popular files get a cached copy in our own storage. Public, no login, in-page preview plus download.

## Alternatives
- Move everything to R2/B2. Cost and migration effort; optional independent backup copy is still recommended (about $0.70/month for 100 GB on Backblaze B2, to be re-verified).

## Consequences
- A lapsed Google One plan breaks every file link. Track renewal in the handover guide.
- Drive can throttle popular files: hot-file cache and graceful fallback messages are required.
- Folder structure of the Drive is UNKNOWN and decides how much of the import can be automated.
- Written CUSAT permission must be stored in the handover guide.
