'use client';
import { useRouter } from 'next/navigation';
import AuthForm from '@/components/auth/AuthForm';
import type { UserProfile } from '@/lib/api';

export default function AuthPageClient() {
  const router = useRouter();

  function handleSuccess(_username: string, _profile: UserProfile) {
    router.push('/game');
  }

  return <AuthForm onSuccess={handleSuccess} />;
}
