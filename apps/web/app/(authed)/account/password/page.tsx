import { getServerAuthOrRedirect } from '@/lib/server-auth';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ChangePasswordForm } from '@/components/change-password-form';

// /account/password — let the signed-in user change their own password.

export default async function ChangePasswordPage() {
  await getServerAuthOrRedirect();

  return (
    <div className="max-w-lg space-y-5">
      <Breadcrumbs items={[{ label: 'Home', href: '/dashboard' }, { label: 'Account' }, { label: 'Change password' }]} />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-textActive">Change password</h1>
        <p className="text-sm text-brand-textMuted">
          Update the password you use to sign in. Choose something at least 12 characters long.
        </p>
      </header>
      <ChangePasswordForm />
    </div>
  );
}
