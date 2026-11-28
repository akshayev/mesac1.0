# Database migrations (Cloudflare D1)

Each `.sql` file here changes the admin database once. Wrangler records which files have run (in a
`d1_migrations` table) and applies only the new ones, in file-name order.

- On the live site the GitHub workflow runs `wrangler d1 migrations apply DB --remote` before every deploy,
  but only when the `D1_DATABASE_ID` secret is set.
- On your computer: `npm run db:migrate:local` (uses the local database in `.wrangler/state`).

## Adding a migration

1. Create the next file: `0002_short_description.sql` (four digits, then a few words with underscores).
2. Write plain SQLite. Make it safe to run twice where SQLite allows it: `CREATE TABLE IF NOT EXISTS`,
   `CREATE INDEX IF NOT EXISTS`. (`ALTER TABLE ... ADD COLUMN` has no `IF NOT EXISTS`; that is fine because
   wrangler never runs the same file twice.)
3. **Never edit or rename a migration that has already run on the live database.** Fix mistakes with a new file.
4. Do not put personal data (names, emails, phone numbers) in a migration file; this repository is public.
5. Update the code that reads the table (`src/server/db.ts`) and its tests, then run `npm run test:data`.
   The tests apply every file in this folder to an in-memory database.
6. Try it locally: `npm run db:migrate:local`, then `npm run dev:admin`.

Removing a column or table cannot be undone except by restoring a backup (D1 Time Travel, see
`docs/OWNER-DEPLOYMENT-GUIDE.md`), so take care with destructive changes.
