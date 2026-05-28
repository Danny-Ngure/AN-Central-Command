# CLAUDE.md

This file orients Claude Code sessions working on **AN Central Command**. Read it first.

## What this project is

A three-app campaign-intelligence platform for the Alfayo Nelson parliamentary candidacy in Nyali Constituency, Mombasa, Kenya — targeting the **9 August 2027** Kenyan general election. Built by Developers Mania.

The three apps share one PostgreSQL+PostGIS backend:

| App | Path | Users | Stack |
|---|---|---|---|
| **Central Command** (web) | `apps/web/` | Candidate, campaign manager, strategist, coordinators | Next.js 14 App Router + Mapbox + Drizzle |
| **Field App** (mobile) | `apps/field/` | Canvassers, polling agents, ward coordinators, influence liaisons | Expo SDK 54 + React Native 0.81 + SQLite outbox |
| **NyaliTrack** (mobile, election day) | `apps/nyalitrack/` | Polling agents, war room on 9 Aug 2027 | Expo (not started yet) |

## Authoritative specs

When code and SRS disagree, **the SRS wins**.

- [`docs/SRS-ALFAYO-001.pdf`](docs/SRS-ALFAYO-001.pdf) — Software Requirements (30+ FRs, 30+ NFRs)
- [`docs/ARC-ALFAYO-001.pdf`](docs/ARC-ALFAYO-001.pdf) — 11 architecture diagrams (context, container, DFD, ERD, sequences)
- [`docs/conventions.md`](docs/conventions.md) — Engineering conventions distilled from the SRS
- **The 13-phase plan**: `C:\Users\User\.claude\plans\c-users-user-gemini-antigravity-scratch-iridescent-clover.md`

When SRS references appear in code (`FR-130`, `BR-001.2`, `CON-008`, `NFR-050`, `DPA §26`), the cross-reference is in the SRS.

## Phase status (May 2026)

| Phase | Status | Where |
|---|---|---|
| 0. External dependencies (ODPC reg, WhatsApp BSP, hosting, legal) | ✅ | User-driven |
| 1. Foundation (monorepo + Docker Compose) | ✅ | Root + `infra/` |
| 2. Schema + RLS + audit + encryption helpers | ✅ | `packages/db/` |
| 3. Auth (Argon2id, TOTP, Redis rate-limit, JWT) | ✅ | `packages/auth/` |
| 4. Central Command web (login, dashboard, 6 screens, Mapbox choropleth, countdown) | ✅ | `apps/web/` |
| **5. Field App** | 🟡 **In progress** | `apps/field/` |
| 6. Committed Supporter Network elaboration (post-ODPC) | ⏳ | `packages/db/` + `apps/web/` |
| 7. Notifications (WhatsApp / SMS / email + BullMQ workers) | ⏳ | New `packages/notifications/` |
| 8. Heatmaps (Coverage / Influence / Persuasion — FR-051/052/053) | ⏳ | `apps/web/` |
| 9. NyaliTrack | ⏳ | `apps/nyalitrack/` |
| 10. Security audit + DPIA | ⏳ | User-driven |
| 11. Performance + DR drills | ⏳ | k6 + chaos drills |
| 12. Election-day cutover | ⏳ | 9 Aug 2027 |

### Phase 5 sub-status (what's done in Field App so far)

- ✅ Expo Router scaffold (pnpm-workspace-aware Metro config)
- ✅ Login screen consuming `/api/auth/login` with `client: 'mobile'` → JWT in `expo-secure-store`
- ✅ Authed home screen calling `/api/auth/me`, role-aware header, sign-out
- ✅ Two-tap visit logging (`/visits/log`) with `expo-location` GPS capture
- ✅ SQLite outbox (`lib/outbox.ts`) — enqueue/sync/retry, idempotent via UUIDv7 + server `ON CONFLICT DO NOTHING`
- ✅ Server endpoint `POST /api/visits` (RLS-scoped, validates UUIDv7 + lat/lon + purpose enum)
- ✅ EAS development-build configuration (`eas.json`, project bound to `kimaniimmanuel/an-field`)
- ⏳ Auto-sync on connectivity restore (NetInfo + AppState foreground)
- ⏳ Leader entry with canvasser review queue (FR-020 AC-020.2)
- ⏳ Issue capture (FR-030)
- ⏳ Site check-in (FR-021)
- ⏳ Push notifications via Expo Push (FR-102)
- ⏳ Biometric unlock (FR-004)

