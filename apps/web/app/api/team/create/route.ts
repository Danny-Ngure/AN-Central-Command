import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { auditLog, db, people, wards } from '@an/db';
import { getServerAuth } from '@/lib/server-auth';
import { err, ok, type ErrorEnvelope, type SuccessEnvelope } from '@/lib/api';

export const runtime = 'nodejs';

// POST /api/team/create  (multipart/form-data)
//
// Single-entry counterpart to the bulk /data-import flow: add ONE team member,
// optionally with their photo, in one request. Fields:
//   fullName   — required
//   phone      — required (unique)
//   email      — optional
//   category   — 'executive' | 'technical' | 'ward' | 'warembo'  (which directory section)
//   role       — campaign_role enum; coerced to the category if mismatched
//   wardId     — required when category='ward', optional for 'warembo'
//   title      — optional free-text job title
//   photo      — optional image (JPG/PNG/WebP, ≤5 MiB)
//
// The category decides where the person surfaces on /team:
//   executive/technical → constituency-wide, no ward
//   ward                → listed under that ward (Rep / Asst Rep / member)
//   warembo             → Warembo wa Alfayo wing (title forced to include "Warembo"
//                         so the directory's isWarembo() picks them up)

const PRIVILEGED_ROLES = new Set([
  'candidate',
  'campaign_manager',
  'chief_strategist',
  'constituency_coordinator',
  'tech_lead',
]);

type Category = 'executive' | 'technical' | 'ward' | 'warembo';

const EXEC_ROLES = new Set([
  'candidate', 'campaign_manager', 'chief_strategist',
  'constituency_coordinator', 'patron_ceo', 'finance_lead', 'influence_liaison',
]);
const TECH_ROLES = new Set(['tech_lead', 'media_head', 'comms_head']);
const WARD_ROLES = new Set(['ward_coordinator', 'assistant_ward_coordinator', 'canvasser']);

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
};
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_DIR = path.join(process.cwd(), 'public', 'team-photos');

