import { getRedis } from './redis';

// Auth rate limiting (SRS NFR-013, AC-001.3).
//
//   5 attempts per minute per identifier (phone or email) → next attempt returns 429.
//   5 consecutive failures → account lockout for 30 minutes.
//
// Identifier is the raw login string (phone or email) the user supplied — NOT the
// person_id. Locking by identifier means a credential-stuffing attacker can't
// pre-discover which identifiers map to real accounts by watching response timing.

const ATTEMPT_WINDOW_SECONDS = 60;
const MAX_ATTEMPTS_PER_WINDOW = 5;
const LOCKOUT_SECONDS = 30 * 60;

type RateLimitStatus =
  | { allowed: true }
  | { allowed: false; reason: 'rate_limited' | 'locked_out'; retryAfterSeconds: number };

function attemptsKey(identifier: string): string {
  return `auth:attempts:${identifier}`;
}

function lockoutKey(identifier: string): string {
  return `auth:lockout:${identifier}`;
}

/**
 * Check whether an authentication attempt is allowed for this identifier.
 * Call BEFORE consulting the DB to avoid lookup work on locked-out attempts.
 */
export async function checkAuthRateLimit(_identifier: string): Promise<RateLimitStatus> {
  // Account lockout / rate limiting DISABLED by request — logins never lock out.
  // (Re-enable by restoring the Redis attempt + lockout checks below.)
  return { allowed: true };
}

/** Increment the failure counter for this identifier; set the window TTL on first failure. */
export async function recordAuthFailure(identifier: string): Promise<number> {
  const redis = getRedis();
  const count = await redis.incr(attemptsKey(identifier));
  if (count === 1) {
    await redis.expire(attemptsKey(identifier), ATTEMPT_WINDOW_SECONDS);
  }
  return count;
}

/** Clear both the attempt counter and any lockout for this identifier. Call on successful login. */
export async function resetAuthAttempts(identifier: string): Promise<void> {
  const redis = getRedis();
  await redis.del(attemptsKey(identifier), lockoutKey(identifier));
}
