import Link from 'next/link';
import { sql, eq, and, asc, isNull } from 'drizzle-orm';
import { pollingStations, voters, wards } from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { withRlsTx } from '@/lib/api';
import { VoterList } from '@/components/voter-list';

// /voters — constituency-wide voter search.
//
// Search params:
//   ?q=string          surname or first-name prefix (ILIKE)
//   ?ward=<id>         restrict to one ward (drop-down filter)
//   ?station=<id>      restrict to one polling station (drop-down filter)
//   ?gender=M|F|U      gender filter
//   ?age=youth|mid|senior   age band filter (18-34 / 35-59 / 60+)
//   ?hasPhone=1|0      has-phone filter
//   ?page=N            1-indexed page number
//
// Page size is 50. With ~85k voters and proper indexes (voters_ward_idx,
// voters_polling_station_idx, voters_surname_idx, voters_gender_idx, voters_dob_idx)
// every filtered query stays sub-100ms.

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: {
    q?: string;
    ward?: string;
    station?: string;
    gender?: string;
    age?: string;
    hasPhone?: string;
    page?: string;
  };
}

export default async function VotersPage({ searchParams }: PageProps) {
  const claims = await getServerAuthOrRedirect();
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const q = (searchParams.q ?? '').trim();
  const wardId = searchParams.ward || null;
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
    const wardRows = await tx.select({ id: wards.id, name: wards.name }).from(wards).orderBy(asc(wards.name));

    // Stations list — when a ward is selected, scope the picker to that ward.
    const stationFilter = wardId ? eq(pollingStations.wardId, wardId) : undefined;
    const stationRows = await tx
      .select({ id: pollingStations.id, name: pollingStations.name, wardId: pollingStations.wardId })
      .from(pollingStations)
      .where(stationFilter)
      .orderBy(asc(pollingStations.name));

    const filters = [isNull(voters.consentWithdrawnAt)];
    if (wardId) filters.push(eq(voters.wardId, wardId));
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
        wardId: voters.wardId,
        wardName: wards.name,
        pollingStationId: voters.pollingStationId,
        pollingStationName: pollingStations.name,
      })
      .from(voters)
      .leftJoin(wards, eq(wards.id, voters.wardId))
      .leftJoin(pollingStations, eq(pollingStations.id, voters.pollingStationId))
      .where(where)
      .orderBy(asc(voters.surname), asc(voters.firstName))
      .limit(PAGE_SIZE)
      .offset(offset);

    return { wards: wardRows, stations: stationRows, rows, total: countRow?.total ?? 0 };
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">Voter Search</h1>
        <p className="text-sm text-brand-textMuted">
          All voters across Nyali Constituency. Filter by ward, polling station, gender,
          age band, or phone availability. Search by surname or first name.
        </p>
      </header>

      <FilterBar
        q={q}
        wardId={wardId}
        stationId={stationId}
        gender={gender}
        age={age}
        hasPhone={hasPhone}
        wards={data.wards}
        stations={data.stations}
      />

      <VoterList
        rows={data.rows}
        total={data.total}
        page={page}
        pageSize={PAGE_SIZE}
        basePath="/voters"
        preserveParams={{
          q,
          ward: wardId,
          station: stationId,
          gender,
          age,
          hasPhone: hasPhone === true ? '1' : hasPhone === false ? '0' : null,
        }}
        showWard
        showStation
        defaultMessage={(v) =>
          `Habari ${v.firstName}. Hii ni timu ya Alfayo Nelson kwa Nyali Constituency.`
        }
      />
    </div>
  );
}

interface FilterBarProps {
  q: string;
  wardId: string | null;
  stationId: string | null;
  gender: 'M' | 'F' | 'U' | null;
  age: 'youth' | 'mid' | 'senior' | null;
  hasPhone: boolean | null;
  wards: { id: string; name: string }[];
  stations: { id: string; name: string; wardId: string }[];
}

function FilterBar({
  q, wardId, stationId, gender, age, hasPhone, wards, stations,
}: FilterBarProps) {
  const hasAny = q || wardId || stationId || gender || age || hasPhone !== null;
  return (
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
      <Field label="Ward">
        <select
          name="ward"
          defaultValue={wardId ?? ''}
          className="w-full bg-brand-field border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-tealBlue"
        >
          <option value="">All wards</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Polling station">
        <select
          name="station"
          defaultValue={stationId ?? ''}
          className="w-full bg-brand-field border border-brand-border rounded-md px-3 py-2 text-sm text-brand-textActive focus:outline-none focus:border-brand-tealBlue"
        >
          <option value="">{wardId ? 'All stations in this ward' : 'All stations'}</option>
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
        {hasAny && (
          <Link
            href="/voters"
            className="rounded-md border border-brand-border px-4 py-2 text-sm font-semibold text-brand-textActive hover:border-brand-tealBlue"
          >
            Clear all
          </Link>
        )}
      </div>
    </form>
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
