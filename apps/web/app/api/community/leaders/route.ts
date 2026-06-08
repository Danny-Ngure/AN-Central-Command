import { NextRequest } from 'next/server';
import { communityLeaders } from '@an/db';
import { err, ok, withAuth, withRlsTx } from '@/lib/api';

export const runtime = 'nodejs';

// POST /api/community/leaders — add a community leader (chief, village elder, etc.).
//
// Required: fullName, phone, roleTitle (the kind of leader), wardId, villageId.
// ownedByPersonId is forced to the caller (BR-020.1 — every leader has an owner).
// Canvasser submissions enter the review queue (AC-020.2); leadership/ward roles
// are inserted live. RLS (leaders_insert_ward) enforces who may write where.

interface Body {
  fullName?: string;
  phone?: string;
  roleTitle?: string;
  wardId?: string;
  villageId?: string;
}

export const POST = withAuth(async (req: NextRequest, { claims }) => {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return err('BAD_REQUEST', 'Body must be JSON', 400);
  }

  const fullName = (body.fullName ?? '').trim();
  const phone = (body.phone ?? '').trim();
  const roleTitle = (body.roleTitle ?? '').trim();

  if (!fullName) return err('LEADER_NAME_REQUIRED', 'Name is required', 400);
  if (!phone) return err('LEADER_PHONE_REQUIRED', 'Phone number is required', 400);
  if (!roleTitle) return err('LEADER_ROLE_REQUIRED', 'Role (e.g. Chief, Village Elder) is required', 400);
  if (!body.wardId) return err('LEADER_WARD_REQUIRED', 'A ward is required', 400);
  if (!body.villageId) return err('LEADER_VILLAGE_REQUIRED', 'A village is required', 400);

  const isCanvasser = claims.role === 'canvasser';

  try {
    const inserted = await withRlsTx(claims, async (tx) =>
      tx
        .insert(communityLeaders)
        .values({
          fullName,
          phone,
          roleTitle,
          wardId: body.wardId!,
          villageId: body.villageId!,
          ownedByPersonId: claims.sub,
          // Canvasser-submitted leaders queue for ward-coordinator review.
          isQueuedForReview: isCanvasser,
        })
        .returning({ id: communityLeaders.id, fullName: communityLeaders.fullName }),
    );
    return ok({ leader: inserted[0], queued: isCanvasser });
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes('community_leaders_village') || msg.includes('foreign key')) {
      return err('LEADER_BAD_VILLAGE', 'That village does not belong to the selected ward.', 400);
    }
    return err('LEADER_INSERT_DENIED', 'Could not add leader — you may not have permission for this ward.', 403);
  }
});
