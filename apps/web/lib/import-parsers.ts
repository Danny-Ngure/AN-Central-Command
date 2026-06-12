import * as XLSX from 'xlsx';

// Bulk-import file parsers.
//
// Three input families:
//   1. Tabular  (.xlsx, .xls, .csv, .tsv) — parsed into {columns, rows}; ready for column-mapping UI
//   2. Document (.pdf, .docx, .doc)       — accepted, NOT parsed yet. Stored intent only. The user
//                                          is told "supporting document — text extraction is TBD"
//                                          and we surface metadata (filename, size, sha256) so a
//                                          later phase can attach extracted text.
//   3. Other                              — rejected with a clear error.
//
// PDF/Word text-extraction needs pdfjs-dist + mammoth and a non-trivial worker setup inside
// Next.js's nodejs runtime — slated for the next slice once the tabular path is shipped.

export type ImportFormat = 'csv' | 'tsv' | 'xlsx' | 'pdf' | 'docx' | 'unsupported';

export interface PreviewResult {
  format: ImportFormat;
  filename: string;
  byteSize: number;
  // Tabular only:
  columns?: string[];           // header row, normalised: trimmed + first occurrence wins on dupes
  rows?: Record<string, string>[]; // up to PREVIEW_ROW_CAP — never the full file
  rowCountTotal?: number;       // total rows in source (so the UI can show "previewing X of Y")
  // Document only:
  documentNote?: string;
  // Always:
  warnings: string[];
}

const PREVIEW_ROW_CAP = 100;

// Commit path uses parseUpload with rowCap=Infinity so EVERY row is processed.
// Preview keeps the 100-row default to keep the API response small for the UI.

export function detectFormat(filename: string, contentType: string | null): ImportFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.tsv')) return 'tsv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'docx';
  // Fallback to content-type sniffing — only used when extension is absent/weird.
  if (contentType?.includes('csv')) return 'csv';
  if (contentType?.includes('spreadsheetml') || contentType?.includes('ms-excel')) return 'xlsx';
  if (contentType?.includes('pdf')) return 'pdf';
  if (contentType?.includes('wordprocessingml') || contentType?.includes('msword')) return 'docx';
  return 'unsupported';
}

/**
 * Parse a sites file in the "multi-section coordinator PDF" format that ward teams use:
 *
 *   Row 0: (title, optional)    KADZANDANI
 *   Row 1: section header        NAME OF MOSQUE  | LOCATION   | CONTACT PERSON   | TELEPHONE
 *   Rows 2-N: mosque data        MASJID SWAFAA   | KWA BULLO  | UST. OMAR ABDA…  | 0727639839
 *   Row N+1: blank / title
 *   Row N+2: section header      NAME OF CHURCH  | LOCATION   | LEADERSHIP       | TELEPHONE
 *   Rows N+3-M: church data      …
 *
 * Detection rule: any row whose first cell matches /^NAME OF (.+)$/i opens a section.
 * The captured word(s) map to site `type`. Section rows continue until the next section
 * header or end-of-file. Blank rows are skipped.
 *
 * Returns null if no section headers are found — caller should fall back to standard
 * tabular parsing (the file isn't in coordinator-PDF format).
 */
