// Brand identity helpers — name in one place. Logo lives in ./logo-img.tsx as a client
// component so it can fall back from /logo.png → /logo-placeholder.svg on 404 via onError.
//
// To install the real logo: save the PNG as apps/web/public/logo.png. No code change.

import { LogoImg } from './logo-img';

export const BRAND_FULL_NAME = 'ALFAYO NELSON CENTRAL COMMAND';
export const BRAND_SHORT_NAME = 'ALFAYO NELSON';
export const BRAND_SUBTITLE = 'Central Command';

interface BrandMarkProps {
  size?: number;          // pixel height
  withName?: boolean;
  variant?: 'compact' | 'full';
  className?: string;
}

export function BrandMark({
  size = 40,
  withName = true,
  variant = 'compact',
  className = '',
}: BrandMarkProps) {
  // Stacked two-line brand mark, ALL CAPS, brand palette:
  //   line 1 — "ALFAYO NELSON"     sky-blue   · extra-bold · tight letter-spacing
  //   line 2 — "CENTRAL COMMAND"   orange     · bold       · wide letter-spacing
  //
  // `compact` is the top-nav size · `full` is the footer / login size.
  // Both lines use `drop-shadow` so they read cleanly on the dark teal nav
  // gradient without needing a backdrop badge.
  const isFull = variant === 'full';
  const line1 = isFull
    ? 'text-base lg:text-lg font-extrabold tracking-[0.18em]'
    : 'text-sm font-extrabold tracking-[0.18em]';
  const line2 = isFull
    ? 'text-[11px] lg:text-xs font-bold tracking-[0.32em] mt-0.5'
    : 'text-[10px] font-bold tracking-[0.30em]';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoImg size={size} />
      {withName && (
        <div className="flex flex-col leading-tight">
          <span
            className={`uppercase text-brand-skyBlue ${line1}`}
            style={{ textShadow: '0 1px 8px rgba(0,204,255,0.35)' }}
          >
            {BRAND_SHORT_NAME}
          </span>
          <span
            className={`uppercase text-brand-orangeBright ${line2}`}
            style={{ textShadow: '0 1px 8px rgba(255,102,0,0.35)' }}
          >
            {BRAND_SUBTITLE}
          </span>
        </div>
      )}
    </div>
  );
}
