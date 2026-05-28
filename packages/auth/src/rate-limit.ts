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
export async function checkAuthRateLimit(identifier: string): Promise<RateLimitStatus> {
  const redis = getRedis();
  const lockoutTtl = await redis.ttl(lockoutKey(identifier));
  if (lockoutTtl > 0) {
    return { allowed: false, reason: 'locked_out', retryAfterSeconds: lockoutTtl };
  }
  const attempts = await redis.get(attemptsKey(identifier));
  const count = attempts ? parseInt(attempts, 10) : 0;
  if (count >= MAX_ATTEMPTS_PER_WINDOW) {
    // Promote rapid retry burst to a lockout (5 fails in 60 seconds → 30 min lock).
    await redis.set(lockoutKey(identifier), '1', 'EX', LOCKOUT_SECONDS);
    await redis.del(attemptsKey(identifier));
    return { allowed: false, reason: 'locked_out', retryAfterSeconds: LOCKOUT_SECONDS };
  }
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