export function parseSitesMultiSection(
  buffer: Buffer,
  filename: string,
  contentType: string | null,
): PreviewResult | null {
  const format = detectFormat(filename, contentType);
  let aoa: string[][];

  if (format === 'xlsx') {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    if (!sheet) return null;
    aoa = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][])
      .map((r) => r.map((c) => String(c ?? '')));
  } else if (format === 'csv' || format === 'tsv') {
    let text = buffer.toString('utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    aoa = parseDelimitedString(text, format === 'tsv' ? '\t' : ',');
  } else {
    return null;
  }

  // Find section headers.
  interface Section { row: number; type: string; rawLabel: string }
  const sections: Section[] = [];
  for (let i = 0; i < aoa.length; i++) {
    const firstCell = (aoa[i]?.[0] ?? '').trim();
    const m = firstCell.match(/^NAME\s+OF\s+(.+)$/i);
    if (m) {
      const type = sectionLabelToType(m[1]!.trim());
      if (type) sections.push({ row: i, type, rawLabel: m[1]!.trim() });
    }
  }
  if (sections.length === 0) return null;

  const rows: Record<string, string>[] = [];
  const sectionsReport: { type: string; label: string; rowCount: number }[] = [];

  for (let s = 0; s < sections.length; s++) {
    const sec = sections[s]!;
    const next = sections[s + 1]?.row ?? aoa.length;
    let count = 0;
    for (let r = sec.row + 1; r < next; r++) {
      const row = aoa[r];
      if (!row) continue;
      const name = (row[0] ?? '').trim();
      if (!name) continue;
      // Skip likely title-only rows that re-appear between sections (single non-empty cell
      // that's not a real name, e.g. "KADZANDANI" alone).
      const otherCellsNonEmpty = row.slice(1).filter((c) => (c ?? '').trim() !== '').length;
      if (otherCellsNonEmpty === 0 && name.length < 25 && /^[A-Z\s]+$/.test(name)) continue;

      rows.push({
        name,
        type: sec.type,
        area:           (row[1] ?? '').trim(),
        contact_person: (row[2] ?? '').trim(),
        contact_role:   defaultRoleForSiteType(sec.type),
        phone:          (row[3] ?? '').trim(),
      });
      count++;
    }
    sectionsReport.push({ type: sec.type, label: sec.rawLabel, rowCount: count });
  }

  if (rows.length === 0) return null;

  const warnings: string[] = [];
  warnings.push(
    'Detected coordinator-PDF format. Sections found: ' +
      sectionsReport.map((s) => `${s.label} → ${s.type} (${s.rowCount} rows)`).join(' · '),
  );

  return {
    format,
    filename,
    byteSize: buffer.byteLength,
    columns: ['name', 'type', 'area', 'contact_person', 'contact_role', 'phone'],
    rows,
    rowCountTotal: rows.length,
    warnings,
  };
}

function sectionLabelToType(raw: string): string | null {
  const t = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  // Strip plurals.
  const norm = t.replace(/s$/, '');
  const map: Record<string, string> = {
    mosque: 'mosque',
    masjid: 'mosque',
    msikiti: 'mosque',
    madrasa: 'madrasa',
    madrasah: 'madrasa',
    church: 'church',
    kanisa: 'church',
    'social hall': 'social_hall',
    'community hall': 'community_hall',
    'community centre': 'community_hall',
    'community center': 'community_hall',
    hall: 'community_hall',
    'boda boda': 'boda_stage',
    'boda boda centre': 'boda_stage',
    'boda boda center': 'boda_stage',
    'boda stage': 'boda_stage',
    boda: 'boda_stage',
    'matatu stage': 'matatu_stage',
    matatu: 'matatu_stage',
    market: 'market',
    soko: 'market',
    'youth centre': 'youth_center',
    'youth center': 'youth_center',
    'sports club': 'sports_club',
    school: 'school_other',
    'primary school': 'school_primary',
    'secondary school': 'school_secondary',
    chama: 'chama',
    sacco: 'sacco',
    'self help group': 'self_help_group',
    'health facility': 'health_facility',
    clinic: 'health_facility',
    hospital: 'health_facility',
  };
  return map[norm] ?? map[t] ?? null;
}

function defaultRoleForSiteType(type: string): string {
  switch (type) {
    case 'mosque':         return 'Imam';
    case 'madrasa':        return 'Ustadh';
    case 'church':         return 'Pastor';
    case 'boda_stage':     return 'Chairman';
    case 'matatu_stage':   return 'Chairman';
    case 'community_hall': return 'Chairperson';
    case 'social_hall':    return 'Chairperson';
    case 'youth_center':   return 'Coordinator';
    case 'sports_club':    return 'Chairperson';
    case 'chama':          return 'Chairperson';
    case 'sacco':          return 'Chairperson';
    case 'health_facility':return 'In-charge';
    default:               return '';
  }
}

