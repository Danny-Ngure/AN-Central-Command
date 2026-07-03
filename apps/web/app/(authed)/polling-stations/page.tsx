import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { pollingStations, wards } from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { streamsForStation } from '@/data/nyali-polling-streams';

// /polling-stations — constituency-wide index of every polling CENTRE (venue),
// grouped by ward. Each centre expands to its polling STATIONS (streams) with the
// registered voters per stream. Data: IEBC 2022 Register of Voters.
//
// Server-rendered; expand/collapse uses native <details> so it works without JS
// and stays tidy on phones.

export default async function PollingStationsIndexPage() {
  const claims = await getServerAuthOrRedirect();

  const rows = await withRlsTx(claims, async (tx) =>
    tx
      .select({
        id: pollingStations.id,
        name: pollingStations.name,
        iebcCode: pollingStations.iebcCode,
        registeredVoters: pollingStations.registeredVoters,
        wardId: pollingStations.wardId,
        wardName: wards.name,
      })
      .from(pollingStations)
      .leftJoin(wards, eq(wards.id, pollingStations.wardId))
      .orderBy(asc(wards.name), asc(pollingStations.name)),
  );

  // Group centres by ward, preserving alphabetical order.
  const byWard = new Map<string, { wardId: string; wardName: string; centres: typeof rows }>();
  for (const r of rows) {
    const key = r.wardName ?? 'Unassigned';
    if (!byWard.has(key)) byWard.set(key, { wardId: r.wardId, wardName: key, centres: [] });
    byWard.get(key)!.centres.push(r);
  }

  const totalCentres = rows.length;
  let totalStreams = 0;
  let totalRegistered = 0;
  for (const r of rows) {
    totalRegistered += r.registeredVoters ?? 0;
    totalStreams += streamsForStation(r.name)?.streams.length ?? 0;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <Breadcrumbs items={[{ label: 'Home', href: '/dashboard' }, { label: 'Polling Stations' }]} />

      {/* Header + summary */}
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-brand-textActive">Polling Centres &amp; Stations</h1>
        <p className="text-sm text-brand-textMuted max-w-2xl">
          Every polling centre in Nyali, grouped by ward. A <strong>centre</strong> is the venue; on election day it
          runs one or more <strong>stations</strong> (streams). Tap a centre to see its streams and registered voters,
          or open it for the full voter list.
        </p>
        <div className="flex flex-wrap gap-3">
          <Stat value={totalCentres} label="Polling centres" tone="teal" />
          <Stat value={totalStreams} label="Polling stations (streams)" tone="orange" />
          <Stat value={totalRegistered.toLocaleString()} label="Registered voters (IEBC 2022)" tone="blue" />
        </div>
      </header>

      {/* Ward sections */}
      {Array.from(byWard.values()).map((w) => (
        <section key={w.wardName} className="space-y-3">
          <div className="flex items-baseline justify-between gap-2 border-b border-brand-border pb-2">
            <h2 className="text-lg font-bold text-brand-textActive">{w.wardName}</h2>
            <Link
              href={`/wards/${w.wardId}?tab=stations`}
              className="text-xs font-semibold text-brand-tealBlue hover:text-brand-burnt whitespace-nowrap"
            >
              {w.centres.length} centres · open ward →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {w.centres.map((c) => {
              const ss = streamsForStation(c.name);
              const nStreams = ss?.streams.length ?? 0;
              return (
                <div key={c.id} className="rounded-xl border border-brand-border bg-brand-cardBg overflow-hidden">
                  <div className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <Link
                        href={`/polling-stations/${c.id}`}
                        className="block font-bold text-brand-textActive hover:text-brand-burnt truncate"
                      >
                        {c.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-brand-textMuted">
                        <span className="inline-flex items-center rounded-full bg-brand-tealBlue/10 border border-brand-tealBlue/30 px-2 py-0.5 font-semibold text-brand-tealBlue">
                          {nStreams} stream{nStreams === 1 ? '' : 's'}
                        </span>
                        <span className="tabular-nums">{(c.registeredVoters ?? 0).toLocaleString()} registered</span>
                      </div>
                    </div>
                    <Link
                      href={`/polling-stations/${c.id}`}
                      className="shrink-0 rounded-md bg-brand-tealBlue px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-tealBright whitespace-nowrap"
                    >
                      View voters →
                    </Link>
                  </div>

                  {ss && (
                    <details className="group border-t border-brand-border/60">
                      <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-2.5 text-xs font-semibold text-brand-textBody hover:bg-black/5">
                        <span>View {nStreams} polling stream{nStreams === 1 ? '' : 's'}</span>
                        <span className="text-brand-textMuted transition-transform group-open:rotate-180">▾</span>
                      </summary>
                      <ul className="px-4 pb-3 pt-1 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {ss.streams.map((v, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between rounded-md bg-brand-cardBgHeavy/40 border border-brand-border/50 px-2 py-1 text-[11px]"
                          >
                            <span className="font-semibold text-brand-textActive">Stream {String(i + 1).padStart(3, '0')}</span>
                            <span className="tabular-nums text-brand-textMuted">{v.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Footnote */}
      <footer className="border-t border-brand-border pt-4 text-[11px] text-brand-textMuted space-y-1">
        <p>
          <strong>Data source:</strong> IEBC Register of Voters, 2022 General Election (Mombasa County 001 · Nyali
          Constituency 004). Per-station figures via kenyayote.co.ke; centre names cross-checked with AfroCave.
        </p>
        <p>
          A polling <strong>centre</strong> is the physical venue; a polling <strong>station / stream</strong> is a desk
          within it. Nyali has {totalCentres} centres running {totalStreams} streams. Provisional internal codes are
          shown until official IEBC/KIEMS station codes are confirmed.
        </p>
      </footer>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string | number; label: string; tone: 'teal' | 'orange' | 'blue' }) {
  const color =
    tone === 'teal' ? 'text-brand-tealBlue' : tone === 'orange' ? 'text-brand-orangeBright' : 'text-brand-skyBlue';
  return (
    <div className="rounded-xl border border-brand-border bg-brand-cardBg px-4 py-3 min-w-[8.5rem]">
      <div className={`text-2xl font-extrabold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-brand-textMuted font-semibold">{label}</div>
    </div>
  );
}
