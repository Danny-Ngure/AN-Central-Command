// One-off: set Irene Mkamburi's login credential to a chosen password.
import './env-bootstrap';

import { authCredentials, db } from '@an/db';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../passwords';

const PERSON_ID = 'bede8886-83c3-4c1b-89c5-a6f6fbad99d2'; // Irene Mkamburi
const PASSWORD = 'Bibiyatajiri';

async function main() {
  const hashed = await hashPassword(PASSWORD);
  const existing = await db
    .select({ id: authCredentials.id })
    .from(authCredentials)
    .where(eq(authCredentials.personId, PERSON_ID))
    .limit(1);

  if (existing.length > 0) {
    await db.update(authCredentials).set({ passwordHash: hashed }).where(eq(authCredentials.personId, PERSON_ID));
    console.log('UPDATED Irene credential');
  } else {
    await db.insert(authCredentials).values({ personId: PERSON_ID, passwordHash: hashed });
    console.log('INSERTED Irene credential');
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
