import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { flamesCrew, pollingStations, voters, wards } from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { PhoneActions } from '@/components/phone-actions';

// /flames — Alfayo Flames Crew.
//
// The hand-curated ward mobiliser roster, cross-examined against the IEBC voter
// register. Where a crew member is also a registered voter, their official voter
// record (voter number, polling station, gender, age) is embedded inline — see
// tools/seed-flames-crew.cjs for the matching logic.

export const dynamic = 'force-dynamic';

interface CrewRow {
  id: string;
  wardId: string;
  wardName: string;
  position: number;
  fullName: string;
  phone: string | null;
  matchMethod: 'phone' | 'name' | 'unmatched';
  matchNote: string | null;
  voterNumber: string | null;
  voterSurname: string | null;
  voterFirstName: string | null;
  voterGender: string | null;
  voterDob: string | Date | null;
  voterPhone: string | null;
  stationId: string | null;
  stationName: string | null;
}

export default async function FlamesPage() {
  const claims = await getServerAuthOrRedirect();

  const rows = (await withRlsTx(claims, async (tx) =>
    tx
      .select({
        id: flamesCrew.id,
        wardId: flamesCrew.wardId,
        wardName: wards.name,
        position: flamesCrew.position,
        fullName: flamesCrew.fullName,
        phone: flamesCrew.phone,
        matchMethod: flamesCrew.matchMethod,
        matchNote: flamesCrew.matchNote,
        voterNumber: voters.voterNumber,
        voterSurname: voters.surname,
        voterFirstName: voters.firstName,
        voterGender: voters.gender,
        voterDob: voters.dateOfBirth,
        voterPhone: voters.phone,
        stationId: voters.pollingStationId,
        stationName: pollingStations.name,
      })
      .from(flamesCrew)
      .innerJoin(wards, eq(wards.id, flamesCrew.wardId))
      .leftJoin(voters, eq(voters.id, flamesCrew.voterId))
      .leftJoin(pollingStations, eq(pollingStations.id, voters.pollingStationId))
      .orderBy(asc(wards.name), asc(flamesCrew.position)),
  )) as CrewRow[];

  const total = rows.length;
  const matched = rows.filter((r) => r.matchMethod !== 'unmatched').length;
  const byPhone = rows.filter((r) => r.matchMethod === 'phone').length;
  const byName = rows.filter((r) => r.matchMethod === 'name').length;
  const rate = total ? Math.round((matched / total) * 100) : 0;

  // Group by ward, preserving the name ordering from the query.
  const wardsMap = new Map<string, CrewRow[]>();
  for (const r of rows) {
    if (!wardsMap.has(r.wardName)) wardsMap.set(r.wardName, []);
    wardsMap.get(r.wardName)!.push(r);
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive flex items-center gap-2">
          <span>🔥</span> Alfayo Flames Crew
        </h1>
        <p className="text-sm text-brand-textMuted">
          Ward mobiliser roster, cross-examined against the IEBC voter register. A{' '}
          <span className="text-brand-orangeBright font-semibold">registered voter</span> badge means
          the member was matched to an official voter record — their voter data is embedded below.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Crew members" value={total} />
        <Stat label="Matched voters" value={matched} accent="emerald" />
        <Stat label="By phone / name" value={`${byPhone} / ${byName}`} />
        <Stat label="Match rate" value={`${rate}%`} accent="orange" />
      </section>

      {[...wardsMap.entries()].map(([wardName, members]) => {
        const wardMatched = members.filter((m) => m.matchMethod !== 'unmatched').length;
        const wardId = members[0]!.wardId;
        return (
          <section key={wardName} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-skyBlue">
                {wardName}
              </h2>
              <span className="text-xs text-brand-textMuted">
                {wardMatched}/{members.length} matched ·{' '}
                <Link href={`/wards/${wardId}`} className="text-brand-skyBlue hover:underline">
                  open ward
                </Link>
              </span>
            </div>
            <div className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden divide-y divide-brand-border/50">
              {members.map((m) => (
                <CrewCard key={m.id} m={m} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CrewCard({ m }: { m: CrewRow }) {
  const isMatched = m.matchMethod !== 'unmatched';
  return (
    <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-black/20">
      <div className="flex items-start gap-3 min-w-0">
        <span className="shrink-0 mt-0.5 w-6 h-6 rounded-md bg-brand-tealBlue/20 text-brand-tealBlue text-xs font-bold inline-flex items-center justify-center tabular-nums">
          {m.position}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-brand-textActive">{m.fullName}</span>
            {m.matchMethod !== 'unmatched' ? (
              <MatchBadge method={m.matchMethod} />
            ) : (
              <span
                className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-textMuted/15 text-brand-textMuted"
                title={m.matchNote ?? undefined}
              >
                Unmatched
              </span>
            )}
          </div>

          {isMatched ? (
            <div className="mt-1 text-xs text-brand-textMuted flex flex-wrap gap-x-3 gap-y-0.5">
              <span>
                Voter <span className="font-mono text-brand-textActive">{m.voterNumber}</span>
              </span>
              <span>
                {m.voterSurname}, {m.voterFirstName}
              </span>
              {m.voterGender && <span>{m.voterGender === 'F' ? 'Female' : m.voterGender === 'M' ? 'Male' : '—'}</span>}
              {m.voterDob && <span>Age {ageFromDob(m.voterDob)}</span>}
              {m.stationName && (
                <Link
                  href={`/polling-stations/${m.stationId}`}
                  className="text-brand-skyBlue hover:underline"
                >
                  {m.stationName}
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-0.5 text-[11px] text-brand-textMuted italic">
              {m.matchNote ?? 'Not found in the voter register.'}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 sm:pl-3">
        <PhoneActions
          phone={m.phone ?? m.voterPhone}
          size="sm"
          defaultMessage={`Habari ${m.fullName.split(' ')[0]}. Hii ni timu ya Alfayo Nelson – Flames.`}
        />
      </div>
    </div>
  );
}

function MatchBadge({ method }: { method: 'phone' | 'name' }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
      ✓ Registered voter
      <span className="ml-1 text-emerald-300/70 normal-case font-normal">via {method}</span>
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: 'emerald' | 'orange';
}) {
  const colour =
    accent === 'emerald'
      ? 'text-emerald-400'
      : accent === 'orange'
      ? 'text-brand-orangeBright'
      : 'text-brand-textActive';
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${colour}`}>{value}</div>
    </div>
  );
}

function ageFromDob(dob: string | Date | null): string {
  if (!dob) return '—';
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const mo = now.getMonth() - d.getMonth();
  if (mo < 0 || (mo === 0 && now.getDate() < d.getDate())) age--;
  if (age < 0 || age > 120) return '—';
  return String(age);
}
