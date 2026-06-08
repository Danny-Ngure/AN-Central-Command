import Link from 'next/link';

// Breadcrumbs — explicit trail rendered at the top of every page.
//
// Why explicit (not URL-derived): dynamic segments like `/wards/abc-123` need
// the ward's HUMAN name resolved from the DB. Pages fetch that data anyway, so
// passing the labels in is cheaper than a second lookup and lets us add neat
// touches (★ Super Admin, ward-switcher dropdown, etc.) on a per-page basis.
//
// The last item is always rendered as the "current page" (no link).
//
// Optional `siblings` on a single item turns that crumb into a quick-jump
// dropdown — used on the ward detail page so you can hop to a sibling ward
// without bouncing back to /wards. Implemented with native <details>/<summary>
// so it works server-side, no JS bundle needed.

export type BreadcrumbItem = {
  label: string;
  href?: string;
  // When present, this crumb becomes a dropdown for jumping sideways.
  siblings?: { label: string; href: string; current?: boolean }[];
};

interface Props {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-brand-textMuted flex-wrap"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 hover:text-brand-textActive transition"
        aria-label="Home"
      >
        <HomeIcon />
        <span className="hidden sm:inline">Home</span>
      </Link>

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={`${item.label}-${idx}`} className="flex items-center gap-1">
            <ChevronIcon />
            {item.siblings && item.siblings.length > 0 ? (
              <SwitcherCrumb item={item} isLast={isLast} />
            ) : isLast || !item.href ? (
              <span
                aria-current={isLast ? 'page' : undefined}
                className={
                  isLast
                    ? 'px-2 py-1 font-semibold text-brand-textActive'
                    : 'px-2 py-1'
                }
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="px-2 py-1 rounded hover:bg-white/5 hover:text-brand-textActive transition"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// Dropdown crumb. Native <details> means no client JS; clicking the label
// reveals a list of sibling links so you can jump between wards / stations /
// whatever without going back to the parent index page.
function SwitcherCrumb({ item, isLast }: { item: BreadcrumbItem; isLast: boolean }) {
  return (
    <details className="relative group">
      <summary
        className={[
          'list-none cursor-pointer px-2 py-1 rounded flex items-center gap-1 transition',
          'hover:bg-white/5',
          isLast ? 'font-semibold text-brand-textActive' : 'text-brand-textMuted hover:text-brand-textActive',
        ].join(' ')}
      >
        {item.label}
        <CaretIcon />
      </summary>
      <div
        className="
          absolute left-0 top-full mt-1 z-50 min-w-[14rem] max-h-80 overflow-auto
          rounded-lg border border-brand-border bg-brand-cardBg/95 backdrop-blur
          shadow-2xl py-1
        "
      >
        {item.siblings!.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={[
              'block px-3 py-1.5 text-xs transition',
              s.current
                ? 'bg-brand-violet/20 text-brand-textActive font-semibold'
                : 'text-brand-textMuted hover:bg-white/5 hover:text-brand-textActive',
            ].join(' ')}
          >
            {s.current ? '› ' : ''}{s.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

function HomeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-textMuted/60" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function CaretIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
