# @an/field

Field App for the Alfayo Nelson campaign — Expo SDK 52 + React Native 0.76, distributed as a **development build** (not Expo Go). Used by canvassers, polling agents, ward coordinators, and influence liaisons to log visits, register community leaders, capture village issues, and (once gates clear) committed supporters. SRS §3.12 (FR-100 to FR-102).

## Status

- ✅ Expo Router scaffold with workspace-aware Metro config
- ✅ Login screen (password + optional TOTP) consuming `@an/web` `/api/auth/login`
- ✅ Token stored in expo-secure-store (Keystore / Keychain)
- ✅ Home screen calling `/api/auth/me`, role-aware header, sign-out
- ✅ Two-tap visit logging with GPS (FR-050, beats NFR-030's 3-tap budget)
- ✅ Offline outbox via Expo SQLite — pending count + failed retry (FR-100)
- ✅ EAS development-build configuration
- ⏳ Auto-sync on connectivity change + AppState foreground
- ⏳ Community leader entry with canvasser review queue (FR-020 AC-020.2)
- ⏳ Issue capture, site check-in
- ⏳ Push notifications via Expo Push (FR-102)
- ⏳ Biometric unlock (FR-004)

## Why a development build (not Expo Go)?

This app uses native modules that need to be present in the runtime: `expo-secure-store` for the JWT keychain, `expo-location` for GPS, `expo-sqlite` for the offline outbox. Expo Go ships a fixed set of these and may not match our versions — and once we add push notifications and biometric unlock the gap widens. The **development build** is a custom dev client compiled for this project's exact native dependency set.

You build it **once** per device (or per OS update), then iterate on JS/TS as fast as Expo Go.

## One-time setup

```powershell
# 1. Install everything.
pnpm install

# 2. Copy the env example. Edit if running on emulator / phone (see API URL table below).
Copy-Item apps/field/.env.example apps/field/.env.local

# 3. Log in to EAS and bind this app to your Expo account.
pnpm dlx eas-cli login
pnpm --filter @an/field exec eas init
#    ↑ creates or links an Expo project. Writes the project ID into app.json's
#      "extra.eas.projectId" — replace the REPLACE_WITH_VALUE_FROM_EAS_INIT placeholders.
```

After `eas init`, **replace the two `REPLACE_WITH_VALUE_FROM_EAS_INIT` strings** in `apps/field/app.json` (`extra.eas.projectId` and the `updates.url` UUID suffix) with the values the CLI wrote.

## Build the dev client

Pick one path:

### Path A — EAS cloud build *(easiest — no Android Studio / Xcode needed)*

```powershell
pnpm --filter @an/field build:dev:android   # produces a downloadable APK
# or:
pnpm --filter @an/field build:dev:ios       # ad-hoc IPA (needs Apple Dev account)
```

Build runs on EAS in the cloud (~15 min on the free tier). When it's done, EAS prints / emails a download link. Install the APK on your phone, or drag the IPA to a simulator.

### Path B — Local build *(fastest iteration once you have native toolchain)*

Requires **Android Studio + Android SDK** (or **Xcode 16** on a Mac for iOS).

```powershell
pnpm --filter @an/field android   # expo run:android — generates the native
                                  # android/ project, builds, installs to a
                                  # connected device or running emulator.
```

## Iterating after the dev client is installed

The dev client only needs to be rebuilt when **native** dependencies change (new packages, plugin config updates, version bumps). For everyday JS/TS edits:

```powershell
pnpm --filter @an/web dev          # one terminal — the API backend
pnpm --filter @an/field dev        # other terminal — Metro bundler with --dev-client
```

Open the installed AN Field dev build on your device. It connects to Metro, hot-reloads on file save.

## Picking the right API URL

`EXPO_PUBLIC_API_URL` in `apps/field/.env.local`:

| Client | URL |
|---|---|
| iOS Simulator (Mac) | `http://localhost:3000` |
| Android Emulator | `http://10.0.2.2:3000` (host-aliased) |
| Physical phone | `http://<your-host-LAN-ip>:3000` |
| Production | `https://<deployed-web-url>` |

If you see "network unreachable" on the login screen, your phone can't reach the web API. Confirm the URL and that both devices are on the same Wi-Fi.

## Sign-in for testing

Same accounts as the web app:

| Phone | Role | 2FA? |
|---|---|---|
| `+254700000010` | canvasser | no |
| `+254700000011` | polling_agent | no |
| `+254700000001` | candidate | no |
| `+254700000013` | tech_lead | yes (enroll via web first) |

Password for everyone: `devpassword123!`.

The Field App **cannot enroll TOTP** itself — roles requiring 2FA must enroll once on the web app (`/enroll-totp`), then sign in here using the rotating 6-digit code from their authenticator.

## Architecture

```
apps/field/
├── app.json                    # Expo config (plugins, EAS project ID, runtime version)
├── eas.json                    # EAS build profiles: development, preview, production
├── babel.config.js             # babel-preset-expo
├── metro.config.js             # workspace-aware: watches monorepo root
├── tsconfig.json               # extends ../../tsconfig.base.json
├── lib/
│   ├── theme.ts                # brand-* design tokens mirrored from web
│   ├── uuid.ts                 # UUIDv7 — sortable, offline-safe idempotency keys
│   ├── gps.ts                  # expo-location wrapper (5s timeout, graceful fallback)
│   ├── auth-storage.ts         # expo-secure-store JWT session
│   ├── api-client.ts           # fetch wrapper: Bearer token, SRS envelope unwrap
│   └── outbox.ts               # Expo SQLite outbox: enqueue / sync / retry
└── app/                        # Expo Router file-based routes
    ├── _layout.tsx             # root Stack
    ├── index.tsx               # auth check → /(authed)/ or /login
    ├── login.tsx               # phone + password + (optional) TOTP
    └── (authed)/
        ├── _layout.tsx         # session double-check
        ├── index.tsx           # home: identity, sync card, action grid, sign-out
        └── visits/
            └── log.tsx         # two-tap visit log with GPS auto-capture
```

## EAS build profiles

| Profile | Channel | Distribution | Notes |
|---|---|---|---|
| `development` | development | internal | Dev client APK — for engineers + ward coordinators piloting |
| `development-simulator` | development | internal | iOS Simulator only (extends `development`) |
| `preview` | preview | internal | Release-flavor APK for QA / pilot users |
| `production` | production | store | Play Store / App Store submission |

## Offline guarantees

- SRS **CON-008**: 24-hour offline floor. Mutations queue in Expo SQLite (`an_field_outbox.db`), survive app restart, sync automatically when network returns.
- SRS **CON-009**: never store the complete voter register on device. Voter lookups happen on-demand against the API and each lookup is individually audit-logged server-side.
- **Idempotency**: every submission carries a client-generated UUIDv7. Server uses `ON CONFLICT DO NOTHING` — retried submissions produce exactly one row.