export async function parseUpload(
  buffer: Buffer,
  filename: string,
  contentType: string | null,
  opts: { rowCap?: number } = {},
): Promise<PreviewResult> {
  const format = detectFormat(filename, contentType);
  const rowCap = opts.rowCap ?? PREVIEW_ROW_CAP;
  const base: Omit<PreviewResult, 'format'> = {
    filename,
    byteSize: buffer.byteLength,
    warnings: [],
  };

  if (format === 'csv' || format === 'tsv') {
    return parseDelimited(buffer, format, base, rowCap);
  }
  if (format === 'xlsx') {
    return parseXlsx(buffer, base, rowCap);
  }
  if (format === 'pdf') {
    return {
      ...base,
      format: 'pdf',
      documentNote:
        'PDF accepted as a supporting document. Automatic text extraction is wired in a follow-up slice — for now, attach to a polling-station or leader record manually.',
    };
  }
  if (format === 'docx') {
    return {
      ...base,
      format: 'docx',
      documentNote:
        'Word document accepted as a supporting document. Automatic text extraction is wired in a follow-up slice.',
    };
  }
  return {
    ...base,
    format: 'unsupported',
    warnings: ['Unsupported file type. Use .xlsx, .xls, .csv, .tsv, .pdf, or .docx.'],
  };
}

// ---- CSV / TSV --------------------------------------------------------------
//
// Minimal RFC-4180-ish parser. Handles:
//   - quoted fields with embedded commas/newlines
//   - doubled "" as escaped quote inside a quoted field
//   - CRLF or LF line endings
// Not handled: shift-jis encodings, BOM stripping is automatic on UTF-8.

function parseDelimited(
  buffer: Buffer,
  format: 'csv' | 'tsv',
  base: Omit<PreviewResult, 'format'>,
  rowCap: number,
): PreviewResult {
  let text = buffer.toString('utf8');
  // Strip UTF-8 BOM if present (Excel exports CSV with BOM).
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const delim = format === 'tsv' ? '\t' : ',';
  const rows = parseDelimitedString(text, delim);
  if (rows.length === 0) {
    return { ...base, format, warnings: ['File appears empty.'] };
  }
  const header = rows[0]!.map((c, i) => normaliseHeader(c, i));
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''));
  const previewRows = dataRows.slice(0, rowCap).map((r) => rowToObject(header, r));

  const warnings: string[] = [];
  if (dataRows.length === 0) warnings.push('File contains only a header row.');
  if (dataRows.length > rowCap && Number.isFinite(rowCap)) {
    warnings.push(`Showing first ${rowCap} of ${dataRows.length} rows.`);
  }

  return {
    ...base,
    format,
    columns: header,
    rows: previewRows,
    rowCountTotal: dataRows.length,
    warnings,
  };
}

function parseDelimitedString(text: string, delim: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === delim) {
        row.push(field);
        field = '';
      } else if (c === '\r') {
        // swallow — handled by \n
      } else if (c === '\n') {
        row.push(field);
        out.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out;
}

// ---- XLSX -------------------------------------------------------------------

function parseXlsx(
  buffer: Buffer,
  base: Omit<PreviewResult, 'format'>,
  rowCap: number,
): PreviewResult {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { ...base, format: 'xlsx', warnings: ['Workbook contains no sheets.'] };
  }
  const sheet = wb.Sheets[sheetName]!;
  // header:1 returns array-of-arrays so we can deal with header normalisation ourselves.
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,    // dates and numbers come out as formatted strings
    defval: '',
  });
  if (aoa.length === 0) {
    return { ...base, format: 'xlsx', warnings: ['First sheet appears empty.'] };
  }
  const header = aoa[0]!.map((c, i) => normaliseHeader(String(c ?? ''), i));
  const dataRows = aoa.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  const previewRows = dataRows.slice(0, rowCap).map((r) =>
    rowToObject(header, r.map((c) => String(c ?? ''))),
  );

  const warnings: string[] = [];
  if (wb.SheetNames.length > 1) {
    warnings.push(
      `Workbook has ${wb.SheetNames.length} sheets; only the first ("${sheetName}") is imported.`,
    );
  }
  if (dataRows.length > rowCap && Number.isFinite(rowCap)) {
    warnings.push(`Showing first ${rowCap} of ${dataRows.length} rows.`);
  }
  if (dataRows.length === 0) warnings.push('Sheet contains only a header row.');

  return {
    ...base,
    format: 'xlsx',
    columns: header,
    rows: previewRows,
    rowCountTotal: dataRows.length,
    warnings,
  };
}

