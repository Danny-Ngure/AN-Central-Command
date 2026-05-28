import { authenticator } from 'otplib';

// TOTP for two-factor authentication (SRS FR-001, FR-004 for mobile biometric pairing).
//
// Mandatory for the following roles (BR-001.2):
//   campaign_manager, chief_strategist, constituency_coordinator,
//   ward_coordinator, assistant_ward_coordinator, polling_station_lead, tech_lead, admin.
//
// Compatible with Google Authenticator, Authy, 1Password, Bitwarden, etc.

// Defaults: 30-second step, ±1 step window (clock drift tolerance), 6-digit code.
authenticator.options = {
  step: 30,
  window: 1,
  digits: 6,
};

export interface TotpEnrollment {
  /** base32-encoded secret. Store ENCRYPTED via pgcrypto (NFR-012). */
  secret: string;
  /** otpauth:// URL for QR code rendering on the enrollment screen. */
  otpauthUrl: string;
}

/**
 * Generate a fresh TOTP secret + the URL the user scans to enroll in their
 * authenticator app.
 *
 * @param accountName Usually the user's phone number or email (visible in their app).
 * @param issuer Service name shown in the authenticator app.
 */
export function generateTotpSecret(
  accountName: string,
  issuer = 'AN Central Command',
): TotpEnrollment {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(accountName, issuer, secret);
  return { secret, otpauthUrl };
}

/**
 * Verify a 6-digit code against a secret. Accepts codes from the current 30-second
 * window or ±1 step (handles client clock drift up to ~60 seconds either side).
 *
 * The secret must be already decrypted before calling — see app_decrypt() in @an/db.
 */
export function verifyTotp(secret: string, code: string): boolean {
  if (!secret || !code) return false;
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}
