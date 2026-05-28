import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/server-auth';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  // If already authenticated, skip the login form.
  const claims = await getServerAuth();
  if (claims) redirect('/dashboard');

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-brand-textMuted">
            AN Central Command
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
      </div>
    </main>
  );
}
