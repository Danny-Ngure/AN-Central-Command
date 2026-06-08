import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { auditLog, people } from '@an/db';
import { withRlsTx } from '@/lib/api';
import { getServerAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

// POST /api/team/[id]/photo  (multipart/form-data)
//
// Saves the uploaded picture to apps/web/public/team-photos/<id>.<ext> and
// updates the person's photo_url. Inline upload form on the team directory
// posts here; the redirect returns to the referer.
//
// Constraints:
//   - JPG / PNG / WebP only
//   - Max 5 MiB
//   - Stable filename so caches invalidate via the ?v=<updatedAt> query string
//     used by the renderer.

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

const MAX_BYTES = 5 * 1024 * 1024;

const PHOTO_DIR = path.join(process.cwd(), 'public', 'team-photos');

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const claims = await getServerAuth();
  if (!claims) return NextResponse.redirect(new URL('/login', req.url));

  const personId = params.id;

  const form = await req.formData();
  const file = form.get('photo');
  if (!file || typeof file === 'string') {
    return back(req, 'No file uploaded');
  }
  const blob = file as Blob & { type?: string; name?: string };
  const ext = ALLOWED_MIME[blob.type ?? ''];
  if (!ext) {
    return back(req, 'Unsupported format — use JPG, PNG, or WebP');
  }
  if (blob.size > MAX_BYTES) {
    return back(req, `File exceeds ${MAX_BYTES / 1024 / 1024} MiB`);
  }

  // Ensure dir exists, drop any previous file (different ext) for this person.
  await fs.mkdir(PHOTO_DIR, { recursive: true });
  for (const oldExt of Object.values(ALLOWED_MIME)) {
    if (oldExt === ext) continue;
    const oldFile = path.join(PHOTO_DIR, `${personId}.${oldExt}`);
    try { await fs.unlink(oldFile); } catch { /* not there */ }
  }

  const filename = `${personId}.${ext}`;
  const buf = Buffer.from(await blob.arrayBuffer());
  await fs.writeFile(path.join(PHOTO_DIR, filename), buf);

  // The renderer appends ?v=<updatedAt timestamp> to bust the browser cache.
  const photoUrl = `/team-photos/${filename}`;

  await withRlsTx(claims, async (tx) => {
    await tx
      .update(people)
      .set({ photoUrl, updatedAt: new Date() })
      .where(eq(people.id, personId));

    await tx.insert(auditLog).values({
      actorPersonId: claims.sub,
      actorRole: claims.role,
      action: 'UPDATE_TEAM_PHOTO',
      entityType: 'person',
      entityId: personId,
      afterValue: { photo_url: photoUrl, byte_size: blob.size, mime: blob.type },
      context: { source: 'team_directory_ui' },
    });
  });

  const referer = req.headers.get('referer');
  return NextResponse.redirect(referer ?? new URL('/team', req.url));
}

function back(req: NextRequest, msg: string): NextResponse {
  const referer = req.headers.get('referer') ?? new URL('/team', req.url).toString();
  const url = new URL(referer);
  url.searchParams.set('photoError', msg);
  return NextResponse.redirect(url);
}
