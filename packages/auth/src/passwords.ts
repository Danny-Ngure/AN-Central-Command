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
