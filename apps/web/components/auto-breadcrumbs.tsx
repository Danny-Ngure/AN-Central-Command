'use client';

import { usePathname } from 'next/navigation';
import { Breadcrumbs, type BreadcrumbItem } from './breadcrumbs';

// Auto-derived breadcrumbs. Lives in the layout and renders the trail for any
// top-level page that doesn't manage its own crumbs (it stays out of the way
// for dynamic pages like /wards/[id] which render their own with resolved
// human names).
//
// Coverage table — keep in sync with sidebar.tsx::NAV:
const ROUTE_LABELS: Record<string, string> = {
  '/dashboard':   'Home',
  '/wards':       'Wards',
  '/voters':      'Voter Search',
  '/analytics':   'Pollings & Analysis',
  '/team':        'Team Directory',
  '/audit':       'Audit Logs',
  '/data-import': 'Data Import',
};

// Routes that render their OWN breadcrumbs (with DB-resolved names). The
// auto-breadcrumb hides itself for these so we don't double-render.
const SELF_MANAGED_PREFIXES = [
  '/wards/',          // /wards/[id] and children
  '/polling-stations/', // /polling-stations/[id]
];

export function AutoBreadcrumbs() {
  const pathname = usePathname() ?? '';

  if (SELF_MANAGED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  // /dashboard is "Home" — the home crumb itself is enough.
  if (pathname === '/dashboard' || pathname === '/') return null;

  const label = ROUTE_LABELS[pathname];
  if (!label) return null;

  const items: BreadcrumbItem[] = [{ label }];
  return <Breadcrumbs items={items} />;
}
