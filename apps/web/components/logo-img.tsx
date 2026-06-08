'use client';

import { useState } from 'react';

interface LogoImgProps {
  size: number;
}

// LogoImg — the campaign mark from /public/logo.png.
//
// The real logo is a portrait composition (stacked triangles + database).
// We size by HEIGHT and let the width auto-flow so the natural aspect ratio
// is preserved — the previous version forced a square box and squashed it.
//
// On a dark navbar the thin dark-teal outlines are hard to see, so we layer
// two drop shadows: a sharp white-ish halo for outline contrast + a softer
// teal-tinted bloom for depth. This keeps the logo on the dark surface
// without needing a white "badge" wrapper.
//
// onError swaps in the SVG placeholder if /logo.png is missing — but once
// you drop the real file in, the next hard refresh shows it.

export function LogoImg({ size }: LogoImgProps) {
  const [src, setSrc] = useState('/logo.png');
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      onError={() => setSrc('/logo-placeholder.svg')}
      alt="Alfayo Nelson Central Command"
      className="object-contain shrink-0"
      style={{
        height: size,
        width: 'auto',
        filter:
          'drop-shadow(0 0 1px rgba(255,255,255,0.45)) drop-shadow(0 2px 6px rgba(2,94,115,0.55))',
      }}
    />
  );
}
