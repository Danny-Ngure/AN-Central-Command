# Alfayo Nelson Central Command

Campaign intelligence and field operations platform for the Alfayo Nelson Nyali Constituency parliamentary candidacy (Mombasa, Kenya). Target election: **9 August 2027**.

> **Confidential.** Source code is private (SRS CON-007). Distribution restricted to named members of the campaign and Developers Mania project team. Unauthorised disclosure may compromise campaign operations and violate the Kenya Data Protection Act, 2019.

## Source-of-truth documents

- [`docs/SRS-ALFAYO-001.pdf`](docs/SRS-ALFAYO-001.pdf) — Software Requirements Specification (functional + non-functional requirements)
- [`docs/ARC-ALFAYO-001.pdf`](docs/ARC-ALFAYO-001.pdf) — Architecture Diagrams (context, container, DFD, ERD, sequences)
- [`docs/conventions.md`](docs/conventions.md) — Cross-cutting engineering conventions

Where the code and the SRS disagree, the **SRS is authoritative**.

## Three applications, one backend

| Workspace | Application | Stack |
|---|---|---|
| `apps/web` | Central Command (web) + API | Next.js 14 App Router, Drizzle, Auth.js |
| `apps/nyalitrack` | NyaliTrack (mobile, election-day operations) | Expo SDK 51+, WebSocket |

Shared:

| Workspace | Purpose |
|---|---|
| `packages/types` | Shared TypeScript domain types (single source of truth) |
| `packages/i18n` | en/sw translation dictionary |
| `packages/db` | Drizzle schema, migrations, seed scripts |
| `packages/ui` | shadcn/ui components + brand-* design tokens (web-only) |
| `packages/api-client` | Generated typed API client + zod schemas (shared by mobile) |

## Reference: the Vite/React prototype

The original clickable prototype lives at [`prototypes/vite-react-sketch/`](prototypes/vite-react-sketch). Treat it as **UX wireframes** for the Next.js rewrite — copy layout decisions, do not copy code (different framework, different data layer).

## Prerequisites

- Node.js ≥ 20.0.0 (`.nvmrc` says 20)
- pnpm ≥ 9.0.0 (corepack: `corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Docker Desktop (for the local Postgres+PostGIS+Redis stack)
- A Postgres/PostGIS familiarity helps; the schema lives in `packages/db`

## Getting started (local dev)

```bash
# 1. Install dependencies (workspace-aware)
pnpm install

# 2. Start local infra (Postgres+PostGIS, Redis, MailHog)
docker compose -f infra/docker-compose.yml up -d

# 3. Run database migrations + seeds (post-Phase 2)
pnpm db:migrate
pnpm db:seed

# 4. Run everything in dev mode
pnpm devpnpm --filter @an/db db:apply-extras
```

## Expose local web dev via ngrok

With the web app running on `http://localhost:3000`, start a tunnel:

```bash
pnpm ngrok
```

If ngrok reports an upstream connection refusal, make sure the web dev server is already running and reachable at `http://127.0.0.1:3000`.

## Hosting (per SRS CON-001)

All personal data of Kenyan citizens must be stored on servers physically located in Africa, Kenya preferred where feasible (DPA 2019 §50). Approved hosting regions:

- **AWS Cape Town** (`af-south-1`) — primary
- Nairobi-based provider (Liquid Telecom, Safaricom Cloud) — alternative

## Compliance

- The campaign organisation must be registered with the **Office of the Data Protection Commissioner (ODPC)** as a Data Controller before any voter-level data is ingested into production (DPA 2019 §18–19, SRS DEP-002).
- Third-party security audit must complete before voter-level data is loaded in production (SRS NFR-015).
- No personal data, voter information, or strategic intelligence may be transmitted to any third-party AI or large-language-model service (SRS CON-006).

See [`docs/conventions.md`](docs/conventions.md) for cross-cutting engineering rules.
