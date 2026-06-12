'use client';

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';

// Three-step uploader UI.
//
//   Step 1  Pick entity type → choose file → POST /preview
//   Step 2  Preview table + column mapper → POST /commit
//   Step 3  Result summary (insert/update counts + per-row errors).
//
// State machine:
//
//   idle  ──pick file──▶  uploading  ──ok──▶  reviewing  ──confirm──▶  committing  ──ok──▶  done
//          │                  │                   │                       │
//          │                  └──err──▶ error     └──cancel──▶ idle       └──err──▶ reviewing (with error toast)
//
// Anything user-facing here is bilingual at the next pass; strings inlined for now to
// keep this slice focused.

type EntityType = 'polling_stations' | 'voters' | 'community_leaders' | 'sites';

interface FieldSpec {
  field: string;
  label: string;
  required: boolean;
  hints: string[];
}

interface PreviewResult {
  format: string;
  filename: string;
  byteSize: number;
  columns?: string[];
  rows?: Record<string, string>[];
  rowCountTotal?: number;
  documentNote?: string;
  warnings: string[];
}

interface PreviewResponse {
  preview: PreviewResult;
  entityType: EntityType;
  suggestedMapping: Record<string, string | null>;
  fieldSpec: FieldSpec[];
}

interface CommitResponse {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { rowIndex: number; reason: string }[];
  stationsAutoCreated?: number;
  stationsAutoMerged?: number;
  stationsAutoDeleted?: number;
}

type Phase = 'idle' | 'uploading' | 'reviewing' | 'committing' | 'done';

const ENTITY_OPTIONS: { value: EntityType; label: string; description: string; gated?: boolean }[] = [
  {
    value: 'polling_stations',
    label: 'Polling stations',
    description: 'IEBC-coded stations: name, ward, registered voters, GPS, turnout history.',
  },
  {
    value: 'sites',
    label: 'Sites (mosques / churches / social)',
    description:
      'Name, type, ward, contact person + phone, and a Visited column. Visited status feeds the coverage pie charts & "% visited" automatically.',
  },
  {
    value: 'voters',
    label: 'Voter register',
    description: 'Voter#, surname, first name, DOB, gender, ward, polling station, phone. PII-locked until DPA_VOTER_INGEST_ENABLED=true.',
    gated: true,
  },
  {
    value: 'community_leaders',
    label: 'Community leaders',
    description: 'Religious, business, opinion, youth, women leaders. (Wired next slice.)',
    gated: true,
  },
];

interface Props {
  userRole: string;
  userName: string;
  /** Optional ward lock — when set, the importer pre-scopes everything to this ward. */
  forcedWardId?: string;
  forcedWardName?: string;
  /** Optional entity lock — used by the per-ward upload page to default to 'voters'. */
  defaultEntity?: EntityType;
}

