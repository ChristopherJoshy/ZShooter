import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import GamePageClient from './_GamePageClient';
import type { UserProfile } from '@/lib/api';

// Server-side API base — env var for local dev, hardcoded prod URL as fallback.
function apiBase(): string {
  return process.env.API_URL ?? 'https://zshooter.onrender.com';
}

// Fetch profile server-side. Returns null on any failure (cold start, network
// blip, etc.) — the client handles null via its localStorage session cache
// rather than causing a redirect loop.
async function fetchProfile(cookieHeader: string): Promise<UserProfile | null> {
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
  // No cookie at all → definitely not logged in → go to auth page.
  if (!hasSession) redirect('/');

  // Forward all cookies as a header string for the internal API call.
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
  // profile may be null if Render is cold-starting or temporarily unreachable.
  // Do NOT redirect to '/' here — that creates a redirect loop.
  // The client component reads localStorage cache and handles the null case.
  const profile = await fetchProfile(cookieHeader);

  return <GamePageClient profile={profile} />;
}
