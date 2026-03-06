import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AuthPageClient from './_AuthPageClient';

// If a valid session cookie exists, skip the auth page.
export default async function AuthPage() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.has('zf_token');
  if (hasSession) redirect('/game');
  return <AuthPageClient />;
}
