import { sql, eq } from 'drizzle-orm';
import { auditLog, pollingStations, voters, wards } from '@an/db';
import type { SessionClaims } from '@an/auth';

// Smart polling-station deduplication — shared between:
//   - POST /api/polling-stations/dedup (user-triggered)
//   - POST /api/data-import/commit  (auto-run after every voter import)
//
// Per ward:
//   1. Identify "empty" stations (0 voters).
//   2. For each empty, find best token-Jaccard match among populated stations.
//   3. If max similarity ≥ 0.6, MERGE: transfer voters to empty, update its name
//      to the canonical (populated) name, recompute registered_voters, delete the
//      populated row. The empty's IEBC code + turnout history are preserved.
//   4. Empty stations with no match → delete.
//
// Why merge INTO the empty (seed) station: the empty usually has the canonical
// IEBC code (e.g. 028-031) and the historical turnout %s. Auto-created stations
// have md5-hashed codes and no history. Merging this direction preserves the
// useful metadata; the URLs derived from the seed UUID also keep working.

const SIMILARITY_THRESHOLD = 0.6;

export interface DedupResult {
  merged: number;
  deleted: number;
  perWard: Array<{
    wardId: string;
    wardName: string;
    merged: number;
    deleted: number;
    merges: Array<{ kept: string; absorbed: string; movedVoters: number }>;
    deletions: Array<{ name: string; code: string }>;
  }>;
}

/**
 * Run the smart merge for the given ward IDs. If `wardIds` is undefined, sweep
 * every ward in the system. Returns counts + per-ward breakdown for audit logging.
 *
 * @param tx       — an open Drizzle transaction (caller controls commit/rollback)
 * @param wardIds  — restrict the sweep to these wards; undefined = all wards
 */
export async function dedupStations(
  tx: any,
  wardIds?: string[],
): Promise<DedupResult> {
  const result: DedupResult = { merged: 0, deleted: 0, perWard: [] };

  const wardRows = wardIds && wardIds.length > 0
    ? await tx.select({ id: wards.id, name: wards.name })
        .from(wards)
        .where(sql`${wards.id} = ANY(${wardIds})`)
    : await tx.select({ id: wards.id, name: wards.name }).from(wards);

  for (const w of wardRows) {
    const merges: DedupResult['perWard'][number]['merges'] = [];
    const deletions: DedupResult['perWard'][number]['deletions'] = [];

    const stationsRaw = await tx
      .select({
        id: pollingStations.id,
        name: pollingStations.name,
        iebcCode: pollingStations.iebcCode,
      })
      .from(pollingStations)
      .where(eq(pollingStations.wardId, w.id));

    const counts = await tx
      .select({ pid: voters.pollingStationId, c: sql<number>`count(*)::int` })
      .from(voters)
      .where(eq(voters.wardId, w.id))
      .groupBy(voters.pollingStationId);
    const countMap = new Map<string, number>();
    for (const r of counts) if (r.pid) countMap.set(r.pid, r.c);

    type StationRow = { id: string; name: string; iebcCode: string };
    const populated: StationRow[] = [];
    const empty: StationRow[] = [];
    for (const s of stationsRaw) {
      (countMap.get(s.id) ?? 0) > 0 ? populated.push(s) : empty.push(s);
    }

    if (empty.length === 0) continue;

    const claimed = new Set<string>();
    for (const orphan of empty) {
      let bestMatch: StationRow | null = null;
      let bestScore = 0;
      for (const p of populated) {
        if (claimed.has(p.id)) continue;
        const score = tokenSimilarity(orphan.name, p.name);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = p;
        }
      }

      if (bestMatch && bestScore >= SIMILARITY_THRESHOLD) {
        const populatedId = bestMatch.id;
        const orphanId = orphan.id;
        const canonicalName = bestMatch.name;

        const moved = await tx
          .update(voters)
          .set({ pollingStationId: orphanId, updatedAt: new Date() })
          .where(eq(voters.pollingStationId, populatedId))
          .returning({ id: voters.id });

        await tx
          .update(pollingStations)
          .set({
            name: canonicalName,
            registeredVoters: moved.length,
            updatedAt: new Date(),
          })
          .where(eq(pollingStations.id, orphanId));

        await tx.delete(pollingStations).where(eq(pollingStations.id, populatedId));

        claimed.add(populatedId);
        result.merged++;
        merges.push({
          kept: `${canonicalName} (${orphan.iebcCode})`,
          absorbed: `${bestMatch.name} (${bestMatch.iebcCode})`,
          movedVoters: moved.length,
        });
      } else {
        // No fuzzy match — empty stale station, delete.
        await tx.delete(pollingStations).where(eq(pollingStations.id, orphan.id));
        result.deleted++;
        deletions.push({ name: orphan.name, code: orphan.iebcCode });
      }
    }

    if (merges.length > 0 || deletions.length > 0) {
      result.perWard.push({
        wardId: w.id,
        wardName: w.name,
        merged: merges.length,
        deleted: deletions.length,
        merges,
        deletions,
      });
    }
  }

  return result;
}

/**
 * Convenience wrapper: dedup + write an audit log row in the same tx.
 */
export async function dedupStationsWithAudit(
  tx: any,
  claims: SessionClaims,
  opts: {
    wardIds?: string[];
    source: string;      // 'ward_detail_ui' | 'wards_index_ui' | 'voter_import_auto'
  },
): Promise<DedupResult> {
  const result = await dedupStations(tx, opts.wardIds);
  if (result.merged > 0 || result.deleted > 0) {
    await tx.insert(auditLog).values({
      actorPersonId: claims.sub,
      actorRole: claims.role,
      action: opts.wardIds && opts.wardIds.length === 1
        ? 'DEDUP_POLLING_STATIONS'
        : 'DEDUP_POLLING_STATIONS_CONSTITUENCY',
      entityType: 'polling_station',
      entityId: null,
      afterValue: {
        scope: opts.wardIds && opts.wardIds.length === 1 ? 'single_ward' : 'multi_ward',
        wardIds: opts.wardIds ?? null,
        totalMerged: result.merged,
        totalDeleted: result.deleted,
        perWard: result.perWard,
      },
      context: {
        source: opts.source,
        threshold: SIMILARITY_THRESHOLD,
      },
    });
  }
  return result;
}

// ---- internals -------------------------------------------------------------

function tokenSimilarity(a: string, b: string): number {
  const ta = tokenise(a);
  const tb = tokenise(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size);
}

function tokenise(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}
