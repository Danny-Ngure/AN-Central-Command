// Renders an official signature on ID / agent cards. Uses the supplied signature
// image (public/sign-*.png) with a printed name + role beneath it.

export function Signature({
  name,
  role,
  src,
  height = 34,
}: { name: string; role: string; src?: string; height?: number }) {
  return (
    <div className="flex flex-col items-center select-none">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${name} signature`} style={{ height }} className="object-contain" />
      ) : (
        <span className="font-signature leading-none text-slate-800" style={{ fontSize: height * 0.9 }}>{name}</span>
      )}
      <div className="mt-0.5 border-t border-slate-300 w-full text-center pt-0.5">
        <div className="text-[10px] font-bold text-slate-800 leading-tight">{name}</div>
        <div className="text-[8px] uppercase tracking-wider text-slate-500">{role}</div>
      </div>
    </div>
  );
}
