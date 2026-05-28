import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/server-auth';

export default async function HomePage() {
  const claims = await getServerAuth();
  redirect(claims ? '/dashboard' : '/login');
}
