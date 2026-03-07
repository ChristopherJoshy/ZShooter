import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import GamePageClient from './_GamePageClient';

// Server-side API base — env var for local dev, hardcoded prod URL as fallback.
function apiBase(): string {
  return process.env.API_URL ?? 'https://zshooter.onrender.com';
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
