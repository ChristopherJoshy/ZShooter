'use server';
import { cookies } from 'next/headers';

const BACKEND = process.env.API_URL ?? 'https://zshooter.onrender.com';
const COOKIE_NAME = 'zf_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

type AuthResult = { ok: true; username: string } | { ok: false; error: string };

async function callAuthEndpoint(path: string, username: string, password: string): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'Cannot reach server — please try again' };
  }

  // Parse body regardless of status so we can surface the error message.
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: `Server error (${res.status})` };
  }

  if (!res.ok) {
    return { ok: false, error: (body.error as string) ?? 'Request failed' };
  }

  // Extract the JWT from the Set-Cookie header returned by Render and set it
  // on the Vercel domain directly. Vercel rewrites do not forward Set-Cookie
  // headers to the browser, so this server-action approach is the only
  // reliable way to store the cookie on the frontend domain.
  const setCookie = res.headers.get('set-cookie') ?? '';
  const tokenMatch = setCookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const token = tokenMatch?.[1];

  if (!token) {
    return { ok: false, error: 'Server did not return a session — please try again' };
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  return { ok: true, username: (body.username as string) ?? username };
}

export async function actionLogin(username: string, password: string): Promise<AuthResult> {
  return callAuthEndpoint('login', username, password);
}

export async function actionRegister(username: string, password: string): Promise<AuthResult> {
  return callAuthEndpoint('register', username, password);
}
