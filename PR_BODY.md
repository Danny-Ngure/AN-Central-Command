## Summary

Implements **Phases 2 through 5** of the 13-phase roadmap, bringing the platform from an empty monorepo scaffold (commit `7ab9e59`) to a working Central Command web app, an Expo Field App with offline visit logging, and a fully-secured PostgreSQL schema with RLS, audit triggers, and column-encryption helpers.

## What's in here

### Phase 2 — Database (`packages/db/`)
- 20 Drizzle tables across 7 clusters matching ARC §6 ERD: identity, geography, community, activities, supporters (restricted), election, audit
- 4 hand-written SQL extras applied via a custom runner that tracks applied state:
  - Append-only triggers on `audit_log`, `visits`, `station_reports`, `consent_log` (NFR-050)
  - Auto-audit triggers on every writable table — actor read from `app.role` / `app.person_id` session vars
  - RLS policies encoding the full SRS §2.2 role × table matrix, with `app_user` Postgres role
  - pgcrypto `app_encrypt` / `app_decrypt` helpers (column conversion deferred to prod prep)
- Seed: 1 constituency, 5 wards, 5 villages, 10 polling stations, 15 people, 5 leaders/sites, 3 issues, 3 activities, 5 visits, 1 meeting, 1 program, 3 supporters, 1 critical incident

### Phase 3 — Auth (`packages/auth/`)
- Argon2id password hashing (OWASP params)
- TOTP via `otplib` — mandatory for 8 roles per BR-001.2
- JWT sessions via `jose` carrying `{ sub, role, wardId, sid }` claims that feed RLS
- Redis-backed rate limiting (5 attempts/min → 30-min lockout per NFR-013)
- Login orchestrator exposing the full SRS FR-001 ERR-001.* error-code surface
- TOTP enrollment flow with step1/step2 short-lived JWTs

### Phase 4 — Central Command web (`apps/web/`)
- Next.js 14 App Router with a route group for the auth boundary
- Login + TOTP enrollment + dashboard + 6 entity screens (analytics, community, supporters, issues, team, audit logs)
- Mapbox GL JS choropleth with SVG fallback, real IEBC ward boundaries fetched from the Kenya COD-AB dataset
- Click-to-select side panel + legend on the dashboard map
- Election countdown widget (FR-090) ticking in the persistent navbar
- API: `/api/auth/{login,logout,me,enroll-totp/confirm}`, `/api/dashboard/summary`, `/api/visits`, `/api/health`
- Server-component data path: `getServerAuthOrRedirect` → `withRlsTx` → Drizzle, every query RLS-scoped

### Phase 5 — Field App (`apps/field/`) — first vertical slice
- Expo SDK 54 + React Native 0.81 with Expo Router
- Login → JWT in `expo-secure-store` (Keychain/Keystore)
- Role-aware authed home with pull-to-refresh and sync-status card
- **Two-tap visit logging** (beats SRS NFR-030's 3-tap budget): GPS auto-captures on screen mount via `expo-location`, the user taps a purpose, the visit is enqueued
- **Offline outbox** via `expo-sqlite` (`lib/outbox.ts`):
  - Client-generated UUIDv7 idempotency keys
  - Survives app restart
  - `syncOutbox()` drains pending → POST → mark synced; failed rows track attempts, flip to `failed` after 5
  - Server uses `ON CONFLICT DO NOTHING` on the primary key so retries are exactly-once
- EAS development build configuration (`eas.json`, profiles for development / preview / production)
- pnpm-workspace-aware Metro config

### Tools
- `tools/fetch-ward-boundaries.ts` — multi-source resolver:
  1. Local Kenya wards GeoJSON in `tools/data/` (preferred — IEBC / OCHA COD-AB)
  2. OSM Overpass API (incomplete coverage for Kenyan wards)
  3. Hand-crafted approximate polygons (fallback)
- Generates `apps/web/components/map/ward-boundaries.ts`

### Operational
- CI gates in `.github/workflows/ci.yml` enforcing:
  - **NFR-016 / CON-006** — no third-party LLM SDK imports in production code
  - **NFR-052** — no PII patterns in `console.log` calls
- Webpack externals for native modules so Next.js doesn't try to bundle `.node` binaries
- `CLAUDE.md` at the monorepo root — comprehensive handoff doc with phase status, architecture invariants, test accounts, gotchas, and the open blocker

## Open blocker (called out in CLAUDE.md)

The Field App EAS development build queues + uploads cleanly but fails during the remote Gradle phase. Latest failed build: https://expo.dev/accounts/kimaniimmanuel/projects/an-field/builds/8744e98c-3132-4b1d-beb3-50be02a30ca3#run-gradlew

What's already been ruled out: SDK 52 vs 54 (now on 54), `C:\` junction at `node_modules` (removed), metro-config heuristic (`--non-interactive` flag added so the warning prompt no longer blocks). The next session needs to grab the actual Gradle "What went wrong" line from the EAS log to diagnose.

## What's NOT in here

Deferred to follow-up PRs:
- Field App auto-sync on connectivity restore (NetInfo + AppState foreground)
- Leader entry, issue capture, site check-in screens
- Push notifications (FR-102), biometric unlock (FR-004)
- NyaliTrack election-day app (Phase 9)
- Heatmap mode toggle (Coverage / Influence / Persuasion — FR-051/052/053)
- Audit log pagination + filters
- API routes per entity for mobile consumption
- Notifications / WhatsApp BSP / SMS integrations (Phase 7)
- Production security audit + DPIA sign-off (Phase 10)

## Test plan

- [ ] `pnpm install` succeeds from a fresh clone
- [ ] `docker compose -f infra/docker-compose.yml up -d` brings up Postgres+PostGIS, Redis, MailHog
- [ ] `pnpm db:migrate:all && pnpm db:seed && pnpm --filter @an/auth seed:credentials` populates a working dev DB
- [ ] `pnpm --filter @an/web dev` serves `http://localhost:3000`
- [ ] Sign in at `/login` as `+254700000010` / `devpassword123!` (canvasser, no 2FA) → land on dashboard with their 1 self-registered supporter visible
- [ ] Sign in as `+254700000002` / `devpassword123!` (campaign_manager) → redirected to `/enroll-totp`, scan QR with Authy, enter code → land on dashboard with all 3 supporters visible
- [ ] Tampering attempt: `UPDATE audit_log SET action='X' WHERE entity_type='wards'` from psql returns `insufficient_privilege`
- [ ] Dashboard map renders Mombasa-shape ward polygons with the cyan polling-station markers; clicking a ward opens the side panel
- [ ] Election countdown widget ticks in the navbar
- [ ] CI passes (lint + type-check + build + the two compliance gates)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
