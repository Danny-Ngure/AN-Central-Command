import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { sql, eq } from 'drizzle-orm';
import { auditLog, communitySites, pollingStations, villages, voters, wards } from '@an/db';
import type { SessionClaims } from '@an/auth';
import { err, ok, withAuth, withRlsTx, type ErrorEnvelope, type SuccessEnvelope } from '@/lib/api';
import { ENTITY_FIELDS, parseUpload, parseSitesMultiSection, type EntityType } from '@/lib/import-parsers';
import { dedupStationsWithAudit } from '@/lib/dedup-stations';

export const runtime = 'nodejs';
// 84k-row voter files run ~5 min through the bulk-insert path; lift the route
// handler timeout above the 10s Edge default.
export const maxDuration = 600;

// POST /api/data-import/commit  (multipart/form-data)
//
// Form fields:
//   file          — the original file (Excel/CSV)
//   entityType    — 'polling_stations' | 'voters' | 'community_leaders' | 'sites'
//   mappings      — JSON-stringified Record<fieldName, sourceColumn | null>
//   filename      — original filename (for the audit row context)
//   forcedWardId  — optional ward id; when set, every row belongs to this ward
//
// Why multipart (not JSON)? The browser cannot ship 84k rows of voter data through
// Next.js's default JSON body parser (1MB cap) without chunking. Re-parsing the
// already-uploaded file server-side is cheap and avoids round-tripping the rows.
//
// Per-entity behaviour:
//   • voters            — bulk-INSERT in 500-row batches, after pre-creating any
//                          missing polling stations referenced in the file
//   • polling_stations  — per-row upsert (small volume, ~100 rows)
//   • sites             — per-row upsert (small volume)
//   • community_leaders — TBD next slice
//
// Every successful commit writes one row to audit_log summarising the batch
// (action='IMPORT_<ENTITY>', context contains filename + counters).

const PRIVILEGED_ROLES = new Set([
  'candidate',
  'campaign_manager',
  'chief_strategist',
  'constituency_coordinator',
  'tech_lead',
]);

const MAX_BYTES = 100 * 1024 * 1024; // 100 MiB

interface CommitInput {
  entityType: EntityType;
  mappings: Record<string, string | null>;
  filename: string;
  forcedWardId?: string;
  rows: Record<string, string>[];
}

export interface CommitResponse {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { rowIndex: number; reason: string }[];
  stationsAutoCreated?: number;
  stationsAutoMerged?: number;
  stationsAutoDeleted?: number;
}

