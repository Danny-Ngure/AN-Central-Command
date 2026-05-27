-- Database extensions required by the schema (SRS CON-003, NFR-012).
-- Runs automatically on first container start via /docker-entrypoint-initdb.d/.
--
-- postgis    — geometry types and spatial queries for ward/village/polling-station boundaries (FR-010).
-- pgcrypto   — column-level encryption for national_id, sensitive_notes, totp_secret, opposition strategic_notes (NFR-012).
-- uuid-ossp  — UUID helpers; the application uses UUIDv7 generated client-side (SRS §5.3) but server-side fallback is useful.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sealed-key role for the audit log (NFR-050).
-- The append-only trigger denies UPDATE/DELETE for every role except admin_audit.
-- In production this role's credentials are stored in cloud KMS, separate from the app DB user.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_audit') THEN
    CREATE ROLE admin_audit NOINHERIT;
  END IF;
END
$$;
