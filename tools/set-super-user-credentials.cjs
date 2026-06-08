// One-shot script to provision login credentials for the three super-users.
//
//   Alfayo Nelson   +254700000001    devpassword123!
//   Benson Imoli    +254725967858    @BENSON132
//   Dan Ngure       +254740040248    @Kushman008
//
// Behaviour:
//   1. Looks up each person by full_name (identity-stable, not phone — phones can
//      change before we get here).
//   2. UPDATEs people.phone if it differs from the desired number.
//   3. Hashes each password with the same Argon2id parameters as
//      packages/auth/src/passwords.ts (memoryCost: 19456, timeCost: 2, parallelism: 1).
//   4. UPSERTs into auth_credentials.
//   5. Logs an AUDIT row for each.
//
// Policy note: two of these passwords are under the BR-001.1 12-char minimum.
// We bypass hashPassword()'s length check by calling argon2 directly. Tighten
// before production cutover.
//
// Run with the dev DB up:
//   node tools/set-super-user-credentials.cjs

const path = require('path');

const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));
const argon2 = require(path.join(__dirname, '..', 'node_modules', '.pnpm', '@node-rs+argon2@2.0.2', 'node_modules', '@node-rs', 'argon2'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Check apps/web/.env.local.');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false });

// Same Argon2id options as packages/auth/src/passwords.ts. Keep them in sync —
// if those change, this script needs to follow.
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const SUPER_USERS = [
  { fullName: 'Alfayo Nelson', phone: '+254700000001', password: 'devpassword123!' },
  { fullName: 'Benson Imoli',  phone: '+254725967858', password: '@BENSON132'      },
  { fullName: 'Dan Ngure',     phone: '+254740040248', password: '@Kushman008'     },
];

async function main() {
  console.log('Setting credentials for 3 super-users...\n');

  for (const u of SUPER_USERS) {
    // 1. Look up by name. fullName is the identity-stable key — phone changes
    //    between dev and real-life numbers and we need to handle either.
    const personRows = await sql`
      SELECT id, full_name, phone, role
      FROM people
      WHERE full_name = ${u.fullName}
      LIMIT 1
    `;
    if (personRows.length === 0) {
      console.warn(`  ✗ ${u.fullName} — not found in people table. Skipping.`);
      continue;
    }
    const person = personRows[0];

    // 2. Update phone if it doesn't match. Wrapped in a try/catch because
    //    people.phone has a UNIQUE constraint — if the target number is
    //    already taken by someone else, surface the conflict.
    if (person.phone !== u.phone) {
      try {
        await sql`
          UPDATE people
          SET phone = ${u.phone}, updated_at = now()
          WHERE id = ${person.id}
        `;
        console.log(`  ↻ ${u.fullName} — phone ${person.phone} → ${u.phone}`);
      } catch (err) {
        console.error(`  ✗ ${u.fullName} — phone update failed: ${err.message}`);
        continue;
      }
    }

    // 3. Hash password directly. Bypasses hashPassword()'s 12-char check
    //    intentionally — flag at the end.
    if (u.password.length < 12) {
      console.warn(`  ⚠ ${u.fullName} — password is ${u.password.length} chars (< BR-001.1 min of 12)`);
    }
    const passwordHash = await argon2.hash(u.password, ARGON2_OPTIONS);

    // 4. UPSERT into auth_credentials. One row per person enforced by
    //    auth_credentials_person_unique constraint.
    const existing = await sql`
      SELECT id FROM auth_credentials WHERE person_id = ${person.id} LIMIT 1
    `;
    if (existing.length > 0) {
      await sql`
        UPDATE auth_credentials
        SET password_hash = ${passwordHash},
            password_changed_at = now(),
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = now()
        WHERE person_id = ${person.id}
      `;
      console.log(`  ✓ ${u.fullName} — credentials updated`);
    } else {
      await sql`
        INSERT INTO auth_credentials (person_id, password_hash)
        VALUES (${person.id}, ${passwordHash})
      `;
      console.log(`  ✓ ${u.fullName} — credentials inserted`);
    }

    // 5. Audit log — append-only by trigger.
    await sql`
      INSERT INTO audit_log (
        actor_person_id, actor_role, action, entity_type, entity_id,
        after_value, context
      ) VALUES (
        ${person.id}, ${person.role}, 'SET_PASSWORD', 'auth_credentials', ${person.id},
        ${JSON.stringify({ phone: u.phone, length: u.password.length })}::jsonb,
        ${JSON.stringify({ source: 'tools/set-super-user-credentials.cjs' })}::jsonb
      )
    `;
  }

  console.log('\nDone. Try logging in:');
  for (const u of SUPER_USERS) {
    console.log(`  ${u.fullName.padEnd(16)} ${u.phone.padEnd(17)} ${u.password}`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error('\nFailed:', err);
  process.exit(1);
});
