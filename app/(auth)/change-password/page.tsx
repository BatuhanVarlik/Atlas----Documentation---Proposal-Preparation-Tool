import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ChangePasswordForm from './ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/login');

  return <ChangePasswordForm email={session.user.email} forced={session.user.mustChangePassword} />;
}
