# Handover Guide

**Status: template.** The values marked UNKNOWN must be filled in by the people who hold them. Do not write secrets or passwords here. Write where they are stored.

## 1. Accounts (fill in)
| Account | Owner / holder | Where credentials and recovery codes live | 2FA |
|---|---|---|---|
| Shared MESAC email | UNKNOWN | UNKNOWN | UNKNOWN |
| GitHub org `mesac26` | UNKNOWN owner | | |
| Cloudflare | UNKNOWN | | |
| Google Drive (archive, about 100 GB) | UNKNOWN | | |
| Google One plan (pays for Drive space) | UNKNOWN payer; renewal date UNKNOWN | | |
| Domain registrar | Another MESAC member (name UNKNOWN) | | |
| Email-sending service | UNKNOWN (not chosen) | | |
| Faculty backup contact | UNKNOWN | | |

## 2. Yearly handover procedure
1. Outgoing admins add the new committee's emails in **Approved Admins** (any admin can).
2. In **Committee & Team**, run **Start new academic year** (archives the current team).
3. Update Head of Division and contact toggles in **Site Settings / Department**.
4. Update the shared MESAC email recovery details; rotate its password; confirm two-factor.
5. Remove departing admins.
6. Confirm the next renewal dates: Google One, domain, any paid services.
7. Run a manual export and store it in the agreed place.

## 3. Recovery
| Situation | What to do |
|---|---|
| Lost admin access | UNKNOWN until auth exists. Plan: a developer adds an email to the `admins` table directly |
| Site down | Check Cloudflare status and the latest deployment; redeploy the previous one |
| Data lost or corrupted | Restore the latest backup (procedure to be written and tested) |
| Google One lapsed | Archive links break. Renew first; then run the archive health check |
| Domain lapsing | Contact the registrar holder immediately |

## 4. Legal and permission records
- Written CUSAT permission to publish the archive: location UNKNOWN. **Store a copy reference here.**
- Consent for any personal contact shown publicly: default is hidden; keep consent records.

## 5. Annual review
Free-tier limits and terms change. Once a year re-check Cloudflare limits, Google Drive limits, email service limits, and the terms of every service used. Record the date and result here.

## 6. Rebuild from scratch
Repository + latest export (SQL/CSV/ZIP) + environment variable list + this guide are enough to rebuild. Steps are in [deployment.md](deployment.md).
