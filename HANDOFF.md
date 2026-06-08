# Quick Handoff — One-Page Summary

For the user (and a new Claude session). The full detail is in `CLAUDE.md`.

## What's running today

- **Web app**: Next.js 14 at `http://localhost:3000`. Sign in `+254700000001` / `devpassword123!` (Alfayo Nelson, Super Admin).
- **Database**: Postgres+PostGIS in Docker on port 5433, populated with **84,832 voters** across 5 wards + **55 sites in Kadzandani** + a real team of **19 active people**.
- **Migrations applied**: through `0007_people_title`.

## Big things shipped this session

| Area | What |
|---|---|
| **Brand** | ANHF teal-blue + bright-orange rebrand. Hero countdown. "Home" replaces "Zen Dashboard". |
| **Voter data** | 84,832 voters imported (per-ward fragmented). Live dashboard counts everywhere. Constituency + per-ward voter search with gender / age / phone filters. |
| **Polling stations** | Auto-created from voter file's POLLING STATION column. Smart merge (token-Jaccard) absorbs seed↔auto-created duplicates. Per-station detail page with paginated voter roster + Call/SMS/WhatsApp. |
| **Sites** | Smart multi-section parser handles coordinator PDF format (`NAME OF MOSQUE`/`NAME OF CHURCH` sections). XLSX files generated for all 5 wards in `tools/data/`. Visit logging is a structured 8-field questionnaire (temperature 🔥/🌤/🧊, recommendation, effort level). Itinerary tab shows upcoming + completed + today's banner. |
| **Analytics** | 6-tab analytics page with Swiss Poll + Politrack current polls + IEBC 2013/2017/2022 historical results + per-ward grouped bars + strategic ward profiles + demographic cross-check. Custom inline-SVG chart library. |
| **Team** | Org chart with Executive (9) + Ward Network (10 + Arnold's dual role). 3 Super Admins. Photo upload per person. Call/SMS/WhatsApp on every card. Person in Charge cards on ward + polling-station pages. |

## Three things waiting on the user

1. **Real phone numbers for Alfayo Nelson + Dan Ngure** (placeholders for now).
2. **Login credentials for the 16 new team members** — one command: `pnpm --filter @an/auth seed:credentials`.
3. **Drop the real logo** at `apps/web/public/logo.png` (currently rendering the SVG placeholder).

## Upcoming next-up choices

- Wire WhatsApp BSP for bulk broadcasts (Phase 7, 4-8wk BSP approval gate)
- Push notifications for today's visits (currently in-page banner only)
- Field app EAS Gradle build failing — has been stuck for weeks
- Phase 6 Committed Supporter Network (DPA-gated)

## File map shortcuts

- Project state + architecture invariants: `CLAUDE.md`
- Charts: `apps/web/components/charts/`
- Data import logic: `apps/web/lib/import-parsers.ts` + `apps/web/app/api/data-import/`
- Polling station dedup: `apps/web/lib/dedup-stations.ts`
- Ward sites Excel files: `tools/data/*.xlsx`
- Team seed: `tools/seed-team.cjs`
- Migrations: `packages/db/migrations/` (0002-0007 are this session)

The user is action-oriented. Ship small slices. Ask only the clarifying question that's actually blocking.
