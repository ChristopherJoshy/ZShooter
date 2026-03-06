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
          <svg viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="13" cy="13" r="4" fill="white" fillOpacity="0.95"/>
            <line x1="13" y1="2" x2="13" y2="7" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            <line x1="13" y1="19" x2="13" y2="24" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            <line x1="2" y1="13" x2="7" y2="13" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            <line x1="19" y1="13" x2="24" y2="13" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            <line x1="4.93" y1="4.93" x2="8.46" y2="8.46" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7"/>
            <line x1="17.54" y1="17.54" x2="21.07" y2="21.07" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7"/>
            <line x1="21.07" y1="4.93" x2="17.54" y2="8.46" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7"/>
            <line x1="8.46" y1="17.54" x2="4.93" y2="21.07" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7"/>
          </svg>
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
