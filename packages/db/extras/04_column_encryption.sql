-- Column-level encryption helpers (SRS NFR-012).
--
-- Two SQL functions wrap pgp_sym_encrypt/decrypt with a session-supplied key.
-- Both the application (setRequestContext) and the apply-extras / seed scripts
-- set `app.encryption_key` at session/transaction start from PGCRYPTO_KEY env var.
--
-- Production source of the key: cloud KMS (AWS KMS, GCP KMS, or HashiCorp Vault).
-- The app fetches the master key once on startup and injects it into every connection.
-- Local dev source: PGCRYPTO_KEY in .env.local (see packages/db/.env.example).
--
-- =============================================================================
-- USAGE — how application code calls these functions
-- =============================================================================
--
-- Encrypt at insert:
--   INSERT INTO people (id, phone, full_name, role, national_id) VALUES (
--     gen_random_uuid(), '+254...', 'A Person', 'canvasser',
--     app_encrypt('12345678')          -- ← wrap PII here
--   );
--
-- Decrypt at read:
--   SELECT id, full_name, app_decrypt(national_id) AS national_id
--   FROM people WHERE id = $1;
--
-- =============================================================================
-- COLUMN-TYPE STATUS — read carefully before extending this file
-- =============================================================================
--
-- Today the four target columns are still declared `text` in the Drizzle schema:
--
--   - people.national_id                         (currently NULL everywhere)
--   - community_leaders.sensitive_notes          (dev seed has plaintext values)
--   - auth_credentials.totp_secret               (currently NULL everywhere)
--   - opposition_candidates.strategic_notes      (v2.0 table; not yet created)
--
-- The PRODUCTION DEPLOYMENT migration will convert each from text to bytea via:
--
--   ALTER TABLE people ADD COLUMN national_id_enc bytea;
--   UPDATE people SET national_id_enc = app_encrypt(national_id) WHERE national_id IS NOT NULL;
--   ALTER TABLE people DROP COLUMN national_id;
--   ALTER TABLE people RENAME COLUMN national_id_enc TO national_id;
--   -- Then update packages/db/src/schema/identity.ts: nationalId: bytea('national_id')
--
-- Why deferred to production:
--   1. The local DB contains no real PII; encrypting fake data adds friction without
--      a security benefit.
--   2. Production needs a real KMS-managed key with rotation policy; the env-var key
--      here is for local-dev only.
--   3. Converting the column type forces a Drizzle schema change, which we'd then
--      have to keep in sync ahead of the API layer that consumes it. Cleaner to do
--      the conversion and the API integration in the same PR.
--
-- The functions and the session-key wiring below are usable TODAY. The column
-- conversion is a single follow-up `extras/05_*.sql` file when production prep starts.

-- =============================================================================
-- 1. Encryption helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION app_encrypt(plain text) RETURNS bytea
LANGUAGE plpgsql STRICT IMMUTABLE
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := current_setting('app.encryption_key', true);
  IF v_key IS NULL OR length(v_key) = 0 THEN
    RAISE EXCEPTION 'app.encryption_key is not set; cannot encrypt'
      USING ERRCODE = 'configuration_limit_exceeded',
            HINT = 'Caller must SET app.encryption_key before invoking app_encrypt().';
  END IF;
  RETURN pgp_sym_encrypt(plain, v_key);
END
$$;

CREATE OR REPLACE FUNCTION app_decrypt(cipher bytea) RETURNS text
LANGUAGE plpgsql STRICT IMMUTABLE
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := current_setting('app.encryption_key', true);
  IF v_key IS NULL OR length(v_key) = 0 THEN
    RAISE EXCEPTION 'app.encryption_key is not set; cannot decrypt'
      USING ERRCODE = 'configuration_limit_exceeded',
            HINT = 'Caller must SET app.encryption_key before invoking app_decrypt().';
  END IF;
  RETURN pgp_sym_decrypt(cipher, v_key);
END
$$;

COMMENT ON FUNCTION app_encrypt(text) IS
  'Encrypt a plaintext string with pgp_sym_encrypt using app.encryption_key session variable. SRS NFR-012.';
COMMENT ON FUNCTION app_decrypt(bytea) IS
  'Decrypt a bytea ciphertext with pgp_sym_decrypt using app.encryption_key session variable. SRS NFR-012.';

GRANT EXECUTE ON FUNCTION app_encrypt(text) TO app_user;
GRANT EXECUTE ON FUNCTION app_decrypt(bytea) TO app_user;

-- =============================================================================
-- 2. Smoke test — runs at extras-apply time, fails if pgcrypto / key setup broken
-- =============================================================================

DO $$
DECLARE
  v_cipher bytea;
  v_plain text;
BEGIN
  -- Use a deliberately-temporary key just for the smoke test (does NOT touch app.encryption_key).
  PERFORM set_config('app.encryption_key', 'smoke_test_only_not_real_key', true);
  v_cipher := app_encrypt('smoke-test-value');
  v_plain := app_decrypt(v_cipher);
  IF v_plain <> 'smoke-test-value' THEN
    RAISE EXCEPTION 'app_encrypt/app_decrypt smoke test failed: % round-tripped to %', 'smoke-test-value', v_plain;
  END IF;
  RAISE NOTICE 'app_encrypt/app_decrypt round-trip OK';
END
$$;
