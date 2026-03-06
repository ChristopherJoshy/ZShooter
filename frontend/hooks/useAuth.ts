'use client';
import { useState, useCallback } from 'react';
import { apiLogin, apiRegister, apiLogout, apiGetMe } from '@/lib/api';
import type { UserProfile } from '@/lib/api';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (username: string, password: string): Promise<UserProfile | null> => {
    setLoading(true); setError(null);
    try {
      await apiLogin(username, password);
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
      await apiRegister(username, password);
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
