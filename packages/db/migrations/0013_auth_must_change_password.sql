-- Force users off the default password (their National ID) on first login.
-- must_change_password is set true when credentials are seeded/reset to the ID
-- default, and cleared to false when the user changes their password.
ALTER TABLE auth_credentials
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