export async function POST(
  req: NextRequest,
): Promise<NextResponse<SuccessEnvelope<{ id: string; fullName: string }> | ErrorEnvelope>> {
  const claims = await getServerAuth();
  if (!claims) return err('AUTH_REQUIRED', 'Authentication required', 401);
  if (!PRIVILEGED_ROLES.has(claims.role)) {
    return err('AUTHZ_INSUFFICIENT_ROLE', 'Your role cannot add team members. Ask a campaign manager or tech lead.', 403);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err('TEAM_CREATE_BAD_BODY', 'Expected multipart/form-data', 400);
  }

  const fullName = String(form.get('fullName') ?? '').trim();
  const phone = normTeamPhone(String(form.get('phone') ?? ''));
  const emailRaw = String(form.get('email') ?? '').trim();
  const email = emailRaw || null;
  const category = String(form.get('category') ?? '') as Category;
  let role = String(form.get('role') ?? '').trim();
  const wardIdRaw = String(form.get('wardId') ?? '').trim();
  let title = String(form.get('title') ?? '').trim();

  if (!fullName) return err('TEAM_CREATE_NO_NAME', 'Full name is required', 400);
  if (!phone) return err('TEAM_CREATE_NO_PHONE', 'A valid phone number is required', 400);
  if (!['executive', 'technical', 'ward', 'warembo'].includes(category)) {
    return err('TEAM_CREATE_BAD_CATEGORY', 'Pick a category: Executive, Technical, Ward, or Warembo', 400);
  }

  // Coerce role to the chosen category and decide the ward.
  let wardId: string | null = null;
  if (category === 'executive') {
    if (!EXEC_ROLES.has(role)) role = 'campaign_manager';
  } else if (category === 'technical') {
    if (!TECH_ROLES.has(role)) role = 'tech_lead';
  } else if (category === 'ward') {
    if (!WARD_ROLES.has(role)) role = 'canvasser';
    if (!wardIdRaw) return err('TEAM_CREATE_NO_WARD', 'Select a ward for a ward member', 400);
    wardId = wardIdRaw;
  } else if (category === 'warembo') {
    role = 'influence_liaison';
    wardId = wardIdRaw || null;
    // Force the title to carry "Warembo" so the directory groups them correctly.
    title = title
      ? (/warembo/i.test(title) ? title : `${title} · Warembo wa Alfayo`)
      : 'Warembo wa Alfayo';
  }

  // Validate the ward exists, when one was supplied.
  if (wardId) {
    const w = await db.select({ id: wards.id }).from(wards).where(eq(wards.id, wardId)).limit(1);
    if (w.length === 0) return err('TEAM_CREATE_UNKNOWN_WARD', 'That ward does not exist', 400);
  }

  // Friendly duplicate-phone message instead of a raw unique-violation 500.
  const dup = await db.select({ id: people.id, fullName: people.fullName }).from(people).where(eq(people.phone, phone)).limit(1);
  if (dup.length > 0) {
    return err('TEAM_CREATE_DUPLICATE_PHONE', `That phone already belongs to ${dup[0]!.fullName}.`, 409);
  }

  // Optional photo — validated up-front so we don't create the person then fail.
  const photo = form.get('photo');
  let photoExt: string | null = null;
  let photoBuf: Buffer | null = null;
  if (photo && typeof photo !== 'string') {
    const blob = photo as Blob & { type?: string };
    const ext = ALLOWED_MIME[blob.type ?? ''];
    if (!ext) return err('TEAM_CREATE_BAD_PHOTO', 'Photo must be JPG, PNG, or WebP', 400);
    if (blob.size > MAX_PHOTO_BYTES) return err('TEAM_CREATE_PHOTO_TOO_LARGE', 'Photo exceeds 5 MiB', 413);
    photoExt = ext;
    photoBuf = Buffer.from(await blob.arrayBuffer());
  }

  // Insert (org-wide directory write — same direct-db access the /team reader uses).
  let personId: string;
  try {
    const inserted = await db
      .insert(people)
      .values({
        fullName,
        phone,
        email,
        role: role as any,
        title: title || null,
        wardId,
        active: true,
      })
      .returning({ id: people.id });
    personId = inserted[0]!.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique/i.test(msg) && /email/i.test(msg)) {
      return err('TEAM_CREATE_DUPLICATE_EMAIL', 'That email is already in use.', 409);
    }
    return err('TEAM_CREATE_FAILED', `Could not create member: ${msg}`, 500);
  }

  // Save the photo (if any) under the canonical <id>.<ext> name + link it.
  let photoUrl: string | null = null;
  if (photoBuf && photoExt) {
    try {
      await fs.mkdir(PHOTO_DIR, { recursive: true });
      const filename = `${personId}.${photoExt}`;
      await fs.writeFile(path.join(PHOTO_DIR, filename), photoBuf);
      photoUrl = `/team-photos/${filename}`;
      await db.update(people).set({ photoUrl, updatedAt: new Date() }).where(eq(people.id, personId));
    } catch {
      // Person is created; photo just didn't attach. Non-fatal — they can re-upload.
      photoUrl = null;
    }
  }

  await db.insert(auditLog).values({
    actorPersonId: claims.sub,
    actorRole: claims.role,
    action: 'CREATE_TEAM_MEMBER',
    entityType: 'person',
    entityId: personId,
    afterValue: { fullName, role, category, wardId, hasPhoto: !!photoUrl },
    context: { source: 'team_directory_ui' },
  });

  return ok({ id: personId, fullName });
}

// Normalise a Kenyan phone to +254XXXXXXXXX; pass through anything that doesn't fit.
function normTeamPhone(raw: string): string {
  let s = raw.trim().replace(/\s+/g, '');
  if (!s) return '';
  if (/^\+254[17]\d{8}$/.test(s)) return s;
  let d = s.replace(/^\+/, '');
  if (d.startsWith('254')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  if (/^[17]\d{8}$/.test(d)) return `+254${d}`;
  return s;
}
