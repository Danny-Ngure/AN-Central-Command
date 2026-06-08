'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BrandMark } from './brand';

// Site footer. One component, page-aware hero image — the photo on the right
// changes based on which nav-bar page the user is on. Layout inspired by the
// OfficeSpace reference: brand+tagline top-left · CTA top-right · three link
// columns bottom-left · hero photo bottom-right · thin strip at the very bottom.
//
// Photo files live in /public/footer/. If a file is missing the component
// gracefully falls back to a coloured ANHF brand panel — no broken images.
// See apps/web/public/footer/README.md for the filename → page mapping.

type FooterImage = {
  src: string;
  alt: string;
  caption: string;
};

// Each top-nav page gets its own footer photo. Routes not listed here use the
// DEFAULT_IMAGE. Deep routes (/wards/[id], /polling-stations/[id]) inherit
// from their parent via the prefix-match loop below.
const FOOTER_IMAGES: Record<string, FooterImage> = {
  '/dashboard':   { src: '/footer/stage-crowd.jpg',     alt: 'Alfayo Nelson addressing a crowd from stage',     caption: 'On the stage' },
  '/wards':       { src: '/footer/street-rally.jpg',    alt: 'Alfayo Nelson at a street rally with supporters', caption: 'On the ground' },
  '/voters':      { src: '/footer/street-rally.jpg',    alt: 'Alfayo Nelson at a street rally with supporters', caption: 'On the ground' },
  '/analytics':   { src: '/footer/media-interview.jpg', alt: 'Alfayo Nelson at media interview',                 caption: 'On record' },
  '/meetings':    { src: '/footer/cap-smile.jpg',       alt: 'Alfayo Nelson smiling with supporters',            caption: 'With the people' },
  '/team':        { src: '/footer/cap-smile.jpg',       alt: 'Alfayo Nelson smiling with supporters',            caption: 'With the team' },
  '/audit':       { src: '/footer/media-interview.jpg', alt: 'Alfayo Nelson at media interview',                 caption: 'On record' },
  '/data-import': { src: '/footer/stage-crowd.jpg',     alt: 'Alfayo Nelson addressing a crowd from stage',     caption: 'On the stage' },
  '/polling-stations': { src: '/footer/street-rally.jpg', alt: 'Alfayo Nelson at a street rally with supporters', caption: 'On the ground' },
};

const DEFAULT_IMAGE: FooterImage = FOOTER_IMAGES['/dashboard']!;

function pickImage(pathname: string): FooterImage {
  if (FOOTER_IMAGES[pathname]) return FOOTER_IMAGES[pathname]!;
  for (const [prefix, img] of Object.entries(FOOTER_IMAGES)) {
    if (pathname.startsWith(prefix + '/')) return img;
  }
  return DEFAULT_IMAGE;
}

