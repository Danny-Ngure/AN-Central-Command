'use client';

// Phone-action buttons: Call · SMS · WhatsApp.
//
// Today:
//   - Call:     <a href="tel:+254..."> — works on every device (mobile dials, desktop pops Skype/Teams).
//   - SMS:      <a href="sms:+254...?body=..."> — works on mobile, no-ops on desktop. Stub now.
//   - WhatsApp: https://wa.me/254... deeplink — opens WhatsApp Web or the app. Works today
//               for one-to-one templates; bulk broadcasts need a BSP (Phase 7, DEP-001).
//
// Future (Phase 7):
//   - Track every outbound action in messaging_outbox so we have an audit trail per recipient.
//   - Route bulk through Africa's Talking SMS + 360dialog WhatsApp Business with template approval.

interface Props {
  phone: string | null;
  size?: 'sm' | 'md';
  /** Optional context for SMS / WhatsApp pre-fill. */
  defaultMessage?: string;
}

export function PhoneActions({ phone, size = 'md', defaultMessage }: Props) {
  if (!phone) {
    return <span className="text-xs text-brand-textMuted italic">No phone</span>;
  }
  const tel = phone.startsWith('+') ? phone : `+${phone}`;
  const digits = tel.replace(/[^\d]/g, '');
  const msg = defaultMessage ?? '';
  const btnBase =
    size === 'sm'
      ? 'inline-flex items-center justify-center w-7 h-7 rounded-md text-xs'
      : 'inline-flex items-center justify-center w-9 h-9 rounded-md text-sm';

  return (
    <div className="flex items-center gap-1.5">
      <a
        href={`tel:${tel}`}
        title={`Call ${tel}`}
        className={`${btnBase} bg-brand-violet/15 text-brand-violet hover:bg-brand-violet/25`}
      >
        {/* phone glyph */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
        </svg>
      </a>
      <a
        href={`sms:${tel}${msg ? `?&body=${encodeURIComponent(msg)}` : ''}`}
        title={`Text ${tel}`}
        className={`${btnBase} bg-amber-500/15 text-amber-300 hover:bg-amber-500/25`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </a>
      <a
        href={`https://wa.me/${digits}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`}
        target="_blank"
        rel="noopener noreferrer"
        title={`WhatsApp ${tel}`}
        className={`${btnBase} bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
        </svg>
      </a>
    </div>
  );
}
