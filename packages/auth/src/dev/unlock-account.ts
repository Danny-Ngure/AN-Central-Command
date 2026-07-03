// IMPORTANT: env-bootstrap first so dotenv runs before @an/db reads DATABASE_URL.
import './env-bootstrap';

import { getRedis } from '../redis';
import { authCredentials, db } from '@an/db';

// Clears auth lockouts so you can try logging in again immediately.
//
//   node <tsx> packages/auth/src/dev/unlock-account.ts            → clears ALL lockouts
//   node <tsx> packages/auth/src/dev/unlock-account.ts ADMIN001   → clears just that identifier
//
// It clears BOTH the Redis rate-limit lock (auth:lockout:* / auth:attempts:*) and the
// DB lockout columns (failed_login_attempts / locked_until).

async function main() {
  const redis = getRedis();
  const target = process.argv[2];

  if (target) {
    await redis.del(`auth:attempts:${target}`, `auth:lockout:${target}`);
    console.log(`✓ Cleared Redis lockout for "${target}".`);
  } else {
    const keys = [...(await redis.keys('auth:lockout:*')), ...(await redis.keys('auth:attempts:*'))];
    if (keys.length > 0) await redis.del(...keys);
    console.log(`✓ Cleared ${keys.length} Redis lockout/attempt keys.`);
  }

  // Belt & suspenders: clear DB-level lockout on every credential.
  await db.update(authCredentials).set({ failedLoginAttempts: 0, lockedUntil: null });
  console.log('✓ Cleared DB lockouts (failed_login_attempts = 0, locked_until = null).');

  await redis.quit();
  console.log('Done — you can try logging in again now.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to unlock:', err);
    process.exit(1);
  });