export function ImportClient({
  userRole,
  userName,
  forcedWardId,
  forcedWardName,
  defaultEntity,
}: Props) {
  const [entityType, setEntityType] = useState<EntityType>(defaultEntity ?? 'polling_stations');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);

  const isTabular = preview?.preview?.columns !== undefined;

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
  }

  async function onPreview(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Pick a file first.');
      return;
    }
    setPhase('uploading');
    setError(null);
    setCommitResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('entityType', entityType);
      const res = await fetch('/api/data-import/preview', { method: 'POST', body: form });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? 'Preview failed');
        setPhase('idle');
        return;
      }
      const data = body.data as PreviewResponse;
      setPreview(data);
      setMapping(data.suggestedMapping);
      setPhase('reviewing');
    } catch {
      setError('Network error. Make sure the dev server is reachable.');
      setPhase('idle');
    }
  }

  async function onCommit() {
    if (!preview || !file) return;
    setPhase('committing');
    setError(null);
    try {
      // Re-upload the file along with the chosen mapping. The server re-parses
      // it with no row cap — critical because the preview only carried 100 rows
      // and we must commit the full file.
      const form = new FormData();
      form.append('file', file);
      form.append('entityType', preview.entityType);
      form.append('mappings', JSON.stringify(mapping));
      form.append('filename', preview.preview.filename);
      if (forcedWardId) form.append('forcedWardId', forcedWardId);

      const res = await fetch('/api/data-import/commit', {
        method: 'POST',
        body: form,
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? 'Commit failed');
        setPhase('reviewing');
        return;
      }
      setCommitResult(body.data as CommitResponse);
      setPhase('done');
    } catch {
      setError('Network error during commit.');
      setPhase('reviewing');
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setMapping({});
    setCommitResult(null);
    setError(null);
    setPhase('idle');
  }

  // ---- UI ----

  return (
    <div className="space-y-6">
      {/* Ward-lock banner (only when invoked from /wards/[id]/import). */}
      {forcedWardId && forcedWardName && (
        <div className="rounded-xl border border-brand-violet/40 bg-brand-violet/10 p-4 text-sm text-brand-textActive">
          <div className="font-semibold uppercase tracking-wider text-brand-violet mb-1 text-xs">
            Ward-scoped upload
          </div>
          Every row in this file will be assigned to <strong>{forcedWardName}</strong>.
          You can leave the WARD column off the spreadsheet entirely — the system uses
          the ward from the URL. Polling stations mentioned in the file are auto-created
          under this ward.
        </div>
      )}

      {/* Compliance banner */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        <div className="font-semibold uppercase tracking-wider text-amber-300 mb-1 text-xs">
          Data-protection notice
        </div>
        Polling stations are public IEBC data — safe to import in dev. Voter PII and
        WhatsApp broadcasts to citizens are <strong>locked</strong> until the ODPC Data
        Controller registration, DPIA, and DPO sign-off are filed. Every import is
        audit-logged with your identity ({userName}, {userRole}).
      </div>

      {phase === 'idle' && (
        <form
          onSubmit={onPreview}
          className="space-y-4 rounded-xl border border-brand-border bg-brand-cardBg p-5"
        >
          {defaultEntity ? (
            // Locked entity (per-ward upload page); show a static badge instead of the picker.
            <div className="rounded-lg border border-brand-border bg-black/10 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted mb-1">
                Importing
              </div>
              <div className="text-sm font-semibold text-brand-textActive">
                {ENTITY_OPTIONS.find((o) => o.value === defaultEntity)?.label ?? defaultEntity}
              </div>
            </div>
          ) : (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wider text-brand-textMuted">
                What are you importing?
              </legend>
              <div className="grid gap-2 md:grid-cols-3">
                {ENTITY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={[
                      'block rounded-lg border p-3 cursor-pointer transition',
                      entityType === opt.value
                        ? 'border-brand-violet bg-brand-violet/10'
                        : 'border-brand-border hover:border-brand-violet/40',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="entityType"
                      value={opt.value}
                      checked={entityType === opt.value}
                      onChange={() => setEntityType(opt.value)}
                      className="sr-only"
                    />
                    <div className="text-sm font-semibold text-brand-textActive">
                      {opt.label}
                      {opt.gated && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Gated
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-brand-textMuted mt-1">{opt.description}</div>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="space-y-2">
            <label
              htmlFor="file"
              className="text-xs font-semibold uppercase tracking-wider text-brand-textMuted"
            >
              File (.xlsx, .xls, .csv, .tsv, .pdf, .docx — max 50 MiB)
            </label>
            <input
              id="file"
              type="file"
              accept=".xlsx,.xls,.csv,.tsv,.pdf,.docx,.doc"
              onChange={onFileChange}
              className="block w-full text-sm text-brand-textActive file:mr-4 file:rounded-md file:border-0 file:bg-brand-violet file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-violet/90"
            />
            {file && (
              <div className="text-xs text-brand-textMuted">
                Selected: <span className="font-mono text-brand-textActive">{file.name}</span> ·{' '}
                {(file.size / 1024).toFixed(1)} KiB
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-brand-danger bg-brand-danger/10 border border-brand-danger/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!file}
            className="rounded-lg bg-brand-violet px-4 py-2 text-sm font-semibold text-white hover:bg-brand-violet/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Parse &amp; preview
          </button>
        </form>
      )}

      {phase === 'uploading' && (
        <div className="rounded-xl border border-brand-border bg-brand-cardBg p-5 text-sm text-brand-textMuted">
          Parsing {file?.name}…
        </div>
      )}

      {phase === 'reviewing' && preview && (
        <div className="space-y-4">
          <PreviewSummary preview={preview.preview} />

          {!isTabular && preview.preview.documentNote && (
            <div className="rounded-xl border border-brand-border bg-brand-cardBg p-5 text-sm text-brand-textMuted">
              {preview.preview.documentNote}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-brand-border px-3 py-1.5 text-xs font-semibold text-brand-textActive hover:border-brand-violet"
                >
                  Choose another file
                </button>
              </div>
            </div>
          )}

          {isTabular && (
            <>
              <ColumnMapper
                fieldSpec={preview.fieldSpec.filter(
                  (f) => !(forcedWardId && f.field === 'wardName'),
                )}
                columns={preview.preview.columns!}
                mapping={mapping}
                onChange={setMapping}
              />
              <PreviewTable
                columns={preview.preview.columns!}
                rows={preview.preview.rows!.slice(0, 10)}
              />

              {error && (
                <div className="text-sm text-brand-danger bg-brand-danger/10 border border-brand-danger/30 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onCommit}
                  className="rounded-lg bg-brand-violet px-4 py-2 text-sm font-semibold text-white hover:bg-brand-violet/90"
                >
                  Confirm &amp; import {preview.preview.rowCountTotal} rows
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-brand-border px-4 py-2 text-sm font-semibold text-brand-textActive hover:border-brand-violet"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === 'committing' && (
        <div className="rounded-xl border border-brand-border bg-brand-cardBg p-5 text-sm text-brand-textMuted">
          Importing… each row is upserted by IEBC code so re-running this is safe.
        </div>
      )}

      {phase === 'done' && commitResult && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="text-emerald-300 font-semibold uppercase tracking-wider text-xs">
              Import committed
            </div>
            <div className="grid grid-cols-4 gap-4 mt-3 text-center">
              <Stat value={commitResult.inserted} label="Created" tone="good" />
              <Stat value={commitResult.updated} label="Updated" tone="good" />
              <Stat value={commitResult.skipped} label="Skipped" tone="neutral" />
              <Stat value={commitResult.errors.length} label="Errors" tone={commitResult.errors.length ? 'bad' : 'neutral'} />
            </div>
            <div className="mt-3 space-y-0.5 text-xs">
              {!!commitResult.stationsAutoCreated && (
                <div className="text-emerald-300">
                  + {commitResult.stationsAutoCreated} new polling station{commitResult.stationsAutoCreated === 1 ? '' : 's'} auto-created from the file
                </div>
              )}
              {!!commitResult.stationsAutoMerged && (
                <div className="text-emerald-300">
                  ⚙ {commitResult.stationsAutoMerged} seed station{commitResult.stationsAutoMerged === 1 ? '' : 's'} auto-merged with their canonical-name twin
                </div>
              )}
              {!!commitResult.stationsAutoDeleted && (
                <div className="text-emerald-300">
                  × {commitResult.stationsAutoDeleted} stale station{commitResult.stationsAutoDeleted === 1 ? '' : 's'} auto-deleted (no voters in the import)
                </div>
              )}
            </div>
          </div>
          {commitResult.errors.length > 0 && (
            <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-brand-textMuted mb-2">
                Errors ({commitResult.errors.length})
              </div>
              <div className="space-y-1 max-h-64 overflow-auto text-xs">
                {commitResult.errors.map((e) => (
                  <div key={e.rowIndex} className="flex gap-3">
                    <span className="font-mono text-brand-textMuted shrink-0">row {e.rowIndex + 2}</span>
                    <span className="text-brand-danger">{e.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-brand-border px-4 py-2 text-sm font-semibold text-brand-textActive hover:border-brand-violet"
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}

// ---- subcomponents ---------------------------------------------------------

function PreviewSummary({ preview }: { preview: PreviewResult }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
      <Kv k="File" v={preview.filename} mono />
      <Kv k="Format" v={preview.format.toUpperCase()} />
      <Kv k="Size" v={`${(preview.byteSize / 1024).toFixed(1)} KiB`} />
      {preview.rowCountTotal !== undefined && (
        <Kv k="Rows" v={String(preview.rowCountTotal)} />
      )}
      {preview.warnings.length > 0 && (
        <div className="col-span-full text-amber-300">
          {preview.warnings.map((w, i) => (
            <div key={i}>· {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Kv({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-brand-textMuted uppercase tracking-wider text-[10px] font-semibold">
        {k}
      </div>
      <div className={`text-brand-textActive ${mono ? 'font-mono' : ''} truncate`}>{v}</div>
    </div>
  );
}

function ColumnMapper({
  fieldSpec,
  columns,
  mapping,
  onChange,
}: {
  fieldSpec: FieldSpec[];
  columns: string[];
  mapping: Record<string, string | null>;
  onChange: (m: Record<string, string | null>) => void;
}) {
  function setField(field: string, col: string) {
    onChange({ ...mapping, [field]: col === '' ? null : col });
  }
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-brand-textMuted mb-3">
        Column mapping
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {fieldSpec.map((f) => (
          <div key={f.field} className="flex items-center gap-2">
            <label className="text-xs text-brand-textActive flex-1">
              {f.label}
              {f.required && <span className="text-brand-danger ml-1">*</span>}
            </label>
            <select
              value={mapping[f.field] ?? ''}
              onChange={(e) => setField(f.field, e.target.value)}
              className="bg-brand-field border border-brand-border rounded-md px-2 py-1 text-xs text-brand-textActive focus:outline-none focus:border-brand-violet"
            >
              <option value="">— skip —</option>
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, string>[];
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg overflow-auto">
      <div className="text-xs font-semibold uppercase tracking-wider text-brand-textMuted p-3 border-b border-brand-border">
        Preview · first {rows.length} rows
      </div>
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-brand-textMuted">
            {columns.map((c) => (
              <th key={c} className="text-left font-semibold px-3 py-2 border-b border-brand-border">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-brand-border/40 last:border-b-0">
              {columns.map((c) => (
                <td key={c} className="px-3 py-1.5 text-brand-textActive font-mono whitespace-nowrap">
                  {r[c] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: 'good' | 'bad' | 'neutral' }) {
  const colour =
    tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-brand-textActive';
  return (
    <div>
      <div className={`text-2xl font-bold ${colour}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-brand-textMuted">{label}</div>
    </div>
  );
}
