# Open Questions and Risks

## Decisions still open
| # | Question | Needed from | Blocks |
|---|---|---|---|
| 1 | Final backend: confirm Cloudflare D1+R2 (recommended) or Supabase | Team | All backend work |
| 2 | Official site name and Head of Division (MESA vs MESAC) | MESAC | Site settings content |
| 3 | Email sign-in style: one-time code (recommended) vs password | Team | Auth |
| 4 | Final font pairing (and self-hosting) | Team | Design pass |
| 5 | Roles: one role (full access) or the three in the types | Team | Admin model |
| 6 | Re-plan the timeline (proposal said one month from Oct 2, 2026) | Team | Planning |
| 7 | Email service provider and domain DNS access | Team + registrar holder | Notifications, admin sign-in |
| 8 | Whether to keep `/about` and `/team` alongside `/about-mesac` and `/about-mesac/team` | Team | Content structure |
| 9 | Remove the animation stack (three, gsap, lenis) now or after launch | Team | Performance, design |

## Information needed from MESAC
- Official CUSAT grading rules for the GPA calculator.
- Real documents collected for the Archive; original images.
- Confirmation of which Academy track details and links are correct.
- Consent for any public personal contact details.
- How the shared Drive is organised; Google One plan owner and renewal date.
- List of departments and schemes for the archive filters.
- Whether an independent copy of the 100 GB is wanted.
- Location of the written CUSAT permission.

## Access blockers
- `akshayev` has read-only access to `mesac26/mesac1.0`; PRs need an org owner to merge until write access is granted.
- Domain registrar login is held by another MESAC member.

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Timeline too tight for dashboard + redesign + migration | Late or partial launch | Archive, forms, privacy notice and handover guide are fixed scope; defer polish first |
| Prototype admin deployed publicly | Anyone edits UI state (no data yet) and later, real data | Do not deploy `/admin` until real auth; checklist item |
| Pinned beta `nitro` and young framework | Breakage, harder maintenance | Keep logic behind contracts; plan upgrade; ADR-0001 |
| Free-tier limits change | Outage or cost | Cache public pages; yearly review; exports |
| Single shared account | Single point of failure | Handover guide, faculty backup contact, 2FA, recovery codes |
| Lapsed Google One plan | All archive links break | Renewal tracked in handover guide |
| Drive throttling during exams | Broken downloads | Hot-file cache, clear fallback message |
| Heavy assets (public is about 37 MB; 3D and animation libraries) | Slow on mid-range phones | Image optimisation, remove heavy animation |
| Unverified mock content treated as real | Wrong public information | Content review before launch |
| `.env` not in `.gitignore` | Secret leak | Add `.env`; use secret scan before commits |
| No automated tests | Regressions | Add Vitest + Playwright + CI |
| Personal data from the old site | Privacy | Never commit old-site personal data; contacts hidden by default |