// ---- helpers ---------------------------------------------------------------

function normaliseHeader(name: string, index: number): string {
  const trimmed = name.trim();
  return trimmed === '' ? `column_${index + 1}` : trimmed;
}

function rowToObject(header: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < header.length; i++) {
    const key = header[i]!;
    if (!(key in out)) out[key] = (row[i] ?? '').trim();
  }
  return out;
}

// ---- column-mapping suggestion --------------------------------------------
//
// Given the detected columns and a target entity, suggest which column maps to
// which field. The UI starts with this suggestion; the user confirms or overrides.

export type EntityType = 'polling_stations' | 'voters' | 'community_leaders' | 'sites';

export interface FieldSpec {
  field: string;
  label: string;
  required: boolean;
  hints: string[]; // case-insensitive substrings that suggest a match
}

export const ENTITY_FIELDS: Record<EntityType, FieldSpec[]> = {
  polling_stations: [
    // IEBC code is optional. When absent, the commit handler generates one as
    // `028-<md5(wardId|normaliseName(name)).slice(0,8)>` — same scheme used by the
    // voter-import auto-creation, so stations match across both paths.
    { field: 'iebcCode',         label: 'IEBC Code (optional)', required: false, hints: ['iebc', 'code', 'station_code', 'ps_code', 'polling_station_code'] },
    { field: 'name',             label: 'Station Name',       required: true,  hints: ['name', 'station_name', 'polling_station'] },
    { field: 'wardName',         label: 'Ward',               required: true,  hints: ['ward'] },
    { field: 'registeredVoters', label: 'Registered Voters',  required: false, hints: ['registered', 'voters', 'voter_count', 'reg_voters'] },
    { field: 'longitude',        label: 'Longitude',          required: false, hints: ['lon', 'lng', 'long'] },
    { field: 'latitude',         label: 'Latitude',           required: false, hints: ['lat'] },
    { field: 'turnout2022',      label: '2022 Turnout %',     required: false, hints: ['2022', 'turnout'] },
    { field: 'turnout2017',      label: '2017 Turnout %',     required: false, hints: ['2017'] },
    { field: 'turnout2013',      label: '2013 Turnout %',     required: false, hints: ['2013'] },
    { field: 'targetTurnout',    label: 'Target Turnout %',   required: false, hints: ['target'] },
  ],
  voters: [
    // Per user's data shape: ID number, surname, first name, DOB, county, constituency,
    // gender, ward, polling station, phone (Kenyan 9-digit format e.g. '723535594').
    //
    // Either Voter Number OR National ID must map; the commit handler accepts whichever
    // is present and uses it as the voters.voter_number upsert key. The IEBC published
    // register often only carries National ID, treating that as the voter identifier.
    { field: 'nationalId',          label: 'National ID / ID No',         required: false, hints: ['id_no', 'idno', 'national', 'id_number'] },
    { field: 'voterNumber',         label: 'Voter Number (optional if ID No present)', required: false, hints: ['voter_number', 'voter_no', 'voter_id', 'reg_number', 'voter#'] },
    { field: 'surname',             label: 'Surname',                     required: true,  hints: ['surname', 'last_name', 'family_name'] },
    { field: 'firstName',           label: 'First Name',                  required: true,  hints: ['first_name', 'firstname', 'given_name', 'other_names'] },
    { field: 'dateOfBirth',         label: 'Date of Birth',               required: false, hints: ['dob', 'd.o.b', 'date_of_birth', 'birth_date', 'birthdate'] },
    { field: 'gender',              label: 'Gender',                      required: false, hints: ['gender', 'sex'] },
    { field: 'county',              label: 'County',                      required: false, hints: ['county'] },
    { field: 'constituency',        label: 'Constituency',                required: false, hints: ['constituency'] },
    { field: 'wardName',            label: 'Ward',                        required: true,  hints: ['ward'] },
    { field: 'pollingStationCode',  label: 'Polling Station (IEBC code)', required: false, hints: ['polling_code', 'station_code', 'polling_station_code'] },
    { field: 'pollingStationName',  label: 'Polling Station (name)',      required: false, hints: ['polling', 'station_name', 'polling_station'] },
    { field: 'phone',               label: 'Phone (9-digit Kenyan)',      required: false, hints: ['phone_number', 'phone', 'mobile', 'msisdn', 'cell'] },
  ],
  community_leaders: [
    { field: 'fullName',         label: 'Full Name',          required: true,  hints: ['name', 'full_name'] },
    { field: 'category',         label: 'Category',           required: true,  hints: ['category', 'type', 'role'] },
    { field: 'phone',            label: 'Phone',              required: false, hints: ['phone', 'mobile'] },
    { field: 'villageName',      label: 'Village',            required: true,  hints: ['village', 'mtaa', 'area'] },
    { field: 'wardName',         label: 'Ward',               required: true,  hints: ['ward'] },
    { field: 'influenceScore',   label: 'Influence Score',    required: false, hints: ['influence', 'score'] },
  ],
  sites: [
    // Mosques, churches, social halls, community centres.
    { field: 'name',             label: 'Name',               required: true,  hints: ['name', 'mosque_name', 'church_name', 'site_name'] },
    { field: 'type',             label: 'Type',               required: true,  hints: ['type', 'category', 'kind'] },
    { field: 'wardName',         label: 'Ward',               required: true,  hints: ['ward'] },
    { field: 'areaName',         label: 'Area / Location',    required: false, hints: ['area', 'location', 'estate', 'mtaa'] },
    { field: 'villageName',      label: 'Village',            required: false, hints: ['village'] },
    { field: 'contactPersonName',label: 'Contact Person',     required: false, hints: ['contact', 'person', 'leader', 'imam', 'pastor', 'chairman', 'leadership'] },
    { field: 'contactRole',      label: 'Contact Role',       required: false, hints: ['role', 'title', 'position'] },
    { field: 'contactPhone',     label: 'Contact Phone',      required: false, hints: ['phone', 'mobile', 'msisdn', 'cell', 'telephone'] },
    { field: 'longitude',        label: 'Longitude',          required: false, hints: ['lon', 'lng', 'long'] },
    { field: 'latitude',         label: 'Latitude',           required: false, hints: ['lat'] },
    { field: 'estimatedSize',    label: 'Estimated Congregation Size', required: false, hints: ['size', 'attendance', 'members'] },
    // Visited status — drives the coverage pie charts & "% visited" everywhere.
    // Accepts: "Visited", "Visited / Reached", "Yes", "Done", "✓", Swahili "Imefikiwa";
    // negatives: "Not visited", "Not Reached", "No", Swahili "Hawajafikiwa".
    { field: 'visited',          label: 'Visited status',     required: false, hints: ['visited', 'status', 'reached', 'tembelewa', 'fikiwa', 'coverage'] },
  ],
};

export function suggestMapping(columns: string[], entity: EntityType): Record<string, string | null> {
  const fields = ENTITY_FIELDS[entity];
  const mapping: Record<string, string | null> = {};
  const usedColumns = new Set<string>();
  for (const f of fields) {
    let best: string | null = null;
    for (const col of columns) {
      if (usedColumns.has(col)) continue;
      const lower = col.toLowerCase().replace(/[\s_-]+/g, '');
      for (const hint of f.hints) {
        const lowerHint = hint.toLowerCase().replace(/[\s_-]+/g, '');
        if (lower === lowerHint || lower.includes(lowerHint)) {
          best = col;
          break;
        }
      }
      if (best) break;
    }
    if (best) usedColumns.add(best);
    mapping[f.field] = best;
  }
  return mapping;
}
