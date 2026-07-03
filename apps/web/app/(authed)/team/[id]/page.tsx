import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@an/db';
import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { isSuperAdmin } from '@/lib/admin';
import { PhoneActions } from '@/components/phone-actions';
import { IdCard } from '@/components/id-card';
import { AdminResetPassword } from '@/components/admin-reset-password';

// Person 360 — one screen that pulls a team member together with every other
// place they appear in the system:
//   • their campaign role / docket / home ward
//   • community-leader / village-elder / chief records that match them
//   • community-site contact records
//   • their IEBC voter registration → WHERE THEY VOTE (polling station)
//
// Matching is conservative: National ID (exact) → phone (last 9 digits) →
// exact full-name. This avoids mis-linking two different people.

const ROLE_LABEL: Record<string, string> = {
  candidate: 'Aspirant', campaign_manager: 'Campaign Manager', chief_strategist: 'Chief Strategist',
  constituency_coordinator: 'Constituency Coordinator', media_head: 'Media Head', comms_head: 'Comms Head',
  patron_ceo: 'Patron / CEO', ward_coordinator: 'Ward Coordinator',
  assistant_ward_coordinator: 'Assistant Ward Coordinator', polling_station_lead: 'Polling Station Lead',
  polling_agent: 'Polling Agent', canvasser: 'Canvasser', influence_liaison: 'Influence Liaison',
  tech_lead: 'Tech Lead', finance_lead: 'Finance Lead',
};

// Verified IEBC registrations for members whose registered name differs from their
// campaign name, so the name/phone/ID auto-match can't find them. Confirmed against
// the official IEBC Voter Verification Portal (verify.iebc.or.ke). Keyed by campaign
// full name. Alfayo Nelson is registered as "Nyangwara Nelson".
const MANUAL_REGISTRATION: Record<
  string,
  { registeredAs: string; ward: string; pollingCentre: string; pollingCode?: string | null; nationalId?: string | null }
> = {
  'Alfayo Nelson': { registeredAs: 'Nyangwara Nelson', ward: 'Kadzandani', pollingCentre: 'Mwatamba Grounds' },
};

