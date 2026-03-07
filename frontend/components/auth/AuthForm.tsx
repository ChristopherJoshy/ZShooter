'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface AuthFormProps {
  onSuccess: (username: string, save: import('@/lib/api').UserProfile) => void;
}

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, register, loading, error, setError } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fn = mode === 'login' ? login : register;
    const profile = await fn(username.trim(), password);
    if (profile) onSuccess(profile.username, profile);
  }

  function switchMode() {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError(null);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        {/* Logo mark */}
        <div className="auth-logo">
          <img src="/zshooter-logo.png" alt="ZShooter" />
        </div>

        {/* Title */}
        <div className="auth-title">ZSHOOTER</div>
        <div className="auth-sub">{mode === 'login' ? 'Sign in to continue' : 'Create your account'}</div>
        <div className="divider auth-divider" />

        {/* Form */}
        <form onSubmit={handleSubmit} autoComplete="off" className="auth-form">
          <div className="auth-field">
            <label className="auth-label">Name</label>
            <input
              className="auth-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your name"
              maxLength={24}
              required
              autoFocus
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={4}
              required
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="zen-btn auth-submit" type="submit" disabled={loading}>
            {loading ? 'Loading…' : mode === 'login' ? 'Sign In' : 'Register'}
          </button>
        </form>

        <div className="divider auth-divider auth-divider-bottom" />
        <button className="auth-switch" onClick={switchMode}>
          {mode === 'login'
            ? <>No account? <strong>Register</strong></>
            : <>Have an account? <strong>Sign in</strong></>}
        </button>
        <div className="auth-credit">A game by Christopher Joshy</div>
      </div>
    </div>
  );
}
