'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// The full suite-switcher (Command vs Data Entry) and badge counts arrive in a
// later Phase 4 commit. This is the minimal navigation for the dashboard skeleton.

const NAV = [
  { href: '/dashboard', label: 'Zen Dashboard' },
  { href: '/analytics', label: 'Pollings & Analysis' },
  { href: '/community', label: 'Community Intel' },
  { href: '/supporters', label: 'Supporter Network' },
  { href: '/issues', label: 'Issue Tracker' },
  { href: '/team', label: 'Team Directory' },
  { href: '/audit', label: 'Audit Logs' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-brand-border bg-brand-cardBg/60 p-4 shrink-0">
      <nav className="space-y-1">
        {NAV.map((item) => {
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