export function SiteFooter() {
  const pathname = usePathname() ?? '/dashboard';
  const img = pickImage(pathname);
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-12 overflow-hidden bg-gradient-to-br from-brand-darkGray via-[#0a1216] to-brand-deepBlue text-brand-textBody">
      {/* Organic decorations matching the OfficeSpace palm-frond vibe — kept
          subtle so the photo stays the focal element. */}
      <PalmFrondTopRight />
      <PalmFrondBottomLeft />

      <div className="relative max-w-[1600px] mx-auto px-6 lg:px-10 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        {/* ── Top row: brand + tagline (left) ─────────────────────────────── */}
        {/* Same BrandMark + colour treatment as the top nav: sky-blue
            "ALFAYO NELSON" stacked on orange-bright "Central Command",
            just sized up for footer presence. */}
        <div className="lg:col-span-7 space-y-4">
          <BrandMark size={56} variant="full" withName={true} />
          <p className="text-sm text-white/75 max-w-xl leading-relaxed">
            Campaign intelligence platform for Nyali Constituency — purpose-built for
            the team carrying Alfayo Nelson to the road of 9 August 2027.
          </p>
        </div>

        {/* ── Top row: countdown + CTA (right) ───────────────────────────── */}
        <div className="lg:col-span-5 lg:text-right space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-brand-orangeBright">
            Election Day
          </div>
          <div className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            9 August 2027
          </div>
          <div>
            <Link
              href="/meetings?action=new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-orangePrimary text-white text-sm font-bold uppercase tracking-wider shadow-brand-orange hover:bg-brand-orangeBright transition"
            >
              Schedule a meeting
              <ArrowIcon />
            </Link>
          </div>
        </div>

        {/* ── Bottom row: three link columns (left) ──────────────────────── */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-10 pt-4 border-t border-white/10 lg:border-t-0 lg:pt-0">
          <FooterColumn
            title="Operations"
            links={[
              { href: '/dashboard',   label: 'Home' },
              { href: '/wards',       label: 'Wards' },
              { href: '/voters',      label: 'Voter Search' },
              { href: '/data-import', label: 'Data Import' },
            ]}
          />
          <FooterColumn
            title="Engage"
            links={[
              { href: '/meetings',                       label: 'Meetings' },
              { href: '/meetings?action=new',            label: 'Schedule meeting' },
              { href: '/meetings?action=new-activity',   label: 'Activity at site' },
              { href: '/meetings?view=unvisited',        label: 'Unvisited sites' },
              { href: '/analytics',                      label: 'Pollings & Analysis' },
            ]}
          />
          <FooterColumn
            title="Manage"
            links={[
              { href: '/team',  label: 'Team Directory' },
              { href: '/audit', label: 'Audit Logs' },
            ]}
          />
        </div>

        {/* ── Bottom row: hero photo (right) ────────────────────────────── */}
        <div className="lg:col-span-5 flex lg:justify-end">
          {/* key=img.src so when the page changes and the source url changes,
              we remount and reset the local "failed" state — otherwise a
              single failure would leave the fallback in place forever. */}
          <FooterPhoto key={img.src} img={img} />
        </div>
      </div>

      {/* ── Very bottom strip ────────────────────────────────────────────── */}
      <div className="relative border-t border-white/10 bg-black/40">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-4 space-y-2 text-center text-[11px] text-white/65">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/audit" className="hover:text-brand-textActive transition">Audit log</Link>
            <span className="opacity-50">·</span>
            <span>Source-private</span>
            <span className="opacity-50">·</span>
            <span>Data hosted in Africa</span>
          </div>
          <div>
            © {year} ALFAYO NELSON · Nyali Parliamentary Candidacy 2027
          </div>
          {/* Builder credit — sits below the copyright, centered. */}
          <div className="pt-2 border-t border-white/10 text-[10px] tracking-[0.22em] uppercase text-white/55">
            Created by <span className="text-brand-orangeBright font-bold">Danny Ngure</span> © 2026 · All rights reserved
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-orangeBright mb-3">
        {title}
      </div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link
              href={l.href}
              className="text-sm text-white/80 hover:text-brand-gold transition"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterPhoto({ img }: { img: FooterImage }) {
  const [failed, setFailed] = useState(false);

  // Soft radial mask — the photo stays sharp around the upper-right and fades
  // into the footer background on the left + bottom edges. This stops the
  // photo from feeling like a rectangular sticker glued onto the footer.
  const softMask =
    'radial-gradient(ellipse 95% 90% at 70% 35%, rgba(0,0,0,1) 35%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0) 100%)';

  return (
    <div className="relative w-full max-w-lg aspect-[4/3]">
      {/* Behind-the-photo glow — tinted with brand colours so the photo
          feels lit by the brand, not floating in space. */}
      <div
        aria-hidden
        className="absolute -inset-6 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at 65% 40%, rgba(2,94,115,0.5) 0%, rgba(255,102,0,0.18) 45%, transparent 75%)',
        }}
      />

      {/* Masked photo wrapper — both the image and the brand-tint overlay
          inherit the mask so they fade together. */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          WebkitMaskImage: softMask,
          maskImage: softMask,
        }}
      >
        {failed ? (
          <FallbackVisual caption={img.caption} />
        ) : (
          // Plain <img> on purpose — these are static photos in /public/footer/.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.src}
            alt={img.alt}
            onError={() => setFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Brand tint overlay: teal in shadows, orange-bright in highlights.
            mix-blend-overlay melts the tones into the photo so the colour
            palette of the photo matches the rest of the footer instead of
            clashing with it. */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-tealBlue/30 via-transparent to-brand-orangeBright/25 mix-blend-overlay pointer-events-none" />
        {/* A subtle dark vignette on the very bottom so the caption underneath
            reads cleanly even on bright photos. */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
      </div>

      {/* Caption — outside the mask so it stays sharp regardless of fade. */}
      <div className="absolute inset-x-0 bottom-3 px-5 pointer-events-none">
        <div className="text-[10px] uppercase tracking-[0.34em] text-brand-orangeBright font-bold drop-shadow">
          {img.caption}
        </div>
        <div className="text-lg text-white font-extrabold mt-1 drop-shadow-lg">
          Alfayo Nelson
        </div>
      </div>
    </div>
  );
}

function FallbackVisual({ caption }: { caption: string }) {
  // Rendered if the JPG for this page hasn't been dropped into /public/footer/.
  // Branded gradient so the footer never looks broken — just stylised.
  // Sits INSIDE the masked wrapper so the same edge-fade applies.
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-brand-tealBlue via-brand-deepBlue to-brand-darkGray">
      <div className="text-7xl font-extrabold text-brand-orangeBright drop-shadow-lg tracking-tight">AN</div>
      <div className="text-[10px] uppercase tracking-[0.32em] text-brand-textBody mt-3">
        {caption}
      </div>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function PalmFrondTopRight() {
  return (
    <svg
      className="absolute -top-16 -right-10 w-72 h-72 opacity-[0.08] text-brand-tealBright"
      viewBox="0 0 200 200" fill="currentColor" aria-hidden
    >
      <path d="M100 0 Q 130 50 150 80 Q 170 100 200 100 Q 170 110 150 130 Q 130 150 100 200 Q 70 150 50 130 Q 30 110 0 100 Q 30 100 50 80 Q 70 50 100 0 Z" />
    </svg>
  );
}

function PalmFrondBottomLeft() {
  return (
    <svg
      className="absolute -bottom-16 -left-12 w-80 h-80 opacity-[0.07] text-brand-orangeBright"
      viewBox="0 0 200 200" fill="currentColor" aria-hidden
    >
      <path d="M0 100 Q 50 130 80 150 Q 100 170 100 200 Q 110 170 130 150 Q 150 130 200 100 Q 150 70 130 50 Q 110 30 100 0 Q 100 30 80 50 Q 50 70 0 100 Z" />
    </svg>
  );
}
