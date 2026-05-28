'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

interface Props {
  step2Token: string;
}

export function EnrollForm({ step2Token }: Props) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/enroll-totp/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: step2Token, code }),
      });
      const body = await res.json();

      if (body.success) {
        router.push('/dashboard');
        router.refresh();
        return;
      }
      setError(body.error?.message ?? 'Confirmation failed');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <label
          htmlFor="totp"
          className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider"
        >
          Six-digit code
        </label>
        <input
          id="totp"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          className="w-full bg-black border border-brand-border rounded-lg px-3 py-2.5 text-brand-textActive tracking-[0.4em] text-center text-lg focus:outline-none focus:border-brand-violet"
        />
      </div>

      {error && (
        <div className="text-sm text-brand-danger bg-brand-danger/10 border border-brand-danger/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full bg-brand-violet text-white font-semibold rounded-lg py-2.5 hover:bg-brand-violet/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Confirming…' : 'Confirm and sign in'}
      </button>
    </form>
  );
}
