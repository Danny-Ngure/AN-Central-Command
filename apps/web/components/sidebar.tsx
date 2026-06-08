'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Sidebar nav. Role-gated items only render when the user is in the allowlist
// (e.g. Data Import is privileged — campaign_manager, candidate, chief_strategist,
// constituency_coordinator, tech_lead). API endpoints enforce the same gate
// server-side; this client-side check is purely UX.

const PRIVILEGED_ROLES = new Set([
  'candidate',
  'campaign_manager',
  'chief_strategist',
  'constituency_coordinator',
  'tech_lead',
]);

interface NavItem {
  href: string;
  label: string;
  rolesAllowed?: Set<string>;
}

const NAV: NavItem[] = [
  { href: '/dashboard',   label: 'Home' },
  { href: '/wards',       label: 'Wards' },
  { href: '/voters',      label: 'Voter Search' },
  { href: '/analytics',   label: 'Pollings & Analysis' },
  { href: '/team',        label: 'Team Directory' },
  { href: '/audit',       label: 'Audit Logs' },
  { href: '/data-import', label: 'Data Import',    rolesAllowed: PRIVILEGED_ROLES },
];

interface Props {
  role: string;
}

export function Sidebar({ role }: Props) {
  const pathname = usePathname();
  const visible = NAV.filter((n) => !n.rolesAllowed || n.rolesAllowed.has(role));

  return (
    <aside className="w-64 border-r border-brand-border bg-brand-cardBg/60 p-4 shrink-0">
      <nav className="space-y-1">
        {visible.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'block px-3 py-2 rounded-lg text-sm font-medium transition',
                active
                  ? 'bg-brand-violet text-white'
                  : 'text-brand-textMuted hover:bg-black hover:text-brand-textActive',
              ].join(' ')}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 pt-4 border-t border-brand-border/60 text-[10px] text-brand-textMuted space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="uppercase text-emerald-400 font-bold tracking-wider">
            Secure Database Link
          </span>
        </div>
        <p className="leading-relaxed">RLS-enforced — scope follows your role.</p>
      </div>
    </aside>
  );
}
