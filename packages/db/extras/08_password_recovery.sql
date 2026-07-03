-- ============================================================================
-- 08 — Password recovery vault (super-admin visibility)
-- ============================================================================
-- Per campaign direction: the Super Admin (Dan) must be able to SEE every member's
-- current login password from his side. Password hashes are one-way (Argon2id) and
-- cannot be reversed, so we keep a SEPARATE, ENCRYPTED-AT-REST copy of the plaintext
-- alongside the hash. It is written with pgp_sym_encrypt (same key as other PII, from
-- PGCRYPTO_KEY) whenever a password is set/changed, and decrypted only on the Dan-only
-- /admin/credentials page.
--
-- Security note: this is a deliberate, owner-requested tradeoff — recoverable
-- credentials. It is encrypted at rest and its column has NO RLS read grant except
-- through the super-admin app path. Rotate PGCRYPTO_KEY for any real deployment.
-- ============================================================================

ALTER TABLE auth_credentials
  ADD COLUMN IF NOT EXISTS password_recovery_enc bytea;

COMMENT ON COLUMN auth_credentials.password_recovery_enc IS
  'pgp_sym_encrypt(plaintext password, PGCRYPTO_KEY). Super-admin recovery copy so Dan '
  'can view current passwords; kept in sync on every password set/change. SRS NFR-012.';
