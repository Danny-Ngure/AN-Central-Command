# CLAUDE.md — Project Handoff

This file briefs a fresh Claude Code session on the current state of **Alfayo Nelson Central Command** (campaign intelligence portal for Nyali Constituency, Mombasa, Kenya). Election: **9 August 2027**.

> **You are picking up a working dev environment.** Postgres + Redis are running in Docker. The web app is built. The database is populated with real voter and site data. Recent work was wide and deep — the highlights are below.

---

## 1. Fastest way to get the app running

```powershell
# 1. Docker Desktop must be running (system tray whale icon).
cd C:\Users\User\.gemini\antigravity\scratch\AN-Central-Command-monorepo

# 2. Bring up infra if not already:
docker compose -f infra/docker-compose.yml up -d
docker ps --format "table {{.Names}}\t{{.Status}}"   # expect alfayo-postgres, alfayo-redis, alfayo-mailhog all Up

# 3. Web dev server:
pnpm --filter @an/web dev
```

Open **http://localhost:3000**. Sign in:

| Account | Password | Notes |
|---|---|---|
| `+254700000001` | `devpassword123!` | **Alfayo Nelson** (candidate, Super Admin) — no 2FA, lands on dashboard |
| `+254700000010` | `devpassword123!` | seeded canvasser — limited scope, fast smoke-test |

Other team-member phones (Benson, Justine, Kofa, etc.) exist in the DB but **don't have `auth_credentials` rows yet** — they can't log in until you run `pnpm --filter @an/auth seed:credentials`, which hashes `devpassword123!` for any person without credentials.

---

## 2. What this session built (since the last commit `6031656`)

The branch is uncommitted but everything below is on disk. ~50 task-tracked work items completed this session.

### Database — 6 migrations applied to the live DB
All committed under `packages/db/migrations/` + `meta/_journal.json` entries:
| File | What |
|---|---|
| `0002_voters_and_site_visits.sql` | `voters` table + `community_sites.visited / visited_at / visited_by_person_id / contact_person_name / contact_phone / contact_role` |
| `0003_site_visit_notes.sql` | `community_sites.visit_notes` |
| `0004_site_area_name.sql` | `community_sites.area_name` (free-text location label) |
| `0005_site_planned_visit.sql` | `community_sites.planned_visit_at` |
| `0006_site_visit_details.sql` | 9 columns: `visit_promises`, `visit_benefits`, `visit_response`, `visit_temperature`, `visit_recommendation`, `visit_effort`, `planned_purpose`, `planned_objectives`, `planned_attendees` |
| `0007_people_title.sql` | `people.title` (free-text job title alongside the role enum) |

Drizzle schema in `packages/db/src/schema/` updated to match all 6.

### Data ingestion
- **`/api/data-import/preview` + `/commit`** rewritten to take multipart file uploads (commit re-parses the file, no 100-row cap). Bulk-insert path for voters (500-row batches). Auto-creates polling stations from the voter file's POLLING STATION column. Auto-runs dedup at the end of every voter import.
- **Smart multi-section sites parser** (`apps/web/lib/import-parsers.ts → parseSitesMultiSection`). Detects `NAME OF MOSQUE` / `NAME OF CHURCH` section headers in coordinator PDFs converted to Excel; derives site `type` from the section header. Falls back to standard tabular parsing.
- **Auto-merge polling stations** after every voter import — `apps/web/lib/dedup-stations.ts` does token-Jaccard similarity matching (threshold 0.6). Seed stations absorb their auto-created twins (preserve IEBC code + turnout history); empty stations with no match get deleted.
- Per-ward upload page at `/wards/[id]/import` (force-ward via URL).

### Imports already in the DB
| Ward | Voters imported | Sites |
|---|---|---|
| Frere Town | 16,103 | XLSX ready, not uploaded yet |
| Kadzandani | 15,555 | XLSX uploaded by user |
| Kongowea | 20,241 | XLSX ready |
| Mkomani | 16,837 | XLSX ready |
| Ziwa La Ng'ombe | 16,096 | XLSX ready |
| **Total voters** | **~84,832 unique** | |