export const POST = withAuth<CommitResponse>(async (req, { claims }) => {
  if (!PRIVILEGED_ROLES.has(claims.role)) {
    return err(
      'AUTHZ_INSUFFICIENT_ROLE',
      'Your role cannot import data. Ask a campaign manager or tech lead.',
      403,
    ) as NextResponse<ErrorEnvelope>;
  }

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    return err('IMPORT_BAD_CONTENT_TYPE', 'Expected multipart/form-data', 400) as NextResponse<ErrorEnvelope>;
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err('IMPORT_PARSE_FAILED', 'Could not parse multipart body', 400) as NextResponse<ErrorEnvelope>;
  }

  const file = form.get('file');
  const entityRaw = String(form.get('entityType') ?? '');
  const entityType = entityRaw as EntityType;
  const filename = String(form.get('filename') ?? 'upload.bin');
  const forcedWardIdRaw = form.get('forcedWardId');
  const forcedWardId = typeof forcedWardIdRaw === 'string' && forcedWardIdRaw ? forcedWardIdRaw : undefined;
  const mappingsRaw = String(form.get('mappings') ?? '');

  if (!(entityType in ENTITY_FIELDS)) {
    return err('IMPORT_BAD_ENTITY_TYPE', 'Unknown entityType', 400) as NextResponse<ErrorEnvelope>;
  }
  if (!file || typeof file === 'string') {
    return err('IMPORT_NO_FILE', 'No file uploaded under field "file"', 400) as NextResponse<ErrorEnvelope>;
  }
  const blob = file as Blob & { name?: string; type?: string };
  if (blob.size > MAX_BYTES) {
    return err('IMPORT_FILE_TOO_LARGE', `File exceeds ${MAX_BYTES / 1024 / 1024} MiB`, 413) as NextResponse<ErrorEnvelope>;
  }
  let mappings: Record<string, string | null>;
  try {
    mappings = JSON.parse(mappingsRaw) as Record<string, string | null>;
  } catch {
    return err('IMPORT_BAD_MAPPINGS', 'mappings must be valid JSON', 400) as NextResponse<ErrorEnvelope>;
  }

  // Re-parse the file with NO row cap. This is the bug fix — previously the client
  // sent back the 100-row preview slice and the import silently truncated.
  const buffer = Buffer.from(await blob.arrayBuffer());

  // Sites: try the multi-section coordinator-PDF parser first; fall back to standard.
  let parsed = entityType === 'sites'
    ? parseSitesMultiSection(buffer, filename, blob.type ?? null)
    : null;
  if (!parsed) {
    parsed = await parseUpload(buffer, filename, blob.type ?? null, { rowCap: Infinity });
  }
  if (!parsed.rows || parsed.rows.length === 0) {
    return err('IMPORT_NO_ROWS', 'File contains no data rows', 400) as NextResponse<ErrorEnvelope>;
  }

  // Validate required-field mappings (skipping wardName if a forcedWardId covers it).
  const spec = ENTITY_FIELDS[entityType];
  const sampleColumns = new Set(parsed.columns ?? []);
  const missing = spec
    .filter((f) => f.required)
    .filter((f) => !(forcedWardId && f.field === 'wardName'))
    .filter((f) => {
      const col = mappings[f.field];
      return !col || !sampleColumns.has(col);
    });
  if (missing.length > 0) {
    return err(
      'IMPORT_MISSING_REQUIRED_MAPPING',
      `Required fields not mapped: ${missing.map((m) => m.label).join(', ')}`,
      400,
    ) as NextResponse<ErrorEnvelope>;
  }

  const input: CommitInput = {
    entityType,
    mappings,
    filename,
    forcedWardId,
    rows: parsed.rows,
  };

  switch (entityType) {
    case 'polling_stations': return commitPollingStations(input, claims);
    case 'voters':           return commitVoters(input, claims);
    case 'sites':            return commitSites(input, claims);
    case 'community_leaders':
      return err(
        'IMPORT_NOT_IMPLEMENTED',
        'Community-leader import lands in the next slice.',
        501,
      ) as NextResponse<ErrorEnvelope>;
  }
});

// ---- polling stations -------------------------------------------------------

