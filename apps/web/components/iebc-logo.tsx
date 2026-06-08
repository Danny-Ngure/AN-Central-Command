// Stylised IEBC emblem for the Certified Election Agent card.
// Representative roundel (green ring + ballot tick), not the exact official mark.
export function IebcLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="IEBC">
      <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#0a7d34" strokeWidth="4" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#0a7d34" strokeWidth="1.5" />
      {/* ballot box + tick */}
      <rect x="34" y="40" width="32" height="24" rx="2" fill="#0a7d34" />
      <rect x="44" y="34" width="12" height="9" rx="1" fill="#0a7d34" />
      <path d="M40 52 l6 6 l14 -14" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="50" y="80" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0a7d34" fontFamily="Arial, sans-serif">IEBC</text>
      <text x="50" y="26" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#b91c1c" fontFamily="Arial, sans-serif">KENYA</text>
    </svg>
  );
}
