import { Redis } from 'ioredis';

// Lazy-singleton Redis client. The first call constructs and caches it; subsequent
// calls return the same instance. Tests can reset it via __resetRedisForTesting().

let cached: Redis | null = null;

export function getRedis(): Redis {
  if (cached) return cached;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is required. See packages/auth/.env.example.');
  }
  cached = new Redis(url, {
    // Production: increase, retry strategy lives in the orchestrator.
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  return cached;
}

/** Test-only. Call between cases to force reconnection. */
export function __resetRedisForTesting(): void {
  cached?.disconnect();
  cached = null;
}
