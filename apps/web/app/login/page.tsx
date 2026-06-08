import { redirect } from 'next/navigation';
import { BrandMark } from '@/components/brand';
import { getServerAuth } from '@/lib/server-auth';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  // If already authenticated, skip the login form.
  const claims = await getServerAuth();
  if (claims) redirect('/dashboard');

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-3">
          <BrandMark size={84} withName={false} />
          <div className="text-base font-extrabold tracking-[0.18em] text-brand-textActive uppercase text-center">
            Alfayo Nelson<br />Central Command
          </div>
          <h1 className="text-2xl font-bold text-brand-textActive">Sign in</h1>
          <p className="text-sm text-brand-textMuted">
            Campaign intelligence portal — Nyali Constituency
          </p>
        </div>

        <div className="rounded-xl border border-brand-border bg-brand-cardBg p-6">
          <LoginForm />
        </div>

        <p className="text-xs text-brand-textMuted text-center">
          Authorised personnel only. Unauthorised access is an offence under the
          Computer Misuse and Cybercrimes Act, 2018.
        </p>
        <p className="text-[10px] tracking-[0.22em] uppercase text-brand-textMuted/80 text-center pt-2">
          Created by <span className="text-brand-orangeBright font-bold">Danny Ngure</span> © 2026 · All rights reserved
        </p>
      </div>
    </main>
  );
}
