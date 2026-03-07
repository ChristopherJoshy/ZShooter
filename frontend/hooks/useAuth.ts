'use client';
import { useState, useCallback } from 'react';
import { actionLogin, actionRegister } from '@/app/actions/auth';
import { apiLogout, apiGetMe } from '@/lib/api';
import type { UserProfile } from '@/lib/api';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (username: string, password: string): Promise<UserProfile | null> => {
    setLoading(true); setError(null);
    try {
      // Server Action — calls Render directly from Vercel's server and sets
      // zf_token on the Vercel domain, bypassing the proxy Set-Cookie issue.
      const result = await actionLogin(username, password);
      if (!result.ok) { setError(result.error); return null; }
      return await apiGetMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (username: string, password: string): Promise<UserProfile | null> => {
    setLoading(true); setError(null);
    try {
      const result = await actionRegister(username, password);
      if (!result.ok) { setError(result.error); return null; }
      return await apiGetMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    window.location.href = '/';
  }, []);

  return { login, register, logout, loading, error, setError };
}