## ⚠️ Current open blocker — read before doing anything else

The Field App EAS development build **fails during the Gradle phase** on EAS Build servers. The local CLI uploads cleanly; the remote Gradle compile errors out.

Latest failed build: https://expo.dev/accounts/kimaniimmanuel/projects/an-field/builds/8744e98c-3132-4b1d-beb3-50be02a30ca3#run-gradlew

The Gradle phase log on EAS hasn't been captured here yet. **First action for the new session**: open that URL (or run `pnpm dlx eas-cli build:view 8744e98c-3132-4b1d-beb3-50be02a30ca3`), scroll the "Run gradlew" phase to "What went wrong" / "FAILURE:", paste the surrounding ~30 lines, then diagnose.

What's been done so far on this:
- ✅ Removed a Junction at `apps/field/node_modules` that was pointing to `C:\` root (residue from a `"": "link:/"` corruption in the package.json — now cleaned)
- ✅ Bumped Expo from SDK 52 → 54 (React 19, RN 0.81)
- ✅ Re-resolved all Expo peer deps via `expo install`
- ✅ Confirmed compatibility via `expo install --check` (only minor mismatches auto-fixed)
- ✅ Reverted `apps/field/metro.config.js` to the canonical `expo/metro-config` shape
- ✅ Added `--non-interactive` to `build:dev:android` so the metro-config warning prompt no longer blocks
- ❌ Need: actual Gradle error from EAS log

Likely suspects to investigate once the error is in hand:
- **`react-native-reanimated` v4** requires the new architecture (`newArchEnabled: true` — we have it) AND specific babel plugin config. The new Worklets package may need a babel addition we haven't made.
- **NDK / Kotlin / Gradle version mismatch** between Expo SDK 54 expectations and what EAS image provides.
- **Missing native module config** for one of the plugins (expo-location, expo-secure-store, expo-sqlite).

## Architecture invariants (don't violate)

These are codified in [`docs/conventions.md`](docs/conventions.md). Highest-impact:

- **API response envelope**: every endpoint returns `{ success: boolean, data?: T, error?: { code, message, details? } }` (SRS §5.3).
- **Datetimes**: ISO 8601 UTC over the wire, ever.
- **IDs**: UUIDv7 — generated client-side on mobile for offline-safe idempotency.
- **RLS, always**: every table has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. App connects as superuser but each transaction drops to `app_user` role via `setRequestContext()` in `@an/db/client.ts`, which also sets `app.role`, `app.ward_id`, `app.person_id` from JWT claims. Policies in `packages/db/extras/03_rls_policies.sql` read those session vars.
- **Audit log is append-only**: trigger in `extras/01_append_only_triggers.sql` blocks UPDATE/DELETE on `audit_log`, `visits`, `station_reports`, `consent_log` for every role except the sealed `admin_audit`.
- **Auto-audit**: every writable table has a trigger (`extras/02_audit_triggers.sql`) that inserts into `audit_log` on every INSERT/UPDATE/DELETE.
- **404 not 403** on unauthorized supporter reads (SRS FR-130 ERR-130.2) — avoids confirming record existence to a probing attacker.
- **Never log PII**: enforced by a CI grep gate in `.github/workflows/ci.yml`.
- **Never call third-party LLM SDKs from production code** (SRS CON-006): enforced by the same CI gate.

## Monorepo layout

```
AN-Central-Command-monorepo/
├── apps/
│   ├── web/                # Next.js 14 + Drizzle + Mapbox — Central Command
│   ├── field/              # Expo SDK 54 + RN 0.81 — Field App
│   └── nyalitrack/         # Placeholder — Phase 9
├── packages/
│   ├── db/                 # Drizzle schema, migrations, extras/, seed
│   ├── auth/               # Argon2id, TOTP, JWT, Redis, sessions
│   ├── types/              # Shared TypeScript types
│   ├── i18n/               # en/sw dictionary
│   ├── ui/                 # Placeholder — shadcn/ui shared components
│   └── api-client/         # Placeholder — typed client for mobile
├── infra/
│   ├── docker-compose.yml  # Postgres+PostGIS:5433, Redis, MailHog
│   └── init/01-extensions.sql  # postgis, pgcrypto, admin_audit role
├── tools/
│   ├── fetch-ward-boundaries.ts  # Generates apps/web/components/map/ward-boundaries.ts
│   └── data/               # Gitignored — raw datasets (e.g., Kenya wards GeoJSON)
├── docs/
│   ├── SRS-ALFAYO-001.pdf
│   ├── ARC-ALFAYO-001.pdf
│   └── conventions.md
├── prototypes/
│   └── vite-react-sketch/  # Original Vite prototype — UX reference, read-only
└── .github/workflows/ci.yml
```

## Local dev — start everything

```powershell
# 1. Bring up Postgres+PostGIS, Redis, MailHog.
docker compose -f infra/docker-compose.yml up -d