async function commitPollingStations(
  input: CommitInput,
  claims: SessionClaims,
): Promise<NextResponse<SuccessEnvelope<CommitResponse> | ErrorEnvelope>> {
  const { mappings: map, forcedWardId, filename, rows } = input;
  const result: CommitResponse = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  try {
    await withRlsTx(claims, async (tx) => {
      const wardByName = await buildWardLookup(tx);

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i]!;
        const get = (field: string): string =>
          (map[field] ? raw[map[field]!] ?? '' : '').trim();

        const iebcCodeRaw = get('iebcCode');
        const name = get('name');
        const wardNameRaw = get('wardName');
        const registeredVotersRaw = get('registeredVoters');

        if (!name) {
          result.errors.push({ rowIndex: i, reason: 'Missing station name' });
          continue;
        }
        let wardId: string | undefined;
        if (forcedWardId) {
          wardId = forcedWardId;
        } else {
          if (!wardNameRaw) {
            result.errors.push({ rowIndex: i, reason: 'Missing ward' });
            continue;
          }
          wardId = wardByName.get(normaliseName(wardNameRaw));
          if (!wardId) {
            result.errors.push({ rowIndex: i, reason: `Unknown ward: "${wardNameRaw}"` });
            continue;
          }
        }
        // IEBC code optional. If absent, generate the same `028-<md5>` code the voter
        // path uses so re-imports across both paths converge on a single station row.
        const iebcCode =
          iebcCodeRaw ||
          `028-${createHash('md5').update(`${wardId}|${normaliseName(name)}`).digest('hex').slice(0, 8)}`;
        // Registered voters optional. Voter-import auto-recompute writes the correct
        // count later; until then a missing value defaults to 0.
        let registeredVoters = 0;
        if (registeredVotersRaw) {
          const n = Number(registeredVotersRaw.replace(/[, ]/g, ''));
          if (!Number.isFinite(n) || n < 0) {
            result.errors.push({ rowIndex: i, reason: `Invalid registered voters: "${registeredVotersRaw}"` });
            continue;
          }
          registeredVoters = n;
        }

        const lng = parseOptionalNumber(get('longitude'));
        const lat = parseOptionalNumber(get('latitude'));
        if (lng !== null && lat !== null) {
          if (lng < 39.4 || lng > 40.1 || lat < -4.3 || lat > -3.7) {
            result.errors.push({ rowIndex: i, reason: `GPS outside Mombasa bbox (lng=${lng}, lat=${lat})` });
            continue;
          }
        }
        const turnout2022 = parsePercent(get('turnout2022'));
        const turnout2017 = parsePercent(get('turnout2017'));
        const turnout2013 = parsePercent(get('turnout2013'));
        const targetTurnout = parsePercent(get('targetTurnout'));

        const locationExpr =
          lng !== null && lat !== null
            ? sql`ST_GeomFromText('POINT(${sql.raw(String(lng))} ${sql.raw(String(lat))})', 4326)`
            : sql`(SELECT centroid FROM wards WHERE id = ${wardId}::uuid)`;

        const upsert = await tx
          .insert(pollingStations)
          .values({
            iebcCode,
            name,
            wardId,
            registeredVoters,
            location: locationExpr as any,
            turnout2013,
            turnout2017,
            turnout2022,
            targetTurnout,
          })
          .onConflictDoUpdate({
            target: pollingStations.iebcCode,
            set: {
              name: sql`excluded.name`,
              wardId: sql`excluded.ward_id`,
              registeredVoters: sql`excluded.registered_voters`,
              location: sql`excluded.location`,
              turnout2013: sql`excluded.turnout_2013`,
              turnout2017: sql`excluded.turnout_2017`,
              turnout2022: sql`excluded.turnout_2022`,
              targetTurnout: sql`excluded.target_turnout`,
              updatedAt: sql`now()`,
            },
          })
          .returning({ id: pollingStations.id, isNew: sql<boolean>`xmax = 0` });

        const row = upsert[0];
        if (!row) result.skipped++;
        else if (row.isNew) result.inserted++;
        else result.updated++;
      }

      await tx.insert(auditLog).values({
        actorPersonId: claims.sub,
        actorRole: claims.role,
        action: 'IMPORT_POLLING_STATIONS',
        entityType: 'polling_station',
        entityId: null,
        afterValue: {
          filename,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
          errorCount: result.errors.length,
        },
        context: { source: 'data_import_ui' },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err('IMPORT_TX_FAILED', `Transaction failed: ${msg}`, 500) as NextResponse<ErrorEnvelope>;
  }

  return ok(result) as NextResponse<SuccessEnvelope<CommitResponse>>;
}

// ---- sites (mosques / churches / social halls) -----------------------------

async function commitSites(
  input: CommitInput,
  claims: SessionClaims,
): Promise<NextResponse<SuccessEnvelope<CommitResponse> | ErrorEnvelope>> {
  const { mappings: map, forcedWardId, filename, rows } = input;
  const result: CommitResponse = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  try {
    await withRlsTx(claims, async (tx) => {
      const wardByName = await buildWardLookup(tx);
      const villageRows = await tx.select({ id: villages.id, name: villages.name, wardId: villages.wardId }).from(villages);
      const villageByWardThenName = new Map<string, Map<string, string>>();
      for (const v of villageRows) {
        if (!villageByWardThenName.has(v.wardId)) villageByWardThenName.set(v.wardId, new Map());
        villageByWardThenName.get(v.wardId)!.set(normaliseName(v.name), v.id);
      }

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i]!;
        const get = (f: string): string => (map[f] ? raw[map[f]!] ?? '' : '').trim();

        const name = get('name');
        const typeRaw = get('type');
        const wardNameRaw = get('wardName');

        if (!name || !typeRaw) {
          result.errors.push({ rowIndex: i, reason: 'Missing required field' });
          continue;
        }
        let wardId: string | undefined;
        if (forcedWardId) {
          wardId = forcedWardId;
        } else {
          if (!wardNameRaw) {
            result.errors.push({ rowIndex: i, reason: 'Missing ward' });
            continue;
          }
          wardId = wardByName.get(normaliseName(wardNameRaw));
          if (!wardId) {
            result.errors.push({ rowIndex: i, reason: `Unknown ward: "${wardNameRaw}"` });
            continue;
          }
        }
        const type = normaliseSiteType(typeRaw);
        if (!type) {
          result.errors.push({ rowIndex: i, reason: `Unknown site type: "${typeRaw}"` });
          continue;
        }
        const villageNameRaw = get('villageName');
        const villageId = villageNameRaw
          ? (villageByWardThenName.get(wardId)?.get(normaliseName(villageNameRaw)) ?? null)
          : null;
        const lng = parseOptionalNumber(get('longitude'));
        const lat = parseOptionalNumber(get('latitude'));
        if (lng !== null && lat !== null) {
          if (lng < 39.4 || lng > 40.1 || lat < -4.3 || lat > -3.7) {
            result.errors.push({ rowIndex: i, reason: `GPS outside Mombasa bbox` });
            continue;
          }
        }
        const locationExpr =
          lng !== null && lat !== null
            ? sql`ST_GeomFromText('POINT(${sql.raw(String(lng))} ${sql.raw(String(lat))})', 4326)`
            : sql`(SELECT centroid FROM wards WHERE id = ${wardId}::uuid)`;

        const contactPhone = normalisePhone(get('contactPhone'));
        const estimatedSize = parseOptionalNumber(get('estimatedSize'));

        const existing = await tx
          .select({ id: communitySites.id })
          .from(communitySites)
          .where(sql`${communitySites.wardId} = ${wardId}::uuid AND lower(${communitySites.name}) = ${normaliseName(name)}`)
          .limit(1);

        if (existing.length > 0) {
          await tx
            .update(communitySites)
            .set({
              type: type as any,
              villageId: villageId ?? undefined,
              areaName: get('areaName') || undefined,
              contactPersonName: get('contactPersonName') || undefined,
              contactRole: get('contactRole') || undefined,
              contactPhone: contactPhone ?? undefined,
              estimatedSize: estimatedSize ?? undefined,
              updatedAt: new Date(),
            })
            .where(eq(communitySites.id, existing[0]!.id));
          result.updated++;
        } else {
          await tx.insert(communitySites).values({
            type: type as any,
            name,
            wardId,
            villageId: villageId ?? undefined,
            location: locationExpr as any,
            areaName: get('areaName') || null,
            contactPersonName: get('contactPersonName') || null,
            contactRole: get('contactRole') || null,
            contactPhone: contactPhone ?? null,
            estimatedSize: estimatedSize ?? null,
          });
          result.inserted++;
        }
      }

      await tx.insert(auditLog).values({
        actorPersonId: claims.sub,
        actorRole: claims.role,
        action: 'IMPORT_SITES',
        entityType: 'community_site',
        entityId: null,
        afterValue: {
          filename,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
          errorCount: result.errors.length,
        },
        context: { source: 'data_import_ui' },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err('IMPORT_TX_FAILED', `Transaction failed: ${msg}`, 500) as NextResponse<ErrorEnvelope>;
  }

  return ok(result) as NextResponse<SuccessEnvelope<CommitResponse>>;
}

// ---- voters — BULK INSERT path (84k+ rows) ---------------------------------

const VOTER_BATCH_SIZE = 500;

type NormalisedVoter = {
  voterNumber: string;
  nationalId: string | null;
  surname: string;
  firstName: string;
  dateOfBirth: string | null;
  gender: 'M' | 'F' | 'U';
  county: string;
  constituency: string;
  wardId: string;
  pollingStationId: string | null;
  // Cache lookup key for the row's polling station — used to re-resolve after the
  // bulk station-create step finishes. Format: `${wardId}|${normaliseName(name)}`.
  pollingStationKey: string | null;
  phone: string | null;
  phoneTail: string | null;
};

async function commitVoters(
  input: CommitInput,
  claims: SessionClaims,
): Promise<NextResponse<SuccessEnvelope<CommitResponse> | ErrorEnvelope>> {
  if (process.env.DPA_VOTER_INGEST_ENABLED !== 'true') {
    return err(
      'IMPORT_VOTER_INGEST_LOCKED',
      'Voter-register ingestion is locked. Set DPA_VOTER_INGEST_ENABLED=true in .env.local once the ODPC Data Controller registration (DEP-002), DPIA (COMP-008), and DPO confirmation (COMP-010) are filed in docs/compliance/.',
      403,
    ) as NextResponse<ErrorEnvelope>;
  }

  const { mappings: map, forcedWardId, filename, rows } = input;
  const result: CommitResponse = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  let stationsAutoCreated = 0;
  let autoMerged = 0;
  let autoDeleted = 0;
  const touchedStationIds = new Set<string>();

  try {
    await withRlsTx(claims, async (tx) => {
      const wardByName = await buildWardLookup(tx);

      const stationRows = await tx
        .select({ id: pollingStations.id, code: pollingStations.iebcCode, name: pollingStations.name, wardId: pollingStations.wardId })
        .from(pollingStations);
      const stationByCode = new Map(stationRows.map((s) => [s.code, s.id]));
      const stationByWardAndName = new Map<string, string>();
      for (const s of stationRows) {
        stationByWardAndName.set(`${s.wardId}|${normaliseName(s.name)}`, s.id);
      }

      // PASS 1: validate every row, collect normalised data + unique station keys
      const normalised: NormalisedVoter[] = [];
      const pendingStations = new Map<
        string,
        { wardId: string; name: string; code: string }
      >();

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i]!;
        const get = (f: string): string => (map[f] ? raw[map[f]!] ?? '' : '').trim();

        const explicitVoterNumber = get('voterNumber');
        const explicitNationalId = get('nationalId');
        const voterNumber = explicitVoterNumber || explicitNationalId;
        const surname = get('surname');
        const firstName = get('firstName');
        const wardNameRaw = get('wardName');

        if (!voterNumber || !surname || !firstName) {
          result.errors.push({
            rowIndex: i,
            reason: !voterNumber
              ? 'Missing voter ID — map either Voter Number or National ID'
              : 'Missing required field (surname / first name)',
          });
          continue;
        }

        let wardId: string | undefined;
        if (forcedWardId) {
          wardId = forcedWardId;
        } else {
          if (!wardNameRaw) {
            result.errors.push({ rowIndex: i, reason: 'Missing ward — use the per-ward upload page or map a Ward column' });
            continue;
          }
          wardId = wardByName.get(normaliseName(wardNameRaw));
          if (!wardId) {
            result.errors.push({ rowIndex: i, reason: `Unknown ward: "${wardNameRaw}"` });
            continue;
          }
        }

        const psCode = get('pollingStationCode');
        const psName = get('pollingStationName');
        let pollingStationId: string | null = null;
        let pollingStationKey: string | null = null;
        if (psCode) pollingStationId = stationByCode.get(psCode) ?? null;
        if (!pollingStationId && psName) {
          pollingStationKey = `${wardId}|${normaliseName(psName)}`;
          pollingStationId = stationByWardAndName.get(pollingStationKey) ?? null;
          if (!pollingStationId && !pendingStations.has(pollingStationKey)) {
            const hash = createHash('md5').update(pollingStationKey).digest('hex').slice(0, 8);
            pendingStations.set(pollingStationKey, {
              wardId,
              name: psName,
              code: `028-${hash}`,
            });
          }
        }

        const gender = normaliseGender(get('gender'));
        const dob = parseDateOnly(get('dateOfBirth'));
        const phoneRaw = get('phone');
        const phone = normalisePhone(phoneRaw);
        const phoneTail = phone ? phone.slice(-4) : null;

        normalised.push({
          voterNumber,
          nationalId: explicitNationalId || null,
          surname,
          firstName,
          dateOfBirth: dob,
          gender,
          county: get('county') || 'Mombasa',
          constituency: get('constituency') || 'Nyali',
          wardId,
          pollingStationId,
          pollingStationKey,
          phone,
          phoneTail,
        });
      }

      // PASS 2: bulk-create the missing polling stations in one INSERT.
      if (pendingStations.size > 0) {
        const values = Array.from(pendingStations.values()).map((s) => ({
          iebcCode: s.code,
          name: s.name,
          wardId: s.wardId,
          registeredVoters: 0,
          location: sql`(SELECT centroid FROM wards WHERE id = ${s.wardId}::uuid)` as any,
        }));
        const created = await tx
          .insert(pollingStations)
          .values(values)
          .onConflictDoNothing({ target: pollingStations.iebcCode })
          .returning({ id: pollingStations.id, code: pollingStations.iebcCode, name: pollingStations.name, wardId: pollingStations.wardId });
        for (const c of created) {
          stationByCode.set(c.code, c.id);
          stationByWardAndName.set(`${c.wardId}|${normaliseName(c.name)}`, c.id);
        }
        stationsAutoCreated = created.length;

        // Refetch any whose iebcCode collided (re-import, race) so the cache is whole.
        const stillMissingCodes = Array.from(pendingStations.values())
          .filter((s) => !stationByWardAndName.has(`${s.wardId}|${normaliseName(s.name)}`))
          .map((s) => s.code);
        if (stillMissingCodes.length > 0) {
          const refetch = await tx
            .select({ id: pollingStations.id, code: pollingStations.iebcCode, name: pollingStations.name, wardId: pollingStations.wardId })
            .from(pollingStations)
            .where(sql`${pollingStations.iebcCode} = ANY(${stillMissingCodes})`);
          for (const r of refetch) {
            stationByCode.set(r.code, r.id);
            stationByWardAndName.set(`${r.wardId}|${normaliseName(r.name)}`, r.id);
          }
        }

        // Patch unresolved voters in O(N) using the cached key.
        for (const n of normalised) {
          if (n.pollingStationId || !n.pollingStationKey) continue;
          const id = stationByWardAndName.get(n.pollingStationKey);
          if (id) n.pollingStationId = id;
        }
      }

      // PASS 2.5: deduplicate by voter_number — Postgres ON CONFLICT DO UPDATE
      // refuses to touch the same key twice in a single INSERT statement, so any
      // file with duplicate IDs (~0.16% of the IEBC export) would fail the entire
      // transaction. Strategy: keep the LAST occurrence per voter_number — later
      // rows in the file are presumed corrected re-entries by IEBC convention.
      const byVoterNumber = new Map<string, NormalisedVoter>();
      for (const n of normalised) byVoterNumber.set(n.voterNumber, n);
      const dedupedCount = normalised.length - byVoterNumber.size;
      const deduped = Array.from(byVoterNumber.values());
      if (dedupedCount > 0) {
        result.skipped += dedupedCount;
      }

      // PASS 3: bulk INSERT voters in batches with ON CONFLICT DO UPDATE.
      for (let off = 0; off < deduped.length; off += VOTER_BATCH_SIZE) {
        const batch = deduped.slice(off, off + VOTER_BATCH_SIZE);
        const inserted = await tx
          .insert(voters)
          .values(
            batch.map((n) => ({
              voterNumber: n.voterNumber,
              nationalId: n.nationalId,
              surname: n.surname,
              firstName: n.firstName,
              dateOfBirth: n.dateOfBirth ?? undefined,
              gender: n.gender,
              county: n.county,
              constituency: n.constituency,
              wardId: n.wardId,
              pollingStationId: n.pollingStationId,
              phone: n.phone,
              phoneTail: n.phoneTail,
              registrationSource: 'iebc_register' as const,
            })),
          )
          .onConflictDoUpdate({
            target: voters.voterNumber,
            set: {
              nationalId: sql`excluded.national_id`,
              surname: sql`excluded.surname`,
              firstName: sql`excluded.first_name`,
              dateOfBirth: sql`excluded.date_of_birth`,
              gender: sql`excluded.gender`,
              wardId: sql`excluded.ward_id`,
              pollingStationId: sql`excluded.polling_station_id`,
              phone: sql`COALESCE(excluded.phone, voters.phone)`,
              phoneTail: sql`COALESCE(excluded.phone_tail, voters.phone_tail)`,
              updatedAt: sql`now()`,
            },
          })
          // Use Postgres system column xmax to distinguish INSERT (xmax=0) from
          // UPDATE (xmax = current tx id). Reliable regardless of transaction wall-clock,
          // unlike comparing now() timestamps which collapse inside a long transaction.
          .returning({
            id: voters.id,
            isNew: sql<boolean>`xmax = 0`,
            pollingStationId: voters.pollingStationId,
          });

        for (const row of inserted) {
          if (row.isNew) result.inserted++;
          else result.updated++;
          if (row.pollingStationId) touchedStationIds.add(row.pollingStationId);
        }
      }

      // PASS 4: recompute polling_stations.registered_voters from the actual voter
      // count for stations we touched this batch.
      if (touchedStationIds.size > 0) {
        await tx.execute(sql`
          UPDATE polling_stations
          SET registered_voters = subq.cnt,
              updated_at = now()
          FROM (
            SELECT polling_station_id, count(*)::int AS cnt
            FROM voters
            WHERE polling_station_id IS NOT NULL
            GROUP BY polling_station_id
          ) AS subq
          WHERE polling_stations.id = subq.polling_station_id
        `);
      }

      await tx.insert(auditLog).values({
        actorPersonId: claims.sub,
        actorRole: claims.role,
        action: 'IMPORT_VOTERS',
        entityType: 'voter',
        entityId: null,
        afterValue: {
          filename,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
          errorCount: result.errors.length,
          stationsAutoCreated,
          totalRows: rows.length,
        },
        // PII redaction: filename + counts only, never row values (NFR-052).
        context: { source: 'data_import_ui' },
      });

      // PASS 5: auto-merge duplicate polling stations in every affected ward.
      // This collapses (seed station ⊕ auto-created twin) → single canonical row,
      // and deletes any seed stations with no real-world voters AND no fuzzy match.
      // Without this step, the user has to click "Merge & clean up duplicates"
      // manually after every import — which is exactly the bug we're closing.
      const touchedWardIds = Array.from(new Set(normalised.map((n) => n.wardId)));
      if (touchedWardIds.length > 0) {
        const dedupResult = await dedupStationsWithAudit(tx, claims, {
          wardIds: touchedWardIds,
          source: 'voter_import_auto',
        });
        autoMerged = dedupResult.merged;
        autoDeleted = dedupResult.deleted;
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err('IMPORT_TX_FAILED', `Transaction failed: ${msg}`, 500) as NextResponse<ErrorEnvelope>;
  }

  result.stationsAutoCreated = stationsAutoCreated;
  result.stationsAutoMerged = autoMerged;
  result.stationsAutoDeleted = autoDeleted;
  return ok(result) as NextResponse<SuccessEnvelope<CommitResponse>>;
}

// ---- helpers ---------------------------------------------------------------

async function buildWardLookup(tx: any): Promise<Map<string, string>> {
  const rows = await tx.select({ id: wards.id, name: wards.name }).from(wards);
  const map = new Map<string, string>();
  for (const r of rows) map.set(normaliseName(r.name), r.id);
  return map;
}

function tallyUpsert(
  result: CommitResponse,
  row: { id: string; createdAt: Date | string } | undefined,
) {
  if (!row) {
    result.skipped++;
    return;
  }
  const ageMs = Date.now() - new Date(row.createdAt).getTime();
  if (ageMs < 5000) result.inserted++;
  else result.updated++;
}

function normaliseName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseOptionalNumber(s: string): number | null {
  if (s === '') return null;
  const n = Number(s.replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parsePercent(s: string): number | null {
  if (s === '') return null;
  const n = Number(s.replace(/[%, ]/g, ''));
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n <= 1) return Math.round(n * 100);
  if (n >= 0 && n <= 100) return Math.round(n);
  return null;
}

function normaliseGender(s: string): 'M' | 'F' | 'U' {
  const t = s.trim().toLowerCase();
  if (t === 'm' || t === 'male' || t === 'man') return 'M';
  if (t === 'f' || t === 'female' || t === 'woman') return 'F';
  return 'U';
}

function normalisePhone(raw: string): string | null {
  if (!raw) return null;
  let s = raw.replace(/\s+/g, '');
  s = s.replace(/^\+/, '');
  if (s.startsWith('254')) s = s.slice(3);
  if (s.startsWith('0')) s = s.slice(1);
  if (!/^[71]\d{8}$/.test(s)) return null;
  return `+254${s}`;
}

/**
 * Parse a date from the variety of formats Excel hands us:
 *  - 'YYYY-MM-DD'           → kept
 *  - 'DD/MM/YYYY' / 'DD-MM-YYYY' (4-digit year)
 *  - 'DD/MM/YY'   / 'DD-MM-YY'   (2-digit year — Excel heuristic: 00-29 → 2000s, 30-99 → 1900s)
 *  - Excel serial (number)  → converted via 1900 epoch
 *
 * The IEBC register exports often use d/m/yy ("1/1/81"). Voters are 18+ so years
 * land in 1900s or early-2000s only; the 30-year pivot is the de-facto industry
 * convention (Microsoft Office uses the same threshold by default).
 *
 * Returns 'YYYY-MM-DD' or null.
 */
function parseDateOnly(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // d/m/YYYY or d-m-YYYY (4-digit year)
  const dmy4 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy4) {
    const d = dmy4[1]!.padStart(2, '0');
    const m = dmy4[2]!.padStart(2, '0');
    const y = dmy4[3]!;
    return `${y}-${m}-${d}`;
  }
  // d/m/yy or d-m-yy (2-digit year)
  const dmy2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (dmy2) {
    const d = dmy2[1]!.padStart(2, '0');
    const m = dmy2[2]!.padStart(2, '0');
    const yy = Number(dmy2[3]!);
    // Excel pivot: 00-29 → 2000s, 30-99 → 1900s. A 0 or 25 is a 25- or 0-year-old;
    // a 30 or 81 is a 95- or 44-year-old. Both bands are sensible for a voter file.
    const year = yy <= 29 ? 2000 + yy : 1900 + yy;
    return `${year}-${m}-${String(d).padStart(2, '0')}`;
  }
  // Excel serial number (days since 1899-12-30, accounting for the 1900 leap bug).
  const num = Number(s);
  if (Number.isFinite(num) && num > 0 && num < 100_000) {
    const ms = (num - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function normaliseSiteType(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    mosque: 'mosque', masjid: 'mosque', msikiti: 'mosque',
    church: 'church', kanisa: 'church',
    madrasa: 'madrasa', madrasah: 'madrasa',
    'primary school': 'school_primary', primary: 'school_primary',
    'secondary school': 'school_secondary', secondary: 'school_secondary',
    school: 'school_other',
    market: 'market', soko: 'market',
    'shopping center': 'shopping_center', 'shopping centre': 'shopping_center',
    'boda stage': 'boda_stage', boda: 'boda_stage',
    'matatu stage': 'matatu_stage', matatu: 'matatu_stage',
    chama: 'chama', sacco: 'sacco',
    'self help group': 'self_help_group',
    'community hall': 'community_hall', hall: 'community_hall',
    'social hall': 'social_hall', social: 'social_hall',
    'sports club': 'sports_club', sports: 'sports_club',
    'youth center': 'youth_center', 'youth centre': 'youth_center', youth: 'youth_center',
    health: 'health_facility', clinic: 'health_facility', hospital: 'health_facility',
    government: 'government_office', office: 'government_office',
  };
  return map[t] ?? 'other';
}
