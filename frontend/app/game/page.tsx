import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import GamePageClient from './_GamePageClient';

// Server-side API base — prefer the non-public env var (not exposed to browser bundle),
// fall back to the public one, then to a safe default matching the backend PORT.
function apiBase(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

// Fetch profile server-side via internal rewrite (same origin, cookie forwarded).
async function fetchProfile(cookieHeader: string) {
  try {
    const res = await fetch(`${apiBase()}/api/user/me`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function GamePage() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.has('zf_token');
  if (!hasSession) redirect('/');

  // Forward all cookies as a header string for the internal API call.
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
  const profile = await fetchProfile(cookieHeader);
  if (!profile) redirect('/');

  return <GamePageClient profile={profile} />;
}
