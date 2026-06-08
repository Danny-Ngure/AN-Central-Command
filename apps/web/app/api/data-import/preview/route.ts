import { NextRequest, NextResponse } from 'next/server';
import { err, ok, withAuth, type ErrorEnvelope, type SuccessEnvelope } from '@/lib/api';
import {
  ENTITY_FIELDS,
  parseUpload,
  parseSitesMultiSection,
  suggestMapping,
  type EntityType,
  type PreviewResult,
} from '@/lib/import-parsers';

export const runtime = 'nodejs';
export const maxDuration = 300;

// POST /api/data-import/preview
//
// Accepts a multipart/form-data upload with fields:
//   - file        (required) — .xlsx / .xls / .csv / .tsv / .pdf / .docx
//   - entityType  (required) — 'polling_stations' | 'voters' | 'community_leaders'
//
// Returns a PreviewResult plus a suggested column-mapping so the UI can render the
// confirmation step. This route does NOT mutate anything — it's purely "what does
// the system see in your file?" and lives entirely in memory.

const PRIVILEGED_ROLES = new Set([
  'candidate',
  'campaign_manager',
  'chief_strategist',
  'constituency_coordinator',
  'tech_lead',
]);

// 50 MiB upload cap. Larger files should use a chunked / S3-presigned flow added later.
const MAX_BYTES = 50 * 1024 * 1024;

interface PreviewResponse {
  preview: PreviewResult;
  entityType: EntityType;
  suggestedMapping: Record<string, string | null>;
  fieldSpec: typeof ENTITY_FIELDS[EntityType];
}

export const POST = withAuth<PreviewResponse>(async (req, { claims }) => {
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
  if (!(entityType in ENTITY_FIELDS)) {
    return err(
      'IMPORT_BAD_ENTITY_TYPE',
      `entityType must be one of: ${Object.keys(ENTITY_FIELDS).join(', ')}`,
      400,
    ) as NextResponse<ErrorEnvelope>;
  }
  if (!file || typeof file === 'string') {
    return err('IMPORT_NO_FILE', 'No file uploaded under field "file"', 400) as NextResponse<ErrorEnvelope>;
  }

  const blob = file as Blob & { name?: string; type?: string };
  if (blob.size > MAX_BYTES) {
    return err(
      'IMPORT_FILE_TOO_LARGE',
      `File exceeds ${MAX_BYTES / 1024 / 1024} MiB upload cap`,
      413,
    ) as NextResponse<ErrorEnvelope>;
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const filename = blob.name ?? 'upload.bin';
  const fileType = blob.type ?? null;

  // Sites uploaded in the "coordinator PDF" format (rows like NAME OF MOSQUE / NAME OF CHURCH
  // section headers) get a smart per-section parser. Falls back to the standard tabular
  // parser if no section headers detected.
  let preview: PreviewResult | null = null;
  if (entityType === 'sites') {
    preview = parseSitesMultiSection(buffer, filename, fileType);
  }
  if (!preview) {
    preview = await parseUpload(buffer, filename, fileType);
  }

  const suggested = preview.columns
    ? suggestMapping(preview.columns, entityType)
    : {};

  return ok({
    preview,
    entityType,
    suggestedMapping: suggested,
    fieldSpec: ENTITY_FIELDS[entityType],
  }) as NextResponse<SuccessEnvelope<PreviewResponse>>;
});
