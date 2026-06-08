import Link from 'next/link';
import { PhoneActions } from './phone-actions';

// Shared voter list + pagination — used by:
//   /voters                 (constituency-wide)
//   /wards/[id]/voters      (ward-scoped)
//   /polling-stations/[id]  (station-scoped, already inlined there)
//
// Why a component, not a hook: every consumer is a server component that has
// already done its RLS query. This is purely presentational.

export interface VoterRow {
  id: string;
  surname: string;
  firstName: string;
  gender: string;
  dateOfBirth: string | Date | null;
  phone: string | null;
  wardName?: string | null;
  wardId?: string | null;
  pollingStationName?: string | null;
  pollingStationId?: string | null;
}

interface Props {
  rows: VoterRow[];
  total: number;
  page: number;
  pageSize: number;
  basePath: string;                              // e.g. '/voters' or '/wards/<id>/voters'
  preserveParams: Record<string, string | null>; // current filters to carry through page links
  showWard?: boolean;                            // false on ward-scoped pages
  showStation?: boolean;                         // true everywhere — link to station detail
  defaultMessage?: (v: VoterRow) => string;      // pre-fill text for SMS / WhatsApp
}

export function VoterList({
  rows,
  total,
  page,
  pageSize,
  basePath,
  preserveParams,
  showWard = true,
  showStation = true,
  defaultMessage,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-brand-border bg-brand-cardBg overflow-auto">
        <div className="flex items-baseline justify-between px-4 py-3 border-b border-brand-border">
          <h2 className="text-xs font-bold uppercase tracking-wider text-brand-textMuted">
            Voters · Page {page} of {pageCount} · {total.toLocaleString()} matching
          </h2>
        </div>
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-brand-textMuted">
              <th className="text-left font-semibold px-3 py-2 border-b border-brand-border">Surname</th>
              <th className="text-left font-semibold px-3 py-2 border-b border-brand-border">First name</th>
              <th className="text-left font-semibold px-3 py-2 border-b border-brand-border">Gender</th>
              <th className="text-left font-semibold px-3 py-2 border-b border-brand-border">Age</th>
              {showWard && <th className="text-left font-semibold px-3 py-2 border-b border-brand-border">Ward</th>}
              {showStation && <th className="text-left font-semibold px-3 py-2 border-b border-brand-border">Polling station</th>}
              <th className="text-left font-semibold px-3 py-2 border-b border-brand-border">Phone</th>
              <th className="text-right font-semibold px-3 py-2 border-b border-brand-border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-b border-brand-border/40 last:border-b-0 hover:bg-black/30">
                <td className="px-3 py-2 text-brand-textActive font-semibold whitespace-nowrap">{v.surname}</td>
                <td className="px-3 py-2 text-brand-textActive whitespace-nowrap">{v.firstName}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <GenderBadge gender={v.gender} />
                </td>
                <td className="px-3 py-2 text-brand-textMuted tabular-nums whitespace-nowrap">
                  {ageFromDob(v.dateOfBirth)}
                </td>
                {showWard && (
                  <td className="px-3 py-2 whitespace-nowrap">
                    {v.wardId && v.wardName ? (
                      <Link href={`/wards/${v.wardId}`} className="text-brand-skyBlue hover:underline">
                        {v.wardName}
                      </Link>
                    ) : (
                      <span className="text-brand-textMuted italic">—</span>
                    )}
                  </td>
                )}
                {showStation && (
                  <td className="px-3 py-2 whitespace-nowrap max-w-[260px] truncate">
                    {v.pollingStationId && v.pollingStationName ? (
                      <Link
                        href={`/polling-stations/${v.pollingStationId}`}
                        className="text-brand-skyBlue hover:underline"
                        title={v.pollingStationName}
                      >
                        {v.pollingStationName}
                      </Link>
                    ) : (
                      <span className="text-brand-textMuted italic">—</span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2 text-brand-textMuted font-mono whitespace-nowrap">
                  {v.phone ? maskPhone(v.phone) : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex">
                    <PhoneActions
                      phone={v.phone}
                      size="sm"
                      defaultMessage={defaultMessage?.(v)}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={showWard && showStation ? 8 : showWard || showStation ? 7 : 6} className="px-3 py-8 text-center text-brand-textMuted italic">
                  No voters match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <Pagination
          page={page}
          pageCount={pageCount}
          basePath={basePath}
          preserveParams={preserveParams}
        />
      )}
    </div>
  );
}

// ---- subcomponents ---------------------------------------------------------

function GenderBadge({ gender }: { gender: string }) {
  const colour =
    gender === 'M' ? 'bg-brand-skyBlue/20 text-brand-skyBlue' :
    gender === 'F' ? 'bg-brand-orangeBright/20 text-brand-orangeBright' :
    'bg-brand-textMuted/20 text-brand-textMuted';
  const label = gender === 'M' ? 'M' : gender === 'F' ? 'F' : '?';
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${colour}`}>
      {label}
    </span>
  );
}

function ageFromDob(dob: string | Date | null): string {
  if (!dob) return '—';
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 0 || age > 120) return '—';
  return String(age);
}

function maskPhone(phone: string): string {
  const m = phone.match(/^(\+\d{3})(\d{3})\d{3}(\d{3,4})$/);
  if (!m) return phone;
  return `${m[1]} ${m[2]} ••• ${m[3]}`;
}

function Pagination({
  page,
  pageCount,
  basePath,
  preserveParams,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  preserveParams: Record<string, string | null>;
}) {
  function url(p: number) {
    const params = new URLSearchParams();
    if (p > 1) params.set('page', String(p));
    for (const [k, v] of Object.entries(preserveParams)) {
      if (v != null && v !== '') params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }
  const around = 2;
  const start = Math.max(1, page - around);
  const end = Math.min(pageCount, page + around);
  const numbers: number[] = [];
  for (let i = start; i <= end; i++) numbers.push(i);

  return (
    <nav className="flex items-center justify-center gap-1 flex-wrap">
      <PageLink href={url(Math.max(1, page - 1))} disabled={page === 1}>← Prev</PageLink>
      {start > 1 && (
        <>
          <PageLink href={url(1)}>1</PageLink>
          {start > 2 && <span className="px-1 text-brand-textMuted">…</span>}
        </>
      )}
      {numbers.map((n) => (
        <PageLink key={n} href={url(n)} active={n === page}>
          {n}
        </PageLink>
      ))}
      {end < pageCount && (
        <>
          {end < pageCount - 1 && <span className="px-1 text-brand-textMuted">…</span>}
          <PageLink href={url(pageCount)}>{pageCount}</PageLink>
        </>
      )}
      <PageLink href={url(Math.min(pageCount, page + 1))} disabled={page === pageCount}>Next →</PageLink>
    </nav>
  );
}

function PageLink({
  href,
  children,
  active,
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="px-2 py-1 rounded text-xs text-brand-textMuted/50 cursor-not-allowed">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={[
        'px-2 py-1 rounded text-xs font-semibold',
        active
          ? 'bg-brand-tealBlue text-white'
          : 'text-brand-textActive hover:bg-black/40',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}
