'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const router = useRouter();
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [show2fa, setShow2fa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneOrEmail,
          password,
          totpCode: totpCode || undefined,
          client: 'web',
        }),
      });
      const body = await res.json();

      if (body.success) {
        router.push('/dashboard');
        router.refresh();
        return;
      }

      // Map error codes to UX:
      const code = body.error?.code as string | undefined;
      if (code === 'AUTH_2FA_REQUIRED') {
        setShow2fa(true);
        setError('Two-factor authentication code required');
      } else if (code === 'AUTH_2FA_NOT_ENROLLED') {
        const enrollmentToken = body.error?.details?.enrollmentToken;
        if (enrollmentToken) {
          router.push(`/enroll-totp?token=${encodeURIComponent(enrollmentToken)}`);
          return;
        }
        setError('Two-factor authentication is required but enrollment could not be initiated.');
      } else {
        setError(body.error?.message ?? 'Sign in failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="phoneOrEmail" className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider">
          Phone or email
        </label>
        <input
          id="phoneOrEmail"
          type="text"
          required
          autoComplete="username"
          value={phoneOrEmail}
          onChange={(e) => setPhoneOrEmail(e.target.value)}
          placeholder="+254700000010"
          className="w-full bg-black border border-brand-border rounded-lg px-3 py-2.5 text-brand-textActive placeholder:text-brand-textMuted focus:outline-none focus:border-brand-violet"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-black border border-brand-border rounded-lg px-3 py-2.5 text-brand-textActive focus:outline-none focus:border-brand-violet"
        />
      </div>

      {show2fa && (
        <div className="space-y-1">
          <label htmlFor="totpCode" className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider">
            Two-factor code
          </label>
          <input
            id="totpCode"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className="w-full bg-black border border-brand-border rounded-lg px-3 py-2.5 text-brand-textActive tracking-[0.4em] text-center focus:outline-none focus:border-brand-violet"
          />
        </div>
      )}

      {error && (
        <div className="text-sm text-brand-danger bg-brand-danger/10 border border-brand-danger/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full bg-brand-violet text-white font-semibold rounded-lg py-2.5 hover:bg-brand-violet/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
