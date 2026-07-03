'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Persistent mobile bottom navigation bar.
//
// Sits fixed at the bottom of the screen on phones (hidden on md+ where the top
// nav is roomy). Four big, thumb-friendly destinations around a prominent raised
// "+ Add" button in the centre, so a user can always get "home to safety" — or add
// data — in one tap, no matter how deep they are. The active tab is clearly
// highlighted so the user always knows where they are.

type Item = { href: string; label: string; match: (p: string) => boolean; icon: JSX.Element };

const ITEMS: Item[] = [
  {
    href: '/dashboard',
    label: 'Home',
    match: (p) => p === '/' || p.startsWith('/dashboard'),
    icon: (
      <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />
    ),
  },
  {
    href: '/wards',
    label: 'Wards',
    match: (p) => p.startsWith('/wards') || p.startsWith('/villages') || p.startsWith('/community') || p.startsWith('/issues') || p.startsWith('/polling-stations'),
    icon: (
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zM9 3v15M15 6v15" />
    ),
  },
  {
    href: '/voters',
    label: 'Voters',
    match: (p) => p.startsWith('/voters'),
    icon: (
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
    ),
  },
  {
    href: '/team',
    label: 'Team',
    match: (p) => p.startsWith('/team') || p.startsWith('/meetings'),
    icon: (
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
    ),
  },
];

function NavCell({ it, active }: { it: Item; active: boolean }) {
  return (
    <Link
      href={it.href}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex flex-col items-center justify-center gap-1 min-h-[60px] py-2 px-1 transition',
        active ? 'text-brand-burnt' : 'text-brand-textMuted hover:text-brand-textActive',
      ].join(' ')}
    >
      <span className={['flex items-center justify-center rounded-xl w-11 h-7 transition', active ? 'bg-brand-burnt/15' : ''].join(' ')}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {it.icon}
        </svg>
      </span>
      <span className={['text-[11px] leading-none', active ? 'font-bold' : 'font-semibold'].join(' ')}>{it.label}</span>
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname() ?? '';
  const addActive = pathname.startsWith('/add');
  const left = ITEMS.slice(0, 2);
  const right = ITEMS.slice(2);

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-brand-borderStrong bg-brand-cardBg/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-end">
        {left.map((it) => (
          <li key={it.href} className="flex-1">
            <NavCell it={it} active={it.match(pathname)} />
          </li>
        ))}

        {/* Raised centre "+ Add" — the layman's fastest way to log data. */}
        <li className="flex-1">
          <Link
            href="/add"
            aria-current={addActive ? 'page' : undefined}
            aria-label="Add data"
            className="flex flex-col items-center justify-end gap-1 min-h-[60px] pb-2"
          >
            <span
              className={[
                '-mt-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-brand-cardBg text-white shadow-lg transition active:scale-95',
                addActive ? 'bg-brand-rust' : 'bg-brand-burnt',
              ].join(' ')}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className={['text-[11px] leading-none', addActive ? 'font-bold text-brand-burnt' : 'font-semibold text-brand-textMuted'].join(' ')}>
              Add
            </span>
          </Link>
        </li>

        {right.map((it) => (
          <li key={it.href} className="flex-1">
            <NavCell it={it} active={it.match(pathname)} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
