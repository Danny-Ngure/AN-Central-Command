import { hash, verify } from '@node-rs/argon2';

// Argon2id password hashing (SRS FR-001, ARC §7).
//
// Parameters follow OWASP Password Storage Cheat Sheet (Argon2id recommended baseline):
//   memoryCost: 19 MiB
//   timeCost:   2 iterations
//   parallelism: 1
//
// These tuned to ~50ms on a modern server. Increase memoryCost first when revisiting.
//
// Storage format: encoded string (algorithm + params + salt + hash) — verify() reads
// it back without needing to know the parameters separately.

const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Hash a plaintext password. Returns the full encoded `$argon2id$...` string. */
export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 12) {
    // SRS BR-001.1: minimum 12 chars. Enforce at the boundary; API layer also validates.
    throw new Error('Password must be at least 12 characters');
  }
  return hash(plain, ARGON2_OPTIONS);
}

/**
 * Hash a SYSTEM-ASSIGNED default password (e.g. a person's National ID) that may be
 * shorter than the BR-001.1 12-char minimum. Only for initial credential setup — the
 * user is expected to change it to a compliant password on first login. Never use
 * this for user-chosen passwords (use hashPassword, which enforces the minimum).
 */
export async function hashDefaultPassword(plain: string): Promise<string> {
  if (!plain) throw new Error('Default password cannot be empty');
  return hash(plain, ARGON2_OPTIONS);
}

/**
 * Verify a plaintext password against a stored hash. Constant-time on success and
 * failure paths; safe to expose timing differences are not a leak.
 */
export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    // Malformed hash, wrong algorithm, etc. — treat as a failed verification.
    return false;
  }
}
