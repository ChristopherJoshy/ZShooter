'use client';
import AuthForm from '@/components/auth/AuthForm';
import type { UserProfile } from '@/lib/api';

export default function AuthPageClient() {
  function handleSuccess(_username: string, _profile: UserProfile) {
    // Full navigation instead of router.push — ensures the browser flushes
    // the Set-Cookie from the login response before the server reads cookies
    // on the /game page, preventing a redirect loop.
    window.location.href = '/game';
  }

  return <AuthForm onSuccess={handleSuccess} />;
}