export default async function PersonProfile({ params }: { params: { id: string } }) {
  const claims = await getServerAuthOrRedirect();
  const viewerIsSuper = await isSuperAdmin(claims.sub);

  const personRows = (await db.execute(sql`
    SELECT p.id, p.full_name, p.role, p.title, p.phone, p.email, p.national_id,
           p.photo_url, p.last_active_at, p.ward_id, p.team_id, p.agent_id, p.agent_station,
           w.name AS ward_name
    FROM people p LEFT JOIN wards w ON w.id = p.ward_id
    WHERE p.id = ${params.id} AND p.deleted_at IS NULL
    LIMIT 1
  `)) as any[];
  const p = personRows[0];
  if (!p) notFound();

  const tail = String(p.phone ?? '').replace(/\D/g, '').slice(-9);
  const nid = String(p.national_id ?? '').trim();

  // Community leaders / village elders / chiefs matching this person.
  const leaders = (await db.execute(sql`
    SELECT cl.full_name, cl.role_title, cl.phone, w.name AS ward_name, v.name AS village_name
    FROM community_leaders cl
    LEFT JOIN wards w ON w.id = cl.ward_id
    LEFT JOIN villages v ON v.id = cl.village_id
    WHERE ( ${tail} <> '' AND right(regexp_replace(coalesce(cl.phone,''), '\\D', '', 'g'), 9) = ${tail} )
       OR lower(cl.full_name) = lower(${p.full_name})
    LIMIT 25
  `)) as any[];

  // Community-site contact records matching this person.
  const sites = (await db.execute(sql`
    SELECT cs.name, cs.type, cs.area_name, cs.contact_role, w.name AS ward_name
    FROM community_sites cs
    LEFT JOIN wards w ON w.id = cs.ward_id
    WHERE cs.deleted_at IS NULL
      AND ( ( ${tail} <> '' AND right(regexp_replace(coalesce(cs.contact_phone,''), '\\D', '', 'g'), 9) = ${tail} )
            OR lower(coalesce(cs.contact_person_name,'')) = lower(${p.full_name}) )
    LIMIT 25
  `)) as any[];

  // IEBC voter registration → polling station (where they vote).
  const voters = (await db.execute(sql`
    SELECT v.first_name, v.surname, v.national_id, w.name AS ward_name,
           ps.name AS ps_name, ps.iebc_code AS ps_code
    FROM voters v
    LEFT JOIN wards w ON w.id = v.ward_id
    LEFT JOIN polling_stations ps ON ps.id = v.polling_station_id
    WHERE v.consent_withdrawn_at IS NULL
      AND ( ( ${nid} <> '' AND v.national_id = ${nid} )
            OR ( ${tail} <> '' AND right(regexp_replace(coalesce(v.phone,''), '\\D', '', 'g'), 9) = ${tail} )
            OR lower(v.first_name || ' ' || v.surname) = lower(${p.full_name})
            OR lower(v.surname || ' ' || v.first_name) = lower(${p.full_name}) )
    LIMIT 10
  `)) as any[];

  // Fall back to a verified IEBC registration when the auto-match found nothing
  // (e.g. Alfayo is registered under a different name). Shape it like a voter row.
  const manualReg = MANUAL_REGISTRATION[p.full_name];
  const regRows: any[] =
    voters.length > 0
      ? voters
      : manualReg
        ? [
            {
              first_name: manualReg.registeredAs.split(' ')[0],
              surname: manualReg.registeredAs.split(' ').slice(1).join(' '),
              national_id: manualReg.nationalId ?? null,
              ward_name: manualReg.ward,
              ps_name: manualReg.pollingCentre,
              ps_code: manualReg.pollingCode ?? null,
            },
          ]
        : [];

  const ver = p.last_active_at ? new Date(p.last_active_at).getTime() : 0;
  const photoSrc = p.photo_url ? `${p.photo_url}?v=${ver}` : null;
  const roleLabel = p.title || ROLE_LABEL[p.role] || p.role;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <Link href="/team" className="text-xs font-semibold text-brand-aqua hover:text-brand-skyBlue">← Back to Team</Link>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-brand-textMuted">{p.phone}</span>
          <PhoneActions phone={p.phone} size="sm" />
        </div>
      </div>

      <h1 className="sr-only">{p.full_name}</h1>

      {/* Super-admin (Dan) only: reset this member's password. */}
      {viewerIsSuper && <AdminResetPassword personId={p.id} name={p.full_name} />}

      {/* Member ID card (both sides) */}
      <Section title="Member ID Card" subtitle="Official ANHF membership identification — front &amp; back">
        <IdCard
          variant="member"
          fullName={p.full_name}
          teamId={p.team_id}
          roleLabel={roleLabel}
          wardName={p.ward_name}
          photoSrc={photoSrc}
          nationalId={p.national_id}
          phone={p.phone}
          agentId={p.agent_id}
          pollingCentre={regRows[0]?.ps_name ?? null}
          pollingCode={regRows[0]?.ps_code ?? null}
        />
      </Section>

      {/* Certified Election Agent card — only for polling agents */}
      {p.agent_id && (
        <Section title="Certified Election Agent ID" subtitle="IEBC polling-agent credential — front &amp; back">
          <IdCard
            variant="agent"
            fullName={p.full_name}
            teamId={p.team_id}
            roleLabel={roleLabel}
            wardName={p.ward_name}
            photoSrc={photoSrc}
            nationalId={p.national_id}
            phone={p.phone}
            agentId={p.agent_id}
            agentStation={p.agent_station}
          />
        </Section>
      )}

      {/* Where they vote */}
      <Section title="Where they vote" subtitle="From the IEBC voter register">
        {regRows.length === 0 ? (
          <EmptyNote>
            No voter-register match found. Add this member&apos;s <strong>National ID</strong> to their record
            to link their polling station automatically.
          </EmptyNote>
        ) : (
          <ul className="space-y-2">
            {regRows.map((v, i) => (
              <li key={i} className="rounded-lg border border-brand-border bg-brand-cardBgHeavy px-4 py-3">
                <div className="text-sm font-bold text-brand-textActive">
                  {v.ps_name ?? 'Polling station unknown'}
                  {v.ps_code && <span className="ml-2 text-[11px] font-mono text-brand-textMuted">{v.ps_code}</span>}
                </div>
                <div className="text-[11px] text-brand-textMuted">
                  Registered as {v.first_name} {v.surname}
                  {v.ward_name && <> · {v.ward_name} Ward</>}
                  {v.national_id && <> · ID {v.national_id}</>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Roles across the system */}
      <Section title="Appears in the system as" subtitle="Every record that matches this person">
        <div className="space-y-2">
          <RoleRow tag="Campaign team" label={`${roleLabel}${p.ward_name ? ` — ${p.ward_name} Ward` : ''}`} tone="burnt" />
          {leaders.map((l, i) => (
            <RoleRow
              key={`l${i}`}
              tag={/chief/i.test(l.role_title) ? 'Chief' : /elder|nyumba|mtaa|manager/i.test(l.role_title) ? 'Village elder' : 'Community leader'}
              label={`${l.role_title}${l.village_name ? ` — ${l.village_name}` : ''}${l.ward_name ? `, ${l.ward_name} Ward` : ''}`}
              tone="teal"
            />
          ))}
          {sites.map((s, i) => (
            <RoleRow
              key={`s${i}`}
              tag="Site contact"
              label={`${s.contact_role ?? 'Contact'} — ${s.name} (${String(s.type).replace(/_/g, ' ')})${s.ward_name ? `, ${s.ward_name} Ward` : ''}`}
              tone="sky"
            />
          ))}
          {regRows.map((v, i) => (
            <RoleRow key={`v${i}`} tag="IEBC voter" label={`Registered voter${v.ward_name ? ` — ${v.ward_name} Ward` : ''}`} tone="olive" />
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-brand-border bg-brand-cardBg/60 p-5 space-y-3">
      <div className="border-b border-brand-border pb-2">
        <h2 className="text-sm font-bold text-brand-textActive uppercase tracking-[0.14em]">{title}</h2>
        {subtitle && <p className="text-[11px] text-brand-textMuted mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-brand-border bg-brand-cardBgHeavy/40 px-4 py-4 text-xs text-brand-textMuted">
      {children}
    </div>
  );
}

function RoleRow({ tag, label, tone }: { tag: string; label: string; tone: 'burnt' | 'teal' | 'sky' | 'olive' }) {
  const cls = tone === 'burnt' ? 'bg-brand-burnt/20 text-brand-burnt border-brand-burnt/40'
            : tone === 'teal'  ? 'bg-brand-teal/20 text-brand-teal border-brand-teal/40'
            : tone === 'sky'   ? 'bg-brand-skyBlue/20 text-brand-skyBlue border-brand-skyBlue/40'
            :                    'bg-brand-olive/20 text-brand-olive border-brand-olive/40';
  return (
    <div className="flex items-center gap-3 rounded-lg border border-brand-border bg-brand-cardBgHeavy px-3 py-2">
      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${cls}`}>{tag}</span>
      <span className="text-sm text-brand-textBody">{label}</span>
    </div>
  );
}
