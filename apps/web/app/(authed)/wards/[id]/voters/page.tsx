import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql, eq, and, asc, isNull } from 'drizzle-orm';
import { pollingStations, voters, wards } from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { VoterList } from '@/components/voter-list';

// /wards/[id]/voters — ward-scoped voter search.
//
// Same params as /voters, minus ?ward (implied by URL). Polling-station picker
// only shows stations in this ward.

const PAGE_SIZE = 50;

interface PageProps {
  params: { id: string };
  searchParams: {
    q?: string;
    station?: string;
    gender?: string;
    age?: string;
    hasPhone?: string;
    page?: string;
  };
}

export default async function WardVotersPage({ params, searchParams }: PageProps) {
  const claims = await getServerAuthOrRedirect();
  const wardId = params.id;
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const q = (searchParams.q ?? '').trim();
  const stationId = searchParams.station || null;
  const gender = ['M', 'F', 'U'].includes(searchParams.gender ?? '')
    ? (searchParams.gender as 'M' | 'F' | 'U')
    : null;
  const age = ['youth', 'mid', 'senior'].includes(searchParams.age ?? '')
    ? (searchParams.age as 'youth' | 'mid' | 'senior')
    : null;
  const hasPhone = searchParams.hasPhone === '1' ? true : searchParams.hasPhone === '0' ? false : null;
  const offset = (page - 1) * PAGE_SIZE;

  const data = await withRlsTx(claims, async (tx) => {
    const wardRows = await tx
      .select({ id: wards.id, name: wards.name })
      .from(wards)
      .where(eq(wards.id, wardId))
      .limit(1);
    if (wardRows.length === 0) return null;
    const ward = wardRows[0]!;

    const stationRows = await tx
      .select({ id: pollingStations.id, name: pollingStations.name })
      .from(pollingStations)
      .where(eq(pollingStations.wardId, wardId))
      .orderBy(asc(pollingStations.name));

    const filters = [
      eq(voters.wardId, wardId),
      isNull(voters.consentWithdrawnAt),
    ];
    if (stationId) filters.push(eq(voters.pollingStationId, stationId));
    if (gender) filters.push(eq(voters.gender, gender));
    if (q) {
      filters.push(
        sql`(${voters.surname} ILIKE ${q + '%'} OR ${voters.firstName} ILIKE ${q + '%'})`,
      );
    }
    if (age === 'youth') {
      filters.push(sql`${voters.dateOfBirth} IS NOT NULL AND date_part('year', age(${voters.dateOfBirth})) BETWEEN 18 AND 34`);
    } else if (age === 'mid') {
      filters.push(sql`${voters.dateOfBirth} IS NOT NULL AND date_part('year', age(${voters.dateOfBirth})) BETWEEN 35 AND 59`);
    } else if (age === 'senior') {
      filters.push(sql`${voters.dateOfBirth} IS NOT NULL AND date_part('year', age(${voters.dateOfBirth})) >= 60`);
    }
    if (hasPhone === true) filters.push(sql`${voters.phone} IS NOT NULL`);
    if (hasPhone === false) filters.push(sql`${voters.phone} IS NULL`);
    const where = and(...filters);

    const [countRow] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(voters)
      .where(where);

    const rows = await tx
      .select({
        id: voters.id,
        surname: voters.surname,
        firstName: voters.firstName,
        gender: voters.gender,
        dateOfBirth: voters.dateOfBirth,
        phone: voters.phone,
        pollingStationId: voters.pollingStationId,
        pollingStationName: pollingStations.name,
      })
      .from(voters)
      .leftJoin(pollingStations, eq(pollingStations.id, voters.pollingStationId))
      .where(where)
      .orderBy(asc(voters.surname), asc(voters.firstName))
      .limit(PAGE_SIZE)
      .offset(offset);

    return { ward, stations: stationRows, rows, total: countRow?.total ?? 0 };
  });

  if (!data) notFound();
  const { ward, stations, rows, total } = data;
  const basePath = `/wards/${wardId}/voters`;

  return (
    <div className="space-y-6 max-w-7xl">
      <Breadcrumbs
        items={[
          { label: 'Wards', href: '/wards' },
          { label: ward.name, href: `/wards/${wardId}` },
          { label: 'Voters' },
        ]}
      />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">
          Voters in {ward.name}
        </h1>
        <p className="text-sm text-brand-textMuted">
          {total.toLocaleString()} voter{total === 1 ? '' : 's'} matching your filters.
        </p>
      </header>

      <form className="rounded-xl border border-brand-border bg-brand-cardBg p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Search (surname or first name)" wide>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="e.g. Mwangi"
            className="w-full bg-brand-field border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-tealBlue"
          />
        </Field>
        <Field label="Polling station">
          <select
            name="station"
            defaultValue={stationId ?? ''}
            className="w-full bg-brand-field border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-tealBlue"
          >
            <option value="">All stations in {ward.name}</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Gender">
          <select
            name="gender"
            defaultValue={gender ?? ''}
            className="w-full bg-brand-field border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-tealBlue"
          >
            <option value="">All</option>
            <option value="M">Men</option>
            <option value="F">Women</option>
            <option value="U">Unknown</option>
          </select>
        </Field>
        <Field label="Age band">
          <select
            name="age"
            defaultValue={age ?? ''}
            className="w-full bg-brand-field border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-tealBlue"
          >
            <option value="">All ages</option>
            <option value="youth">Youth (18-34)</option>
            <option value="mid">Mid (35-59)</option>
            <option value="senior">Senior (60+)</option>
          </select>
        </Field>
        <Field label="Phone">
          <select
            name="hasPhone"
            defaultValue={hasPhone === true ? '1' : hasPhone === false ? '0' : ''}
            className="w-full bg-brand-field border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-tealBlue"
          >
            <option value="">All</option>
            <option value="1">Has phone</option>
            <option value="0">No phone</option>
          </select>
        </Field>
        <div className="md:col-span-2 xl:col-span-3 flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md bg-brand-tealBlue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-tealBright"
          >
            Apply filters
          </button>
          <Link
            href={basePath}
            className="rounded-md border border-brand-border px-4 py-2 text-sm font-semibold text-brand-textActive hover:border-brand-tealBlue"
          >
            Clear all
          </Link>
        </div>
      </form>

      <VoterList
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        basePath={basePath}
        preserveParams={{
          q,
          station: stationId,
          gender,
          age,
          hasPhone: hasPhone === true ? '1' : hasPhone === false ? '0' : null,
        }}
        showWard={false}
        showStation
        defaultMessage={(v) =>
          `Habari ${v.firstName}. Hii ni timu ya Alfayo Nelson kwa ${ward.name}.`
        }
      />
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'md:col-span-2' : ''}>
      <label className="text-[10px] font-bold uppercase tracking-wider text-brand-textMuted block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
