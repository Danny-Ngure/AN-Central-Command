# Engineering conventions

These rules shape every phase of the build. They are derived from the SRS and ARC; where this document and the SRS disagree, **the SRS is authoritative**.

Codify these in code review checklists, CI gates, and ESLint custom rules where feasible.

## API surface

- **Response envelope.** Every API endpoint returns `{ success: boolean, data?: any, error?: { code: string, message: string } }` (SRS §5.3). Never bare data, never bare errors.
- **Datetimes.** ISO 8601 in UTC over the wire. Clients render in user-local time (SRS §5.3).
- **Identifiers.** UUIDv7 — sortable, generated client-side on mobile for idempotency (SRS §5.3). Use the same UUID on retry; the server uses `ON CONFLICT DO NOTHING`.
- **Pagination.** Cursor-based opaque tokens, not offset+limit. Stable as data grows (SRS §5.3).
- **Webhooks.** Outbound webhook payloads are signed with HMAC-SHA256. Inbound webhook handlers verify the signature before processing (SRS §5.3, ARC §9).
- **Status codes.** Standard semantics, with one critical exception:
  - **404 (not 403) on unauthorized reads of supporter records** — avoids confirming the existence of a sensitive record to a probing attacker (SRS FR-130 ERR-130.2).
  - Account locked returns **423** with retry-after timestamp (SRS FR-001 ERR-001.2).
  - Auth missing TOTP returns **401** with code `AUTH_2FA_REQUIRED` (SRS FR-001 ERR-001.3).

## Database & audit

- **Append-only audit log.** The `audit_log` table is protected by a Postgres trigger that denies UPDATE and DELETE for every role except `admin_audit` (SRS NFR-050). The audit guarantee does not depend on application code remembering to call an audit function.
- **Audit triggers on writable tables.** Every writable table has an INSERT/UPDATE/DELETE trigger that automatically writes to `audit_log`. Application-level audit calls are belt-and-braces, never the only path.
- **Transactional audit.** Every mutation runs inside a Drizzle transaction that includes the audit log insert. If the audit insert fails, the mutation rolls back (ARC §10 supporter pattern).
- **Encrypted columns.** `people.national_id`, `community_leaders.sensitive_notes`, `auth_credentials.totp_secret`, `opposition_candidates.strategic_notes` are pgcrypto-encrypted at the column level (SRS NFR-012). Keys via cloud KMS, not in the database.
- **RLS, always.** Row-level security policies enforce authorization at the database level for every table (SRS FR-002). The application layer is a second line of defence, not the first. Tests must include direct-SQL queries with forged JWT roles to confirm RLS holds when the API is bypassed.
- **Soft delete is the default.** Hard delete is reserved for DPA §26 erasure requests, which anonymise PII fields rather than fully removing the row (SRS FR-134).

## Authentication & rate limiting

- **Passwords** hashed with Argon2id, never MD5 / SHA1 / bcrypt (ARC §7).
- **2FA mandatory** for `campaign_manager`, `chief_strategist`, `constituency_coordinator`, `ward_coordinator`, `assistant_ward_coordinator`, `polling_station_lead`, `tech_lead`, `admin` (SRS FR-001 BR-001.2). TOTP secret encrypted with pgcrypto.
- **Rate limits** (SRS NFR-013, NFR-014):
  - Auth: 5 attempts per minute per phone/email. 5 consecutive failures → 30-minute lockout.
  - API: 60 requests per minute per user. 1,000 requests per minute per IP.
- **Session expiry:** 24h web, 7d mobile (SRS BR-001.3).
- **Don't leak which credential was wrong.** Invalid username and invalid password return the same `AUTH_INVALID_CREDENTIALS` error (SRS FR-001 ERR-001.1).

## Localization

- Every user-facing string goes through `t('namespace.key')`. New keys require **both** `en` and `sw` entries — a missing translation falls back to returning the key, which makes the omission visible in the UI.
- Translation source of truth: `packages/i18n`.
- Swahili-native speaker review before each major release (SRS NFR-031).

## Offline & sync (mobile)

- **24-hour offline floor.** The Field App and NyaliTrack must function for 24 hours offline before requiring a sync (SRS CON-008).
- **Local SQLite + Drizzle.** Same ORM as the server. Schema kept in sync.
- **Idempotency.** Client generates UUIDv7 for every mutation. Server uses `ON CONFLICT DO NOTHING`. The same submission retried any number of times produces exactly one row.
- **Exponential backoff** on sync retry, max 5 attempts, then surface to the user via in-app banner (SRS ERR-100.1).
- **Conflict resolution** on mutable entities: last-write-wins. Append-only event records (visits, reports) never conflict.
- **Never store the full voter register on a device** (SRS CON-009). Voter lookups are on-demand and individually audit-logged.

## Logging

- **PII redaction in application logs** — never log phone numbers, national IDs, voter IDs, passwords, TOTP secrets. Use user UUIDs (SRS NFR-052). Enforced by a CI grep gate.
- **Structured JSON logs.** Centralised in CloudWatch / Loki / equivalent (SRS NFR-051).
- **Retention.** Audit logs: 7 years. Application logs: 90 days (SRS NFR-051).

## Hard constraints — never violate

- **Never transmit personal data, voter records, or strategic intelligence to any third-party AI or LLM service** (SRS CON-006, NFR-016). No OpenAI / Anthropic / Google Generative AI / Cohere SDKs in the production codebase. Enforced by a CI grep gate on the production branch.
- **Never store personal data of Kenyan citizens outside Africa** (SRS CON-001, DPA §50). Production hosting is AWS Cape Town or a Kenyan provider.
- **Never push source code to a public repository** (SRS CON-007).
- **Never skip the consent capture step** before creating a `committed_supporters` record (SRS BR-130.1). Local mobile validation refuses to even queue the submission.
- **Never aggregate ethnic-composition data below ward level** (SRS AC-071.1).
- **Never store individual boda-boda rider records.** Track stages, chairmen, and rider counts only (SRS FR-022).

## Programs that include cash transfers in exchange for votes

Prohibited by Kenyan election law. **Not recorded** in this system (SRS BR-131.1). The platform is not a tool for documenting electoral offences.
