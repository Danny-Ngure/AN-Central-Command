import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, people, wards } from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ImportClient } from '../../../data-import/import-client';

// Ward-scoped voter / sites / polling-station upload.
//
// The ward is taken from the URL — the user's spreadsheet does NOT need a WARD column.
// Every row imported via this page is assigned to this ward. Polling stations mentioned
// in the file (POLLING STATION column) auto-create under this ward only.
//
// Role gate: same as the global Data Import page.

const PRIVILEGED_ROLES = new Set([
  'candidate',
  'campaign_manager',
  'chief_strategist',
  'constituency_coordinator',
  'tech_lead',
]);

interface PageProps {
  params: { id: string };
  searchParams: { entity?: string };
}

export default async function WardImportPage({ params, searchParams }: PageProps) {
  const claims = await getServerAuthOrRedirect();

  const personRows = await db
    .select({ role: people.role, fullName: people.fullName })
    .from(people)
    .where(eq(people.id, claims.sub))
    .limit(1);

  const person = personRows[0];
  if (!person || !PRIVILEGED_ROLES.has(person.role)) {
    redirect(`/wards/${params.id}?reason=insufficient_role`);
  }

  const wardRows = await db
    .select({ id: wards.id, name: wards.name })
    .from(wards)
    .where(eq(wards.id, params.id))
    .limit(1);
  if (wardRows.length === 0) notFound();
  const ward = wardRows[0]!;

  const validEntities = ['voters', 'polling_stations', 'sites'] as const;
  const entity = validEntities.includes(searchParams.entity as any)
    ? (searchParams.entity as (typeof validEntities)[number])
    : 'voters';

  return (
    <div className="space-y-6 max-w-6xl">
      <Breadcrumbs
        items={[
          { label: 'Wards', href: '/wards' },
          { label: ward.name, href: `/wards/${ward.id}` },
          { label: 'Import' },
        ]}
      />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">
          Upload data for {ward.name}
        </h1>
        <p className="text-sm text-brand-textMuted">
          Excel / CSV. The ward is implicit — the WARD column in your file is ignored.
          Polling stations referenced in the file are auto-created under this ward.
        </p>
      </header>

      {/* Entity switch tabs */}
      <div className="flex gap-2 text-xs">
        {validEntities.map((e) => (
          <Link
            key={e}
            href={`/wards/${ward.id}/import?entity=${e}`}
            className={[
              'px-3 py-1.5 rounded-md font-semibold transition',
              e === entity
                ? 'bg-brand-violet text-white'
                : 'border border-brand-border text-brand-textActive hover:border-brand-violet',
            ].join(' ')}
          >
            {e === 'voters' ? 'Voter register' : e === 'polling_stations' ? 'Polling stations' : 'Sites'}
          </Link>
        ))}
      </div>

      <ImportClient
        userRole={person.role}
        userName={person.fullName}
        forcedWardId={ward.id}
        forcedWardName={ward.name}
        defaultEntity={entity}
      />
    </div>
  );
}