# 2. Make sure each app has .env.local (copy from .env.example, fill in secrets).
Copy-Item packages/db/.env.example packages/db/.env.local
Copy-Item packages/auth/.env.example packages/auth/.env.local
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/field/.env.example apps/field/.env.local

# 3. Apply schema + RLS + triggers + seed data + dev passwords.
pnpm db:migrate:all          # auto-generated migrations + extras (RLS, triggers, encryption helpers)
pnpm db:seed                 # 17 entity types — see packages/db/src/seed/index.ts
pnpm --filter @an/auth seed:credentials   # hashes 'devpassword123!' for every seeded person

# 4. Run.
pnpm --filter @an/web dev    # Next.js → http://localhost:3000
pnpm --filter @an/field dev  # Metro bundler (requires dev build APK installed on phone)
```

## Test accounts (all password `devpassword123!`)

No 2FA — direct sign-in:

| Phone | Role | Scope |
|---|---|---|
| `+254700000001` | candidate | constituency-wide |
| `+254700000010` | canvasser | Kongowea, self-registered only |
| `+254700000011` | polling_agent | Frere Town station |
| `+254700000012` | influence_liaison | Kadzandani |
| `+254700000014` | patron_ceo | constituency-wide read-only |
| `+254700000015` | finance_lead | activities only |

2FA required — must enroll via web `/enroll-totp` on first login:

| Phone | Role | Scope |
|---|---|---|
| `+254700000002` | campaign_manager | constituency-wide |
| `+254700000005` to `+254700000009` | ward_coordinator | their ward only (Kadzandani, Kongowea, Mkomani, Frere Town, Ziwa La Ng'ombe) |
| `+254700000013` | tech_lead | full admin |

## Useful commands

| Command | What it does |
|---|---|
| `pnpm db:migrate:all` | drizzle-kit migrate + apply hand-written extras (RLS, triggers, encryption) |
| `pnpm db:seed` | Populate Nyali wards, polling stations, people, supporters, activities |
| `pnpm db:studio` | Drizzle Studio at http://localhost:4983 |
| `pnpm fetch:boundaries` | Regenerate ward polygons from `tools/data/*.json` or OSM |
| `pnpm --filter @an/web dev` | Next.js dev server |
| `pnpm --filter @an/web build` | Production build |
| `pnpm --filter @an/field dev` | Metro bundler (dev client must be installed) |
| `pnpm --filter @an/field build:dev:android` | EAS cloud build of Android dev client APK |
| `pnpm --filter @an/auth seed:credentials` | Hash dev password for every seeded person |

## Sourcing real ward boundaries

`apps/web/components/map/ward-boundaries.ts` is **auto-generated** by `pnpm fetch:boundaries`. Don't hand-edit. Recommended source: the user's Kenya wards GeoJSON dropped at `tools/data/*.json` (the script picks the most recent one). Expected property keys: `IEBC_WARDS` / `NAME` / `ADM3_EN` for ward name, `CONSTITUEN` / `ADM2_EN` for constituency. Falls back to OSM Overpass (incomplete for Kenya) or hand-crafted approximations.

## Gotchas seen in this codebase

- **Windows + pnpm + workspace deps**: a `"": "link:/"` in any workspace `package.json` makes pnpm create a Junction to `C:\` at `node_modules`, which then crashes future installs at `lstat 'C:\swapfile.sys'`. If you see this error: check the offending workspace's `package.json` for empty-named or root-link deps and delete the Junction with `(Get-Item path).Delete()` (NOT `Remove-Item -Recurse` — that follows the link).
- **Next.js `export const runtime`**: parsed statically. `export const runtime = nodeRuntime` (re-exported) does NOT work — Next reads the literal token. Must be `export const runtime = 'nodejs'` inline in every route file.
- **ESM hoisting**: in scripts that `config({ path: '.env.local' })` AND `import` `@an/db`, the import is hoisted above the config call → `@an/db/client.ts` runs and throws "DATABASE_URL missing" before dotenv loads. Fix: put the dotenv call in a side-effect module (`env-bootstrap.ts`) and import it FIRST so ESM evaluates it before `@an/db`. See `packages/auth/src/dev/seed-credentials.ts`.
- **Webpack + native modules**: Next.js's `transpilePackages: ['@an/auth']` walks into `@node-rs/argon2` and tries to bundle the `.node` binary. Fix already applied via `webpack.config.externals` in `apps/web/next.config.mjs`.
- **EAS metro-config heuristic**: warns even when `metro.config.js` does extend `expo/metro-config`. The warning is non-fatal; `--non-interactive` lets the build proceed.

## What was last touched in the previous session

Roughly in order:
1. Replaced hand-crafted polygons with real IEBC ward boundaries via `tools/fetch-ward-boundaries.ts` + user-supplied dataset
2. Added IEBC attribution to map footer
3. `tools/data/*` and `*.sql` added to `.gitignore`
4. SQL UPDATE emitter for ward voter counts (untested — dataset didn't have those columns)
5. Election countdown widget at `apps/web/components/countdown.tsx`, embedded in navbar
6. **Phase 5 visit-logging full slice**:
   - `apps/web/app/api/visits/route.ts` (server, idempotent ON CONFLICT)
   - `apps/field/lib/{uuid,gps,outbox}.ts`
   - `apps/field/app/(authed)/visits/log.tsx`
   - Updated `apps/field/app/(authed)/index.tsx` to wire the action button + sync badge
7. Moved Field App to Expo Development Build:
   - `apps/field/eas.json` (3 profiles)
   - `expo-dev-client` dep
   - `eas-cli` in root devDeps
   - `apps/field/README.md` rewritten with dev-build workflow
8. Upgraded Expo SDK 52 → 54 (React 19, RN 0.81)
9. Cleaned up a `C:\` Junction at `apps/field/node_modules` (residue from a `"": "link:/"` corruption)
10. Got the EAS build to upload + queue successfully — but it's failing in the remote Gradle phase

## Original prototype

The Vite + React in-memory prototype that this codebase is derived from lives at `prototypes/vite-react-sketch/` (and also at the user's original scratch dir `C:\Users\User\.gemini\antigravity\scratch\AN-Central-Command\`). Treat as UX reference, NOT as a code source. The data shapes in `prototypes/vite-react-sketch/src/data/mockData.ts` were the head start for the Drizzle schema.

## First action for the next session

1. Read this file end-to-end.
2. Open the failing EAS build URL above (or run `pnpm dlx eas-cli build:view 8744e98c-3132-4b1d-beb3-50be02a30ca3`) and capture the actual Gradle error.
3. Diagnose. Most likely candidates noted in the "Current open blocker" section above.
4. Once the dev build APK installs cleanly on a phone + connects to Metro, the next slice is **auto-sync on connectivity restore** for the offline outbox (NetInfo + AppState listener in `apps/field/lib/outbox.ts`).
