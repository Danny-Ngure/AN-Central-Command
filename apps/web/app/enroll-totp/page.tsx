import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import {
  generateTotpSecret,
  signEnrollmentStep2Jwt,
  verifyEnrollmentStep1Jwt,
} from '@an/auth';
import { db, people } from '@an/db';
import { EnrollForm } from './enroll-form';

interface PageProps {
  searchParams: { token?: string };
}

export default async function EnrollTotpPage({ searchParams }: PageProps) {
  const token = searchParams.token;
  if (!token) redirect('/login');

  const claims = await verifyEnrollmentStep1Jwt(token);
  if (!claims) redirect('/login?reason=enrollment_expired');

  // Load the person's name + role so the QR account label is recognisable.
  const personRows = await db
    .select({ fullName: people.fullName, phone: people.phone, role: people.role })
    .from(people)
    .where(eq(people.id, claims.sub))
    .limit(1);
  if (personRows.length === 0) redirect('/login?reason=orphaned');
  const person = personRows[0];

  // Generate the candidate secret server-side and the QR data URL. The secret travels
  // in the step-2 JWT to the confirm endpoint — same value as the QR the user scans,
  // so no additional exposure.
  const { secret, otpauthUrl } = generateTotpSecret(
    person.phone,
    'AN Central Command',
  );
  const step2Token = await signEnrollmentStep2Jwt(claims.sub, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    width: 240,
    margin: 1,
    color: { dark: '#FFFFFFFF', light: '#0A0B10FF' },
  });

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-brand-textMuted">
            AN Central Command
          </div>
          <h1 className="text-2xl font-bold text-brand-textActive">
            Enrol two-factor authentication
          </h1>
          <p className="text-sm text-brand-textMuted">
            Your role ({person.role.replace(/_/g, ' ')}) requires 2FA on every sign-in.
          </p>
        </div>

        <div className="rounded-xl border border-brand-border bg-brand-cardBg p-6 space-y-5">
          <ol className="space-y-3 text-sm text-brand-textMuted list-decimal list-inside">
            <li>Install an authenticator app (Google Authenticator, Authy, 1Password).</li>
            <li>Scan the QR code below — or enter the key manually.</li>
            <li>Type the six-digit code your app displays.</li>
          </ol>

          <div className="flex flex-col items-center gap-3 py-2">
            <img
              src={qrDataUrl}
              alt="TOTP QR code"
              className="rounded-lg border border-brand-border"
              width={240}
              height={240}
            />
            <div className="space-y-1 text-center">
              <div className="text-[10px] uppercase tracking-wider text-brand-textMuted">
                Manual entry key
              </div>
              <code className="text-xs text-brand-textActive bg-black border border-brand-border rounded px-2 py-1 inline-block break-all">
                {secret}
              </code>
            </div>
          </div>

          <EnrollForm step2Token={step2Token} />
        </div>

        <p className="text-xs text-brand-textMuted text-center">
          The QR code expires in 5 minutes. If it expires, sign in again to restart.
        </p>
      </div>
    </main>
  );
}