`tools/data/` contains ready-to-upload **XLSX files** for every ward's sites (mosques + churches in coordinator-PDF format):
- `kadzandani-sites.csv` + user uploaded `CHURCH AND MOSQUES KADZANDANI.xlsx`
- `freretown-sites.xlsx` — 42 sites
- `kongowea-sites.xlsx` — 46 sites
- `mkomani-sites.xlsx` — 66 sites (10 mosques + 56 churches)
- `ziwa-sites.xlsx` — 50 sites
The corresponding `tools/generate-*-sites.cjs` scripts regenerate them from hardcoded parsed data.

### Pages — restructured with tabs
- **`/wards/[id]`** now has **top-level tabs**: `Demographics & station size` / `Polling stations` / `Religious & social sites` / `Itinerary & meetings`. URL: `?tab=demographics|stations|sites|itinerary&siteTab=coverage|mosques|churches|social|boda|other`. **Person in Charge** orange card under the header showing ward coordinator + assistants with phone actions.
- **`/polling-stations/[id]`** has tabs `Voters | Demographics | Turnout history` + a coordinator strip showing ward coord + assistant.
- **`/analytics`** has 6 tabs: `Pollings | Historical results | 2013 | 2017 | 2022 | Analysis & demographics`. Data sources in `apps/web/data/elections-history.ts` + `current-polls.ts`. Pie + bar + grouped-bar + donut combos throughout. Smart-sized charts (BarChart max-w-xl, GroupedBarChart max-w-4xl, bar widths 78/66).
- **`/team`** rebuilt as the org chart: **Executive & Technical Team** (9) + **Grassroots & Ward Coordination Team** (10 + Arnold's dual role). Avatar + ★ Super Admin / Peer badge + Dual role badge / title / role / operational base / phone + Call/SMS/WhatsApp + inline photo upload form.

### Charts library
`apps/web/components/charts/`:
- `pie.tsx` — pie/donut with optional center text + legend
- `bar-chart.tsx` — single-series vertical bars (turnout %, etc.)
- `grouped-bar.tsx` — multi-series grouped bars (per-ward, per-cycle comparisons)
- `horizontal-bar.tsx` — for poll standings / polling-stations-by-size

All hand-rolled inline SVG (no chart-lib dependency).

### Visit logging — structured questionnaires
The site card on `/wards/[id]?tab=sites` has two side-by-side mini-forms:
- **Plan a future visit** (amber): visit date + purpose + objectives + attendees (all but attendees required)
- **Log a completed visit** (emerald): visit date + nature of interaction + promises made + response received + welcome temperature (🔥/🌤/🧊) + recommend revisit (priority/normal/low) + effort level (intensify/maintain/reduce). All required. Benefits offered is optional.

Server validates required fields at `apps/web/app/api/sites/[id]/note/route.ts`. Audit log captures every transition. The site card displays everything prominently after visit is logged.

### Itinerary tab
`/wards/[id]?tab=itinerary`:
- **🔔 Today's visits** banner (orange) if any planned for today
- **⚠ Overdue plans** (red border) — past-due plans
- **📅 Upcoming planned visits** (amber border)
- **Welcome temperature** + **Revisit recommendations** summary cards
- **✓ Recent completed visits** (emerald border) with temp + reco badges + note preview

### Team Directory
- 19 active people seeded via `tools/seed-team.cjs` (re-runnable, upserts by phone)
- 12 leftover seed accounts deactivated (`active=false`)
- 3 Super Admins: Alfayo Nelson, Benson Imoli, Dan Ngure
- All others: Standard Peer access (their roles already cover what they need)
- Photo upload: `POST /api/team/[id]/photo` → saves to `apps/web/public/team-photos/<id>.<ext>`, updates `photo_url`. Cache-busted with `?v=<timestamp>` query.
- Phones (17 real ones loaded; Alfayo + Dan kept on placeholders pending real numbers from user):

  ```
  Alfayo Nelson     +254700000001  (PLACEHOLDER — user to provide)
  Benson Imoli      +254725967858
  Justine Katana    +254713168440
  Cavins Omino      +254735683447
  Arnold Baya       +254706547972
  Irene Mkamburi    +254715562217
  Dan Ngure         +254700000013  (PLACEHOLDER — user to provide)
  Javas Tindi       +254740553475
  Ryan Siriba       +254702884715
  Nafisa Kalondu    +254113254609
  Wadede Hamisi     +254726790872
  Umi Njeri         +254724638705
  Kofa Mohammed     +254712838800
  Taura             +254723922193
  Damah             +254724976672
  Lucy Ogutu        +254702816974
  Sammy Otenga      +254703754630
  Salma Khalef      +254779531936
  Jilo Mohammed     +254727515280
  ```

### Brand
- ANHF palette in `tailwind.config.ts` — teal-blue `#025e73`, bright-orange `#ff6600`, sky-blue `#00ccff`, dark-gray `#212120`
- `brand-violet` / `brand-cyan` etc. **kept as back-compat aliases** that now resolve to the ANHF palette (so existing class names re-skinned automatically)
- Brand name: **"ALFAYO NELSON CENTRAL COMMAND"** in navbar + login + page title + favicon
- Logo placeholder at `apps/web/public/logo-placeholder.svg` (red+blue triangle + database stack). Real logo: drop a `logo.png` at `apps/web/public/logo.png` — the `LogoImg` component falls back from PNG to SVG automatically.
- **Hero countdown** strip below the navbar — months + days + hours + minutes + seconds in big boxed cells with urgency tiering (calm/active/warning/critical).
- Sidebar entry "Zen Dashboard" renamed to **"Home"**.

---

## 3. Architecture invariants — don't break these

### RLS pattern
All page data fetches go through `withRlsTx(claims, async tx => …)` from `apps/web/lib/api.ts`. This drops the session into the `app_user` Postgres role and sets `app.role / app.ward_id / app.person_id` session variables. **Do not query directly with `db.select(…)` from a server component** — it bypasses RLS.

### Drizzle quirk — avoid correlated subqueries
`sql<number>\`(SELECT count(*) FROM ${voters} WHERE ${voters.wardId} = ${wards.id})\`` will silently return 0 when referenced through `${wards.id}` inside a sql template that's nested as a column projection. Pattern that works: **separate GROUP BY queries + JS Map merge**. Used throughout `dashboard/page.tsx`, `wards/page.tsx`, `wards/[id]/page.tsx`.

### Routes that mutate must use `xmax = 0`
Bulk INSERT … ON CONFLICT DO UPDATE returns rows where `xmax = 0` for true inserts vs `xmax = <tx>` for updates. The voter import uses this — comparing `createdAt` timestamps fails inside a long-running transaction because Postgres `now()` returns transaction start time.

### Phone normalisation
`normalisePhone()` in `apps/web/app/api/data-import/commit/route.ts` accepts `'723535594' | '0723535594' | '+254723535594' | '254723535594'` and returns `+254723535594`. Regex requires `^[71]\d{8}$` after stripping prefix — accepts both 07XX and 01XX (Telkom) Kenyan numbers.

### DPA gate
Voter ingestion requires `DPA_VOTER_INGEST_ENABLED=true` in `apps/web/.env.local`. Currently set. Removing it would make `/api/data-import/commit` reject voter imports with `IMPORT_VOTER_INGEST_LOCKED`.

### Append-only tables
`audit_log`, `visits`, `station_reports`, `consent_log` have Postgres triggers denying UPDATE/DELETE for all roles except `admin_audit`. Don't try to mutate them.

### Identity-stable lookups in /team
`SUPER_USER_NAMES`, `OPERATIONAL_BASE`, `DUAL_WARD_ASSIGNMENTS` are keyed by `fullName` (not phone) so phone changes don't break the org chart.

### Smart sites parser is sites-only
`parseSitesMultiSection()` is called BEFORE `parseUpload()` only when `entityType === 'sites'`. Voters / polling_stations / community_leaders always go through the standard tabular parser.

---

## 4. Recent open threads / what's queued

### Immediate (high-value follow-ups)
1. **Real phones for Alfayo Nelson + Dan Ngure** — user will provide. Then run:
   ```sql
   UPDATE people SET phone = '+254...' WHERE full_name = 'Alfayo Nelson';
   UPDATE people SET phone = '+254...' WHERE full_name = 'Dan Ngure';
   ```
   The `SUPER_USER_NAMES` set in `/team/page.tsx` is keyed by name so the Super Admin badge survives.
2. **Login credentials for the 16 new team members** — `pnpm --filter @an/auth seed:credentials` hashes `devpassword123!` for anyone without credentials. Then each team member can sign in with their phone + that password (and enroll TOTP for the 2FA-required roles like campaign_manager / chief_strategist / ward_coordinator).
3. **Real logo PNG** — drop at `apps/web/public/logo.png`. The `LogoImg` component auto-prefers it over the SVG placeholder.
4. **Upload Frere Town + Kongowea + Mkomani + Ziwa sites** — XLSX files are sitting in `tools/data/`. The user has uploaded Kadzandani; the other four are queued.

### Field App
`apps/field/` (Expo SDK 54 + React Native 0.81 + Expo Router) is scaffolded but the EAS development build is **still failing in remote Gradle**. The latest failed build was at https://expo.dev/accounts/kimaniimmanuel/projects/an-field/builds/8744e98c-3132-4b1d-beb3-50be02a30ca3 — earlier session added `react-native-worklets/plugin` to `babel.config.js` (likely fix for Reanimated 4 + new architecture) but a fresh build hasn't been triggered. Diagnose via the EAS log "What went wrong" line.

### Phase 7 (Notifications & Integrations)
Notifications + WhatsApp BSP + SMS integrations not started. The phone action buttons (Call/SMS/WhatsApp) on every contact across the app are wired via `tel:` / `sms:` / `wa.me/` deeplinks — they work for one-to-one but bulk broadcast needs:
- WhatsApp Business API account (360dialog or Africa's Talking, 4-8 week approval — DEP-001 in SRS)
- Africa's Talking SMS for fallback
- BullMQ worker process for queueing

### Deferred items from the original 13-phase roadmap
Phase 6 (Committed Supporter Network), Phase 8 (Analytics heatmaps), Phase 9 (NyaliTrack election-day app), Phase 10 (security audit + DPIA), Phase 11 (perf + reliability), Phase 12 (election-day cutover).

---

## 5. Project layout

```
AN-Central-Command-monorepo/
├── apps/
│   ├── web/                          # Next.js 14 — primary
│   │   ├── app/(authed)/             # auth boundary + sidebar shell
│   │   │   ├── dashboard/            # Home (renamed from "Zen Dashboard")
│   │   │   ├── wards/                # /wards index + /wards/[id] (4 tabs) + /wards/[id]/voters + /wards/[id]/import
│   │   │   ├── voters/               # constituency-wide voter search
│   │   │   ├── polling-stations/[id] # 3 tabs: Voters / Demographics / Turnout
│   │   │   ├── analytics/            # 6 tabs: Pollings / History / 2013 / 2017 / 2022 / Analysis
│   │   │   ├── team/                 # org chart with photo upload
│   │   │   ├── data-import/          # global import UI
│   │   │   └── audit, community, issues, supporters, ...
│   │   ├── app/api/
│   │   │   ├── auth/                 # login, logout, me, enroll-totp
│   │   │   ├── data-import/          # preview, commit (multipart, multi-section sites parser)
│   │   │   ├── polling-stations/dedup # smart merge endpoint
│   │   │   ├── sites/[id]/note       # visit log with 8 required fields
│   │   │   ├── sites/[id]/toggle-visited
│   │   │   └── team/[id]/photo       # multipart photo upload
│   │   ├── components/
│   │   │   ├── charts/               # pie, bar, grouped-bar, horizontal-bar
│   │   │   ├── brand.tsx + logo-img.tsx
│   │   │   ├── countdown.tsx         # hero countdown with months
│   │   │   ├── phone-actions.tsx     # Call/SMS/WhatsApp buttons
│   │   │   ├── voter-list.tsx        # shared paginated voter table
│   │   │   ├── navbar.tsx, sidebar.tsx, logout-button.tsx
│   │   ├── data/
│   │   │   ├── elections-history.ts  # 2013/2017/2022 IEBC tallies + per-ward
│   │   │   └── current-polls.ts      # Swiss Poll Int + Politrack
│   │   ├── lib/
│   │   │   ├── api.ts                # withAuth, withRlsTx, ok/err envelopes
│   │   │   ├── server-auth.ts        # getServerAuthOrRedirect
│   │   │   ├── import-parsers.ts     # tabular + multi-section sites parsers
│   │   │   └── dedup-stations.ts     # token-Jaccard merge logic
│   │   └── public/
│   │       ├── logo.png              # NOT YET — drop here when user provides
│   │       ├── logo-placeholder.svg  # ANHF-coloured fallback
│   │       └── team-photos/          # uploaded portraits, served as-is
│   └── field/                        # Expo (build failing — see §4)
├── packages/
│   ├── db/
│   │   ├── migrations/               # 0000–0007 applied
│   │   ├── extras/                   # append-only triggers + RLS + pgcrypto
│   │   └── src/schema/
│   │       ├── audit.ts, geography.ts, identity.ts, community.ts,
│   │       │   activities.ts, supporters.ts, election.ts, voters.ts
│   └── auth/                         # Argon2id + TOTP + jose JWT + Redis rate limit
├── tools/
│   ├── seed-team.cjs                 # 19 team members, idempotent
│   ├── generate-{ward}-sites.cjs     # one per ward, regenerates XLSX files
│   └── data/                         # gitignored — generated XLSX + CSV files for upload
└── infra/
    └── docker-compose.yml            # Postgres+PostGIS (5433), Redis, MailHog
```

---

## 6. Quick reference — common ops

```powershell
# Re-seed the team (idempotent — UPSERTs)
node tools/seed-team.cjs

# Regenerate a ward sites XLSX (after editing the source data inside the cjs)
node tools/generate-kongowea-sites.cjs

# Apply a new migration manually
docker cp ./packages/db/migrations/000X_yourname.sql alfayo-postgres:/tmp/m.sql
docker exec alfayo-postgres bash -c "psql -U alfayo -d alfayo_dev -f /tmp/m.sql"

# Run constituency-wide dedup after dropping new data
# (or trigger via UI: Wards → "⚙ Merge & clean up duplicates (all wards)")

# Type-check just the web app
pnpm --filter @an/web type-check

# Dev server
pnpm --filter @an/web dev

# Seed login credentials for any new team members
pnpm --filter @an/auth seed:credentials
```

---

## 7. Known type-check noise

`pnpm --filter @an/web type-check` still emits pre-existing errors that aren't from this work:
- `Cannot find module 'drizzle-orm'` — moduleResolution config glitch, affects every page; doesn't block dev or build
- `app/api/auth/me/route.ts` — stale withAuth type signature
- `lib/api.ts (92, 97)` — `$client` missing on PgTransaction
- `mapbox-gl/dist/mapbox-gl.css` — type declarations missing

All four pre-date this session. Filter them out when grepping for new errors:
```powershell
pnpm --filter @an/web type-check 2>&1 | grep -vE "drizzle-orm|mapbox-gl/dist|api\.ts\(9[27]|auth/me/route"
```

---

## 8. Specs cross-reference

Original specs live at the repo root:
- `SRS-ALFAYO-001.pdf` — 30+ FRs, 30+ NFRs
- `ARC-ALFAYO-001.pdf` — 11 architecture diagrams
- `ARC-ALFAYO-001.txt` — plaintext extract (grep this)

When code mentions things like `BR-130.1` or `DPA §26`, those are cross-references.

Recent additions explicitly tracked against SRS:
- FR-090 election countdown — implemented (hero strip)
- FR-091 constituency map — implemented (Mapbox with SVG fallback)
- BR-130.1 documented consent — enforced in voter import + supporter creation
- NFR-050 audit log append-only — triggers in place
- NFR-052 PII redaction in logs — voter imports log filename + counts only

---

## 9. If you're starting work

1. Read this file (you're doing it).
2. `git status` — see what's uncommitted. Most of this session's work is unstaged.
3. Check Docker is running: `docker ps`.
4. Start the web app: `pnpm --filter @an/web dev`.
5. Sign in as Alfayo (`+254700000001` / `devpassword123!`).
6. Click around — `/team`, `/wards/[any]` (open Itinerary tab), `/analytics`, `/data-import` — to get a feel.
7. When in doubt, search the file. Most non-trivial logic has a comment block explaining why.

The user works directively and quickly. Prefer shipping small slices that ladder up to a clear ask rather than asking many clarifying questions. They will tell you when scope is wrong.
